'use strict'

// ─────────────────────────────────────────────────────────────────────────────
// Ανώνυμη τηλεμετρία «insights» — ΜΟΝΟ στατιστικά για το ίδιο το πρόγραμμα.
//
// ΑΥΣΤΗΡΟΣ ΚΑΝΟΝΑΣ: εδώ ΔΕΝ φεύγει ΚΑΝΕΝΑ δεδομένο μαθητή/δομής, κανένα μέγεθος
// (αριθμός μαθητών) ούτε γεωγραφία (Περιφέρεια). Στέλνονται μόνο: τυχαίο install_id,
// έκδοση/OS, locale, σχολικό έτος, μοτίβα χρήσης (session/heartbeat), μετρητές
// ενεργειών (allowlist) και ΚΑΘΑΡΙΣΜΕΝΑ σφάλματα (χωρίς διαδρομές χρήστη/IPC args).
//
// Best-effort/σιωπηλό (μοτίβο announcement:get): fetch + timeout + try/catch που δεν
// ρίχνει ποτέ. Ελέγχεται από (α) τοπικό opt-out (settings.telemetry_enabled==='0')
// και (β) remote kill-switch (telemetry.json σε Firebase Hosting).
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto')
const os = require('os')

// ── Ρυθμίσεις backend — ΣΥΜΠΛΗΡΩΣΕ μετά το στήσιμο Firebase ────────────────────
// (Το Web API key & το project id ΔΕΝ είναι μυστικά — είναι public web config.)
const FIREBASE_PROJECT_ID = 'mathitologio-insights'
const FIREBASE_API_KEY = 'AIzaSyCe8hAnG8KaDcadzhnCrA3f8pWEfZ3GO4Q' // Firebase Web API key (public)
const PINGS_COLLECTION = 'pings'
// Public αρχείο kill-switch/ρυθμίσεων σε Firebase Hosting:
const CONFIG_URL = 'https://mathitologio-insights.web.app/telemetry.json'

const DEFAULT_INTERVAL_MIN = 10
const HTTP_TIMEOUT_MS = 6000
const MAX_MESSAGE_LEN = 300
const STACK_TOP_FRAMES = 6
const DEBUG = process.env.TELEMETRY_DEBUG === '1'

// ── Κατάσταση συνεδρίας ───────────────────────────────────────────────────────
let deps = null // { db, getVersion, getLocale, getSchoolYear }
let installId = ''
let firstSeen = ''
let sessionId = ''
let startedAt = 0
let timer = null
let started = false
let remote = { enabled: true, intervalMin: DEFAULT_INTERVAL_MIN }
const counts = new Map() // channel -> πλήθος (delta από το προηγούμενο beat)
const errorsSeen = new Set() // dedup σφαλμάτων εντός συνεδρίας

// ── Βοηθητικά ─────────────────────────────────────────────────────────────────
function configured() {
  return !!FIREBASE_PROJECT_ID && !!FIREBASE_API_KEY
}

function optedOut() {
  try {
    return deps && deps.db && deps.db.getAllSettings().telemetry_enabled === '0'
  } catch {
    return false
  }
}

function firestoreUrl() {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${PINGS_COLLECTION}?key=${FIREBASE_API_KEY}`
}

// Κωδικοποίηση τιμής σε Firestore REST value-format.
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'object') {
    const fields = {}
    for (const [k, val] of Object.entries(v)) fields[k] = toValue(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function toFields(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) fields[k] = toValue(v)
  return { fields }
}

// Καθαρισμός stack: αφαίρεση απόλυτων διαδρομών χρήστη (π.χ. Windows username) και
// κράτημα μόνο των κορυφαίων frames. Το πλήρες stack μένει στο τοπικό main.log.
function scrubStack(stack) {
  if (!stack) return ''
  const lines = String(stack).split('\n').slice(0, STACK_TOP_FRAMES + 1)
  return lines
    .map((line) => {
      let s = line
      const idx = s.indexOf('app.asar')
      if (idx >= 0) {
        s = s.slice(idx) // κράτα από το app.asar και μετά (σχετική διαδρομή module)
      } else {
        // Ανωνυμοποίηση φακέλου χρήστη σε κάθε πλατφόρμα.
        s = s
          .replace(/([A-Za-z]:\\Users\\|\/Users\/|\/home\/)[^\\/]+/gi, '$1<user>')
          .replace(/file:\/\/\/?/gi, '')
      }
      return s.trim()
    })
    .join('\n')
    .slice(0, 1500)
}

// POST ενός doc — best-effort. Σε DEBUG τυπώνει το payload· χωρίς backend config
// (μη συμπληρωμένο) απλώς τυπώνει (χρήσιμο για τοπικό test).
async function postDoc(doc) {
  if (DEBUG) {
    try {
      console.log('[telemetry]', JSON.stringify(doc))
    } catch {
      /* noop */
    }
  }
  if (!configured()) return
  try {
    await fetch(firestoreUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFields(doc)),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
  } catch {
    /* σιωπηλή αποτυχία — ποτέ δεν μπλοκάρει/ρίχνει */
  }
}

async function fetchRemoteConfig() {
  if (!CONFIG_URL) return // χωρίς url → μένει το default (enabled)
  try {
    const res = await fetch(`${CONFIG_URL}?_=${Date.now()}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
    if (!res.ok) return
    const j = await res.json()
    if (j && typeof j === 'object') {
      if (typeof j.enabled === 'boolean') remote.enabled = j.enabled
      if (Number.isFinite(j.intervalMin) && j.intervalMin >= 1) remote.intervalMin = j.intervalMin
    }
  } catch {
    /* offline → κράτα τα defaults */
  }
}

