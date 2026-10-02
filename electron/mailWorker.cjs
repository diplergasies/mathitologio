'use strict'

// Ξεχωριστή διεργασία (Electron utilityProcess) για όλη τη δουλειά IMAP.
// Ρόλος: η σύνδεση/σάρωση/ανάλυση μηνυμάτων να μην τρέχει στο κύριο νήμα — αλλιώς σε μεγάλα
// γραμματοκιβώτια (ή αργό server) το παράθυρο «πάγωνε» και έμενε άσπρο. Μία εντολή ανά διεργασία:
// λαμβάνει { op, args }, απαντά { result } ή { error }· ο main τη σκοτώνει μετά την απάντηση ή σε timeout.

const mail = require('./mail.cjs')

const OPS = new Set(['testConnection', 'checkLatest', 'downloadByUid', 'fetchCalendarMatches', 'fetchAllLists'])

process.parentPort.once('message', async (e) => {
  const { op, args } = (e && e.data) || {}
  try {
    if (!OPS.has(op)) throw new Error(`Άγνωστη λειτουργία e-mail: ${op}`)
    const result = await mail[op](...(Array.isArray(args) ? args : []))
    process.parentPort.postMessage({ result })
  } catch (err) {
    process.parentPort.postMessage({ error: (err && err.message) || String(err) })
  }
})
