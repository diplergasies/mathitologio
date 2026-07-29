'use strict'

// ---------------------------------------------------------------------------
// Αυτόματες ενημερώσεις (2 επιπέδων) — ΜΟΝΟ πειραματική έκδοση.
//
//  • Σημαντικές (release body περιέχει [major]): στέλνει «available» στο renderer →
//    καρφιτσωμένο banner με «Λήψη». Μετά τη λήψη γίνεται αυτόματη επανεκκίνηση.
//  • Μικρές (body [silent] ή χωρίς ετικέτα = προεπιλογή): κατεβαίνουν & εγκαθίστανται
//    σιωπηλά στο παρασκήνιο, εφαρμόζονται στο επόμενο κλείσιμο (autoInstallOnAppQuit).
//
// Το repo είναι ΔΗΜΟΣΙΟ: τα releases διαβάζονται χωρίς token (δεν ενσωματώνεται μυστικό στην
// εφαρμογή). Σε dev ο updater μένει ανενεργός.
// ---------------------------------------------------------------------------

const { autoUpdater } = require('electron-updater')
const log = require('electron-log/main')

// Καταγραφή σε αρχείο (updater.log μέσα στο φάκελο logs του userData) — ώστε κάθε
// ενημέρωση να αφήνει ίχνος: ανίχνευση, σοβαρότητα, MB/ποσοστό λήψης (delta vs πλήρες),
// εγκατάσταση στο κλείσιμο και σφάλματα. Χωρίς αυτό, προβλήματα σαν το κενό token είναι
// αόρατα.
try {
  log.transports.file.level = 'info'
  log.transports.console.level = 'info'
  log.transports.file.fileName = 'updater.log'
} catch (_e) {
  /* no-op */
}

const isDev = !!process.env.VITE_DEV_SERVER_URL

const OWNER = 'diplergasies'
const REPO = 'mathitologio'
const DEFAULT_SEVERITY = 'silent' // χωρίς ρητή ετικέτα [major]/[silent] → σιωπηλή
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // ~6 ώρες

let getWin = () => null
let isEnabled = () => true
let started = false
let silentDownloading = false // αποφυγή διπλού download για σιωπηλή ενημέρωση
let majorFlow = false // true μόνο αφού ο χρήστης πατήσει «Λήψη» σε σημαντική ενημέρωση
let lastState = { state: 'idle' } // τελευταία κατάσταση (για update:getState μετά από navigation)

function send(next) {
  lastState = next
  const win = getWin()
  if (win && !win.isDestroyed()) win.webContents.send('update:status', next)
}

// Διαβάζει τη σοβαρότητα από το σώμα (body) του πιο πρόσφατου release: [major] | [silent].
// Public repo → χωρίς Authorization header.
async function resolveSeverity() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'mathitologio-updater',
        },
      }
    )
    if (!res.ok) return DEFAULT_SEVERITY
    const json = await res.json()
    const body = (json && json.body) || ''
    if (/\[major\]/i.test(body)) return 'major'
    if (/\[silent\]/i.test(body)) return 'silent'
    return DEFAULT_SEVERITY
  } catch (_e) {
    return DEFAULT_SEVERITY
  }
}

