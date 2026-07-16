'use strict'

// Ανάγνωση λίστας πληθυσμού (ΣΕΠ) από γραμματοκιβώτιο sch.gr μέσω IMAP.
// Ρόλος: εντοπισμός του πιο πρόσφατου e-mail που ταιριάζει με τα κριτήρια που όρισε ο χρήστης
// (θέμα / αποστολέας / όνομα PDF, τελευταίες searchDays ημέρες) και λήψη του συνημμένου PDF,
// ώστε να τροφοδοτηθεί ο υπάρχων importer.
// Ταυτοποίηση με ψηφοφορία: αρκεί να ταιριάξουν ≥ 2 από τα ΟΡΙΣΜΕΝΑ κριτήρια (βλ. checkLatest).
// ΜΟΝΟ ανάγνωση — δεν στέλνει/διαγράφει τίποτα.

const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')

const DEFAULT_SEARCH_DAYS = 50

// Κανονικοποίηση για σύγκριση κειμένου: αφαίρεση τόνων (NFD + combining marks), πεζά, trim.
function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// «Περιέχει» με αγνόηση πεζών/κεφαλαίων & τόνων. Κενό/μη ορισμένο κριτήριο → false (δεν μετρά).
function contains(haystack, needle) {
  const n = norm(needle)
  if (!n) return false
  return norm(haystack).includes(n)
}

// Συμβολοσειρά αποστολέα από τον envelope (όνομα + διεύθυνση όλων των from), για αναζήτηση.
function fromString(env) {
  const arr = (env && env.from) || []
  return arr.map((a) => `${(a && a.name) || ''} ${(a && a.address) || ''}`).join(' ')
}

