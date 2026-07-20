'use strict'

// ---------------------------------------------------------------------------
// Αυτόματες ενημερώσεις (2 επιπέδων) — ΜΟΝΟ πειραματική έκδοση.
//
//  • Σημαντικές (release body περιέχει [major]): στέλνει «available» στο renderer →
//    καρφιτσωμένο banner με «Λήψη». Μετά τη λήψη γίνεται αυτόματη επανεκκίνηση.
//  • Μικρές (body [silent] ή χωρίς ετικέτα = προεπιλογή): κατεβαίνουν & εγκαθίστανται
//    σιωπηλά στο παρασκήνιο, εφαρμόζονται στο επόμενο κλείσιμο (autoInstallOnAppQuit).
//
// Το repo είναι private· το token (electron/updateToken.cjs, γραμμένο από το CI) δίνεται
// στον GitHubProvider μέσω GH_TOKEN. Σε dev ή χωρίς token ο updater μένει ανενεργός.
// ---------------------------------------------------------------------------

const { autoUpdater } = require('electron-updater')

const isDev = !!process.env.VITE_DEV_SERVER_URL

let TOKEN = ''
try {
  TOKEN = require('./updateToken.cjs') || ''
} catch (_e) {
  TOKEN = ''
}

const OWNER = 'diplergasies'
const REPO = 'mathitologio'
const RELEASE_TAG = 'exp-latest'
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

// Διαβάζει τη σοβαρότητα από το σώμα (body) του release `exp-latest`: [major] | [silent].
async function resolveSeverity() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${RELEASE_TAG}`,
      {
        headers: {
          Authorization: `token ${TOKEN}`,
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
  autoUpdater.on('update-available', async (info) => {
    // Αν έχει ήδη ξεκινήσει λήψη (σημαντική ή σιωπηλή), αγνόησε επαναλαμβανόμενες ειδοποιήσεις
    // από τους περιοδικούς ελέγχους — αλλιώς θα «επανερχόταν» το banner ενώ κατεβαίνει.
    if (majorFlow || silentDownloading) return
    const severity = await resolveSeverity()
    if (severity === 'major') {
      majorFlow = false // παραμένει false μέχρι το «Λήψη» — δεν κατεβάζουμε ακόμη
      send({ state: 'available', importance: 'major', version: info.version })
    } else if (!silentDownloading) {
      // Σιωπηλή: κατέβασε στο παρασκήνιο· η εγκατάσταση γίνεται στο κλείσιμο.
      silentDownloading = true
      autoUpdater.downloadUpdate().catch((e) => console.error('updater: silent download', e))
    }
  })

  autoUpdater.on('download-progress', (p) => {
    if (majorFlow) {
      send({ state: 'downloading', importance: 'major', percent: Math.round(p.percent || 0) })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    if (majorFlow) {
      send({ state: 'downloaded', importance: 'major', version: info.version })
      // Μικρή καθυστέρηση ώστε να προλάβει να ζωγραφιστεί το UI, μετά αυτόματη επανεκκίνηση.
      setTimeout(() => {
        try {
          autoUpdater.quitAndInstall(true, true) // σιωπηλή εγκατάσταση + επανεκκίνηση
        } catch (e) {
          console.error('updater: quitAndInstall', e)
        }
      }, 1200)
    }
    // Σιωπηλή: δεν κάνουμε τίποτα — το autoInstallOnAppQuit εγκαθιστά στο κλείσιμο.
  })

  autoUpdater.on('error', (err) => {
    console.error('updater: error', err && err.message ? err.message : err)
  })
}

function init(winGetter, enabledGetter) {
  getWin = typeof winGetter === 'function' ? winGetter : () => null
  isEnabled = typeof enabledGetter === 'function' ? enabledGetter : () => true

  if (isDev) {
    console.log('updater: παράλειψη (dev)')
    return
  }
  if (!TOKEN) {
    console.log('updater: χωρίς token — ανενεργό')
    return
  }
  if (started) return
  started = true

  process.env.GH_TOKEN = TOKEN
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = true
  try {
    autoUpdater.setFeedURL({ provider: 'github', owner: OWNER, repo: REPO, private: true })
  } catch (e) {
    console.error('updater: setFeedURL', e)
  }

  wire()

  checkNow(false) // έλεγχος στην εκκίνηση
  setInterval(() => checkNow(false), CHECK_INTERVAL_MS)
}

// force=true → χειροκίνητος έλεγχος (αγνοεί τον διακόπτη «Αυτόματες ενημερώσεις»).
function checkNow(force) {
  if (!started) return
  if (!force && !isEnabled()) return
  autoUpdater.checkForUpdates().catch((e) => console.error('updater: checkForUpdates', e))
}

// Ενεργοποιείται από το «Λήψη» του banner (μόνο σημαντικές ενημερώσεις).
function startDownload() {
  if (!started) return
  majorFlow = true
  send({ state: 'downloading', importance: 'major', percent: 0 })
  autoUpdater.downloadUpdate().catch((e) => console.error('updater: startDownload', e))
}

function getState() {
  return lastState
}

module.exports = { init, checkNow, startDownload, getState }