function wire() {
  autoUpdater.on('checking-for-update', () => log.info('updater: έλεγχος για ενημέρωση…'))
  autoUpdater.on('update-not-available', (info) =>
    log.info('updater: καμία ενημέρωση (τρέχουσα =', info && info.version, ')')
  )

  autoUpdater.on('update-available', async (info) => {
    log.info('updater: βρέθηκε έκδοση', info && info.version)
    // Αν έχει ήδη ξεκινήσει λήψη (σημαντική ή σιωπηλή), αγνόησε επαναλαμβανόμενες ειδοποιήσεις
    // από τους περιοδικούς ελέγχους — αλλιώς θα «επανερχόταν» το banner ενώ κατεβαίνει.
    if (majorFlow || silentDownloading) {
      log.info('updater: λήψη ήδη σε εξέλιξη — αγνοώ')
      return
    }
    const severity = await resolveSeverity()
    log.info('updater: σοβαρότητα =', severity)
    if (severity === 'major') {
      majorFlow = false // παραμένει false μέχρι το «Λήψη» — δεν κατεβάζουμε ακόμη
      // Το banner εμφανίζεται ΜΟΝΟ αν ο χρήστης δεν έχει σιγήσει τις ειδοποιήσεις σημαντικών.
      if (isEnabled()) {
        send({ state: 'available', importance: 'major', version: info.version })
      } else {
        log.info('updater: σημαντική ενημέρωση διαθέσιμη αλλά οι ειδοποιήσεις είναι OFF — σιωπή')
      }
    } else if (!silentDownloading) {
      // Σιωπηλή: κατέβασε στο παρασκήνιο· η εγκατάσταση γίνεται στο κλείσιμο.
      silentDownloading = true
      log.info('updater: σιωπηλή λήψη ξεκίνησε στο παρασκήνιο')
      autoUpdater.downloadUpdate().catch((e) => log.error('updater: silent download', e))
    }
  })

  autoUpdater.on('download-progress', (p) => {
    // Πραγματικά bytes δικτύου: σε differential (delta) λήψη το transferred/total είναι
    // πολύ μικρότερα από το πλήρες installer.
    log.info(
      `updater: λήψη ${Math.round(p.percent || 0)}% — ${(p.transferred / 1048576).toFixed(1)}/${(
        p.total / 1048576
      ).toFixed(1)} MB @ ${((p.bytesPerSecond || 0) / 1048576).toFixed(2)} MB/s`
    )
    if (majorFlow) {
      send({ state: 'downloading', importance: 'major', percent: Math.round(p.percent || 0) })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('updater: η λήψη ολοκληρώθηκε —', info && info.version, majorFlow ? '(major)' : '(silent)')
    if (majorFlow) {
      send({ state: 'downloaded', importance: 'major', version: info.version })
      // Καθυστέρηση ώστε ο χρήστης να προλάβει να διαβάσει την προειδοποίηση (η εφαρμογή θα
      // κλείσει, θα εγκατασταθεί η ενημέρωση και θα ανοίξει ξανά μόνη της) πριν κλείσει το UI.
      setTimeout(() => {
        try {
          log.info('updater: quitAndInstall (major)')
          autoUpdater.quitAndInstall(true, true) // σιωπηλή εγκατάσταση + επανεκκίνηση
        } catch (e) {
          log.error('updater: quitAndInstall', e)
        }
      }, 3000)
    } else {
      log.info('updater: σιωπηλή — θα εγκατασταθεί στο επόμενο κλείσιμο (autoInstallOnAppQuit)')
    }
  })

  autoUpdater.on('error', (err) => {
    log.error('updater: ΣΦΑΛΜΑ', err && err.stack ? err.stack : err)
  })
}

function init(winGetter, enabledGetter) {
  getWin = typeof winGetter === 'function' ? winGetter : () => null
  isEnabled = typeof enabledGetter === 'function' ? enabledGetter : () => true

  if (isDev) {
    log.info('updater: παράλειψη (dev)')
    return
  }
  if (started) return
  started = true

  autoUpdater.logger = log
  log.info('updater: init — public repo, χωρίς token, ενεργός')
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false // stable: μόνο κανονικά releases
  // Το differential (delta) download παραμένει ΕΝΕΡΓΟ: σε public repo δουλεύει σωστά, ώστε οι
  // ενημερώσεις να μεταφέρουν μόνο το delta κώδικα (το ~300MB LibreOffice δεν ξανακατεβαίνει).
  try {
    autoUpdater.setFeedURL({ provider: 'github', owner: OWNER, repo: REPO, private: false })
  } catch (e) {
    console.error('updater: setFeedURL', e)
  }

  wire()

  checkNow(false) // έλεγχος στην εκκίνηση
  setInterval(() => checkNow(false), CHECK_INTERVAL_MS)
}

// force=true → χειροκίνητος έλεγχος (αγνοεί τον διακόπτη «Αυτόματες ενημερώσεις»).
// Ο έλεγχος τρέχει ΠΑΝΤΑ (ακόμη κι αν ο διακόπτης είναι off) — έτσι οι σιωπηλές
// ενημερώσεις εφαρμόζονται πάντα. Ο διακόπτης αφορά ΜΟΝΟ την ειδοποίηση (banner) για
// σημαντικές ενημερώσεις (βλ. update-available).
function checkNow(force) {
  if (!started) {
    log.info('updater: checkNow αλλά ο updater δεν είναι ενεργός')
    return
  }
  log.info('updater: checkNow (force =', !!force, ')')
  autoUpdater.checkForUpdates().catch((e) => log.error('updater: checkForUpdates', e))
}

// Ενεργοποιείται από το «Λήψη» του banner (μόνο σημαντικές ενημερώσεις).
function startDownload() {
  if (!started) return
  majorFlow = true
  log.info('updater: ο χρήστης πάτησε «Λήψη» — ξεκινά λήψη σημαντικής ενημέρωσης')
  send({ state: 'downloading', importance: 'major', percent: 0 })
  autoUpdater.downloadUpdate().catch((e) => log.error('updater: startDownload', e))
}

function getState() {
  return lastState
}

module.exports = { init, checkNow, startDownload, getState }
