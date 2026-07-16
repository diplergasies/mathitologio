'use strict'

// Ανάγνωση λίστας πληθυσμού (ΣΕΠ) από γραμματοκιβώτιο sch.gr μέσω IMAP.
// Ρόλος: εντοπισμός του πιο πρόσφατου e-mail με θέμα «Λίστα πληθυσμού … (ΣΕΠ)» (τελευταίες
// SEARCH_DAYS ημέρες) και λήψη του συνημμένου PDF, ώστε να τροφοδοτηθεί ο υπάρχων importer.
// ΜΟΝΟ ανάγνωση — δεν στέλνει/διαγράφει τίποτα.

const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')

const SEARCH_DAYS = 50
const SUBJECT_MATCH = 'λίστα πληθυσμού' // πεζά, χωρίς τόνους-ευαισθησία μέσω toLowerCase

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

// Εύρεση του πιο πρόσφατου μηνύματος-λίστας σε έναν φάκελο (τελευταίες SEARCH_DAYS ημέρες).
// Επιστρέφει { uid, date, subject, t } ή null. Ο φάκελος πρέπει να είναι ήδη ανοιχτός (locked).
async function findLatestInOpen(client) {
  const uids = await client.search({ since: daysAgo(SEARCH_DAYS) }, { uid: true })
  if (!uids || !uids.length) return null

  let best = null
  for await (const msg of client.fetch({ uid: uids }, { uid: true, envelope: true })) {
    const subject = (msg.envelope && msg.envelope.subject) || ''
    if (!subject.toLowerCase().includes(SUBJECT_MATCH)) continue
    const date = (msg.envelope && msg.envelope.date) || null
    const t = date ? new Date(date).getTime() : 0
    if (!best || t > best.t) best = { uid: msg.uid, date, subject, t }
  }
  return best
}

// Εύρεση του πιο πρόσφατου μηνύματος-λίστας σε ΟΛΟΥΣ τους φακέλους του γραμματοκιβωτίου.
// Επιστρέφει { mailbox, uid, date, subject } ή null.
async function findLatestAllFolders(client) {
  let best = null // { mailbox, uid, date, subject, t }
  const boxes = await client.list()
  for (const box of boxes) {
    // Παράλειψη μη-επιλέξιμων φακέλων (π.χ. containers).
    if (box.flags && (box.flags.has ? box.flags.has('\\Noselect') : false)) continue
    let lock = null
    try {
      lock = await client.getMailboxLock(box.path)
      const hit = await findLatestInOpen(client)
      if (hit && (!best || hit.t > best.t)) best = { mailbox: box.path, ...hit }
    } catch {
      // Αγνόησε φακέλους που δεν ανοίγουν και συνέχισε στους υπόλοιπους.
    } finally {
      if (lock) try { lock.release() } catch {}
    }
  }
  if (!best) return null
  return { mailbox: best.mailbox, uid: best.uid, date: best.date, subject: best.subject }
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

// Σύνθετη: σύνδεση → εντοπισμός πιο πρόσφατης λίστας σε όλους τους φακέλους → λήψη συνημμένου PDF.
// Αν ταυτότητα (mailbox+uid) == known, παραλείπεται η (βαριά) λήψη και επιστρέφεται unchanged.
// Επιστρέφει { ok, found, mailbox, uid, date, subject, filename, content } ή { error }.
async function checkLatest(config, known) {
  const client = makeClient(config)
  try {
    await client.connect()
    const latest = await findLatestAllFolders(client)
    if (!latest) return { ok: true, found: false }
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

module.exports = { testConnection, checkLatest, downloadByUid, SEARCH_DAYS }