// Το μόνιμο (ανά εγκατάσταση) τυχαίο id — δημιουργείται μία φορά, χωρίς PII.
function ensureInstallId() {
  try {
    const s = deps.db.getAllSettings()
    installId = s.telemetry_install_id || ''
    firstSeen = s.telemetry_first_seen || ''
    if (!installId) {
      installId = crypto.randomUUID()
      firstSeen = new Date().toISOString()
      deps.db.setSettings({ telemetry_install_id: installId, telemetry_first_seen: firstSeen })
    }
  } catch {
    // fallback: εφήμερο id (δεν αποθηκεύτηκε) — καλύτερα από καθόλου, χωρίς PII
    if (!installId) installId = crypto.randomUUID()
  }
}

function baseFields() {
  let version = ''
  try {
    version = deps.getVersion ? deps.getVersion() : ''
  } catch {
    /* noop */
  }
  return {
    install_id: installId,
    session_id: sessionId,
    app_version: version,
    os: process.platform,
    arch: process.arch,
    os_release: (() => {
      try {
        return os.release()
      } catch {
        return ''
      }
    })(),
  }
}

async function sendSession() {
  let locale = ''
  let schoolYear = ''
  try {
    locale = deps.getLocale ? deps.getLocale() : ''
  } catch {
    /* noop */
  }
  try {
    schoolYear = deps.getSchoolYear ? deps.getSchoolYear() : ''
  } catch {
    /* noop */
  }
  await postDoc({
    type: 'session',
    ...baseFields(),
    at: new Date().toISOString(),
    locale,
    school_year: schoolYear,
    first_seen: firstSeen,
  })
}

async function sendBeat() {
  if (optedOut() || !remote.enabled) return
  const drained = {}
  for (const [k, v] of counts.entries()) drained[k] = v
  counts.clear()
  await postDoc({
    type: 'beat',
    ...baseFields(),
    at: new Date().toISOString(),
    alive_ms: Math.max(0, Date.now() - startedAt),
    counts: drained,
  })
}

// ── Δημόσιο API ───────────────────────────────────────────────────────────────

// Μετρητής ενέργειας (καλείται από τον IPC wrapper ΜΟΝΟ για channels της allowlist).
function track(channel) {
  try {
    counts.set(channel, (counts.get(channel) || 0) + 1)
  } catch {
    /* noop */
  }
}

// Αναφορά σφάλματος — καθαρισμένη, με dedup ανά συνεδρία ώστε να μη «πλημμυρίζει».
function reportError({ where, err } = {}) {
  try {
    if (optedOut() || !remote.enabled || !started) return
    const e = err || {}
    const name = String(e.name || 'Error').slice(0, 80)
    const message = String(e.message || e || '').slice(0, MAX_MESSAGE_LEN)
    const stack = scrubStack(e.stack || '')
    const key = `${where}|${name}|${message}`
    if (errorsSeen.has(key)) return // ήδη σταλμένο αυτή τη συνεδρία
    errorsSeen.add(key)
    void postDoc({
      type: 'error',
      ...baseFields(),
      at: new Date().toISOString(),
      where: String(where || 'unknown').slice(0, 80),
      name,
      message,
      stack,
    })
  } catch {
    /* noop */
  }
}

// Αρχικοποίηση στην εκκίνηση (main-process). Δεν ρίχνει ποτέ.
async function init(d) {
  try {
    if (started) return
    deps = d || {}
    if (optedOut()) {
      if (DEBUG) console.log('[telemetry] opt-out — παράλειψη')
      return
    }
    if (!configured() && !DEBUG) return // χωρίς backend & χωρίς debug → τίποτα
    ensureInstallId()
    sessionId = crypto.randomUUID()
    startedAt = Date.now()
    await fetchRemoteConfig()
    if (!remote.enabled) {
      if (DEBUG) console.log('[telemetry] remote kill-switch off — παράλειψη')
      return
    }
    started = true
    await sendSession()
    const everyMs = Math.max(1, remote.intervalMin) * 60 * 1000
    timer = setInterval(() => {
      void sendBeat()
    }, everyMs)
    if (timer.unref) timer.unref()
  } catch {
    /* noop */
  }
}

// Τελικό flush στο κλείσιμο — best-effort.
async function flush() {
  try {
    if (!started) return
    await sendBeat()
  } catch {
    /* noop */
  }
}

module.exports = { init, track, reportError, flush }