// Συμπλήρωση προεπιλογών στα κριτήρια που έρχονται από το config.
function withDefaults(config) {
  const c = config || {}
  const days = Number(c.searchDays)
  return {
    ...c,
    searchDays: days > 0 ? days : DEFAULT_SEARCH_DAYS,
    subjectMatch: c.subjectMatch || '',
    senderMatch: c.senderMatch || '',
    filenameMatch: c.filenameMatch || '',
  }
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function makeClient(config) {
  return new ImapFlow({
    host: config.host || 'mail.sch.gr',
    port: Number(config.port) || 993,
    secure: true,
    auth: { user: config.username, pass: config.password },
    logger: false,
    // Ανθεκτικότητα σε αργά/ιδιόμορφα servers.
    socketTimeout: 60 * 1000,
    greetingTimeout: 20 * 1000,
    connectionTimeout: 20 * 1000,
  })
}

// Απλός έλεγχος σύνδεσης/ταυτότητας.
async function testConnection(config) {
  const client = makeClient(config)
  try {
    await client.connect()
    await client.logout()
    return { ok: true }
  } catch (err) {
    try { client.close() } catch {}
    return { error: friendly(err) }
  }
}

// Μήνυμα σφάλματος φιλικό προς τον χρήστη.
function friendly(err) {
  const m = (err && err.message ? err.message : String(err)) || 'Άγνωστο σφάλμα'
  if (/auth/i.test(m) || /login/i.test(m) || /credentials/i.test(m))
    return 'Αποτυχία σύνδεσης: λάθος όνομα χρήστη ή κωδικός.'
  if (/timeout/i.test(m) || /ETIMEDOUT|ENOTFOUND|ECONNREFUSED/i.test(m))
    return 'Αποτυχία σύνδεσης με τον διακομιστή (έλεγξε δίκτυο/διακομιστή/θύρα).'
  return `Αποτυχία: ${m}`
}

// Envelope-score ενός μηνύματος: πλήθος ταιριασμάτων στα κριτήρια που ελέγχονται φθηνά (χωρίς λήψη):
// θέμα + αποστολέας. Το κριτήριο ονόματος PDF προστίθεται αργότερα (απαιτεί λήψη συνημμένου).
function envelopeScore(env, cfg) {
  let score = 0
  if (contains((env && env.subject) || '', cfg.subjectMatch)) score++
  if (contains(fromString(env), cfg.senderMatch)) score++
  return score
}

// Εύρεση του πιο πρόσφατου υποψήφιου μηνύματος σε έναν φάκελο (τελευταίες cfg.searchDays ημέρες).
// Υποψήφιο = envScore ≥ 1. Επιλογή με προτεραιότητα (envScore ↓, ημερομηνία ↓).
// Επιστρέφει { uid, date, subject, from, envScore, t } ή null. Ο φάκελος πρέπει να είναι locked.
async function findLatestInOpen(client, cfg) {
  const uids = await client.search({ since: daysAgo(cfg.searchDays) }, { uid: true })
  if (!uids || !uids.length) return null

  let best = null
  for await (const msg of client.fetch({ uid: uids }, { uid: true, envelope: true })) {
    const env = msg.envelope || {}
    const envScore = envelopeScore(env, cfg)
    if (envScore < 1) continue
    const date = env.date || null
    const t = date ? new Date(date).getTime() : 0
    if (!best || envScore > best.envScore || (envScore === best.envScore && t > best.t))
      best = { uid: msg.uid, date, subject: env.subject || '', from: fromString(env), envScore, t }
  }
  return best
}

// Εύρεση του καλύτερου υποψήφιου μηνύματος σε ΟΛΟΥΣ τους φακέλους του γραμματοκιβωτίου.
// Επιστρέφει { mailbox, uid, date, subject, from, envScore } ή null.
async function findLatestAllFolders(client, cfg) {
  let best = null // { mailbox, uid, date, subject, from, envScore, t }
  const boxes = await client.list()
  for (const box of boxes) {
    // Παράλειψη μη-επιλέξιμων φακέλων (π.χ. containers).
    if (box.flags && (box.flags.has ? box.flags.has('\\Noselect') : false)) continue
    let lock = null
    try {
      lock = await client.getMailboxLock(box.path)
      const hit = await findLatestInOpen(client, cfg)
      if (hit && (!best || hit.envScore > best.envScore || (hit.envScore === best.envScore && hit.t > best.t)))
        best = { mailbox: box.path, ...hit }
    } catch {
      // Αγνόησε φακέλους που δεν ανοίγουν και συνέχισε στους υπόλοιπους.
    } finally {
      if (lock) try { lock.release() } catch {}
    }
  }
  if (!best) return null
  return { mailbox: best.mailbox, uid: best.uid, date: best.date, subject: best.subject, from: best.from, envScore: best.envScore }
}

// Λήψη πλήρους μηνύματος + εξαγωγή του πρώτου συνημμένου PDF (φάκελος ήδη ανοιχτός).
// Επιστρέφει { filename, content: Buffer } ή null.
async function fetchPdfAttachment(client, uid) {
  const msg = await client.fetchOne(uid, { source: true }, { uid: true })
  if (!msg || !msg.source) return null
  const parsed = await simpleParser(msg.source)
  const atts = parsed.attachments || []
  let pdf = atts.find((a) => /\.pdf$/i.test(a.filename || '') || /pdf/i.test(a.contentType || ''))
  if (!pdf) return null
  return { filename: (pdf.filename || 'ΣΕΠ.pdf').trim(), content: pdf.content }
}

// Σύνθετη: σύνδεση → εντοπισμός καλύτερου υποψήφιου σε όλους τους φακέλους → λήψη συνημμένου PDF →
// τελική ταυτοποίηση με ψηφοφορία «≥ 2 ορισμένα κριτήρια» (θέμα/αποστολέας envelope + όνομα PDF).
// Αν ταυτότητα (mailbox+uid) == known, παραλείπεται η (βαριά) λήψη και επιστρέφεται unchanged.
// Επιστρέφει { ok, found, mailbox, uid, date, subject, filename, content } ή { error }.
async function checkLatest(config, known) {
  const cfg = withDefaults(config)
  const client = makeClient(cfg)
  try {
    await client.connect()
    const latest = await findLatestAllFolders(client, cfg)
    if (!latest) return { ok: true, found: false }
    // Ήδη γνωστό μήνυμα: είχε ήδη περάσει τον έλεγχο ≥2 όταν εντοπίστηκε — δεν ξανακατεβαίνει.
    if (known && known.mailbox === latest.mailbox && known.uid === latest.uid) {
      return { ok: true, found: true, unchanged: true, ...latest }
    }
    let lock = null
    let att = null
    try {
      lock = await client.getMailboxLock(latest.mailbox)
      att = await fetchPdfAttachment(client, latest.uid)
    } finally {
      if (lock) try { lock.release() } catch {}
    }
    if (!att) return { ok: true, found: false, noAttachment: true, subject: latest.subject }
    // Ψηφοφορία: envScore (θέμα+αποστολέας) + όνομα PDF. Ταυτοποίηση αν ≥ 2 ορισμένα κριτήρια ταιριάξουν.
    const nameMatch = contains(att.filename, cfg.filenameMatch) ? 1 : 0
    if (latest.envScore + nameMatch < 2) return { ok: true, found: false }
    return { ok: true, found: true, ...latest, ...att }
  } catch (err) {
    return { error: friendly(err) }
  } finally {
    try { await client.logout() } catch { try { client.close() } catch {} }
  }
}

// Σύνθετη: σύνδεση → λήψη συνημμένου PDF συγκεκριμένου μηνύματος (φάκελος + uid).
// Επιστρέφει { ok, filename, content } ή { error }.
async function downloadByUid(config, mailbox, uid) {
  const client = makeClient(config)
  try {
    await client.connect()
    let lock = null
    let att = null
    try {
      lock = await client.getMailboxLock(mailbox || 'INBOX')
      att = await fetchPdfAttachment(client, uid)
    } finally {
      if (lock) try { lock.release() } catch {}
    }
    if (!att) return { error: 'Δεν βρέθηκε συνημμένο PDF στο μήνυμα.' }
    return { ok: true, ...att }
  } catch (err) {
    return { error: friendly(err) }
  } finally {
    try { await client.logout() } catch { try { client.close() } catch {} }
  }
}

module.exports = { testConnection, checkLatest, downloadByUid, norm, contains, DEFAULT_SEARCH_DAYS }
