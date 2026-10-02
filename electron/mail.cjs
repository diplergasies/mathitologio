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
  const client = new ImapFlow({
    host: config.host || 'mail.sch.gr',
    port: Number(config.port) || 993,
    secure: true,
    auth: { user: config.username, pass: config.password },
    logger: false,
    // Ανθεκτικότητα σε αργά/ιδιόμορφα servers (το sch.gr καθυστερεί κατά διαστήματα).
    socketTimeout: 5 * 60 * 1000,
    greetingTimeout: 20 * 1000,
    connectionTimeout: 20 * 1000,
  })
  // Χωρίς listener, ένα 'error' (π.χ. Socket timeout) γίνεται uncaughtException. Οι εκκρεμείς
  // εντολές απορρίπτονται ούτως ή άλλως· ο έλεγχος γίνεται μέσω connectionLost().
  client.on('error', () => {})
  return client
}

// Η σύνδεση κόπηκε (timeout/αποσύνδεση) — όλα τα επόμενα βήματα θα αποτύχουν.
function connectionLost(client) {
  return !client.usable
}

// Επιλέξιμοι φάκελοι προς σάρωση: INBOX πρώτα, μετά οι υπόλοιποι.
async function listSelectable(client) {
  const boxes = (await client.list()).filter(
    (box) => !(box.flags && (box.flags.has ? box.flags.has('\\Noselect') : false))
  )
  const isInbox = (b) => String(b.path).toUpperCase() === 'INBOX'
  return [...boxes.filter(isInbox), ...boxes.filter((b) => !isInbox(b))]
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
  // Το imapflow δίνει γενικό «Command failed» σε λάθος κωδικό — η πραγματική αιτία είναι στα πεδία.
  if (err && err.authenticationFailed) return 'Αποτυχία σύνδεσης: λάθος όνομα χρήστη ή κωδικός.'
  const detail = err && (err.responseText || err.serverResponseCode)
  if (/auth/i.test(m) || /login/i.test(m) || /credentials/i.test(m))
    return 'Αποτυχία σύνδεσης: λάθος όνομα χρήστη ή κωδικός.'
  if (/timeout/i.test(m) || /ETIMEDOUT|ENOTFOUND|ECONNREFUSED/i.test(m))
    return 'Αποτυχία σύνδεσης με τον διακομιστή (έλεγξε δίκτυο/διακομιστή/θύρα).'
  if (/certificate|self.signed|CERT_/i.test(m))
    return 'Αποτυχία ασφαλούς σύνδεσης (πιστοποιητικό). Πιθανόν το antivirus ελέγχει την αλληλογραφία — απενεργοποίησε τον έλεγχο e-mail/SSL του antivirus ή δοκίμασε από άλλο δίκτυο.'
  return detail ? `Αποτυχία: ${m} (${detail})` : `Αποτυχία: ${m}`
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
  for await (const msg of client.fetch({ uid: uids }, { uid: true, envelope: true, internalDate: true })) {
    const env = msg.envelope || {}
    const envScore = envelopeScore(env, cfg)
    if (envScore < 1) continue
    // INTERNALDATE = πραγματική ώρα άφιξης στο mailbox (πιο αξιόπιστη σειρά/ώρα από το header
    // Date:, που τον ορίζει ο αποστολέας). Fallback στο header μόνο αν λείπει.
    const date = msg.internalDate || env.date || null
    const t = date ? new Date(date).getTime() : 0
    if (!best || envScore > best.envScore || (envScore === best.envScore && t > best.t))
      best = {
        uid: msg.uid,
        date,
        messageId: (env.messageId || '').trim(),
        subject: env.subject || '',
        from: fromString(env),
        envScore,
        t,
      }
  }
  return best
}

// Εύρεση του καλύτερου υποψήφιου μηνύματος σε ΟΛΟΥΣ τους φακέλους του γραμματοκιβωτίου.
// Επιστρέφει { mailbox, uid, date, subject, from, envScore } ή null.
async function findLatestAllFolders(client, cfg) {
  let best = null // { mailbox, uid, date, subject, from, envScore, t }
  const boxes = await listSelectable(client)
  for (const box of boxes) {
    let lock = null
    try {
      lock = await client.getMailboxLock(box.path)
      const hit = await findLatestInOpen(client, cfg)
      if (hit && (!best || hit.envScore > best.envScore || (hit.envScore === best.envScore && hit.t > best.t)))
        best = { mailbox: box.path, ...hit }
    } catch (err) {
      // Κομμένη σύνδεση → σφάλμα (όχι σιωπηλό «δεν βρέθηκε»). Αλλιώς αγνόησε τον φάκελο.
      if (connectionLost(client)) throw err
    } finally {
      if (lock) try { lock.release() } catch {}
    }
  }
  if (!best) return null
  return {
    mailbox: best.mailbox,
    uid: best.uid,
    date: best.date,
    messageId: best.messageId || '',
    subject: best.subject,
    from: best.from,
    envScore: best.envScore,
  }
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
    let meta = { messageId: '', date: null }
    try {
      lock = await client.getMailboxLock(mailbox || 'INBOX')
      att = await fetchPdfAttachment(client, uid)
      // Μεταδεδομένα μηνύματος (Message-ID + INTERNALDATE) για dedup & ένδειξη ώρας άφιξης.
      try {
        const info = await client.fetchOne(uid, { envelope: true, internalDate: true }, { uid: true })
        if (info) {
          meta = {
            messageId: ((info.envelope && info.envelope.messageId) || '').trim(),
            date: info.internalDate || (info.envelope && info.envelope.date) || null,
          }
        }
      } catch {}
    } finally {
      if (lock) try { lock.release() } catch {}
    }
    if (!att) return { error: 'Δεν βρέθηκε συνημμένο PDF στο μήνυμα.' }
    return { ok: true, ...att, messageId: meta.messageId, date: meta.date }
  } catch (err) {
    return { error: friendly(err) }
  } finally {
    try { await client.logout() } catch { try { client.close() } catch {} }
  }
}

// Αποκωδικοποίηση ονόματος αρχείου από bodyStructure (encoded-words =?UTF-8?B?...?=), best-effort.
function decodeName(s) {
  try {
    return require('libmime').decodeWords(String(s || ''))
  } catch {
    return String(s || '')
  }
}

// Όνομα του πρώτου συνημμένου PDF από το bodyStructure (χωρίς λήψη του μηνύματος) ή ''.
function pdfNameFromStructure(node) {
  if (!node) return ''
  const name = decodeName(
    (node.dispositionParameters && node.dispositionParameters.filename) ||
      (node.parameters && node.parameters.name) ||
      ''
  )
  if (/\.pdf$/i.test(name) || /pdf/i.test(node.type || '')) return name || 'ΣΕΠ.pdf'
  for (const child of node.childNodes || []) {
    const n = pdfNameFromStructure(child)
    if (n) return n
  }
  return ''
}

// Πρώτη χρήση (άδεια βάση): ΟΛΕΣ οι λίστες των τελευταίων searchDays ημερών, σε όλους τους φακέλους.
// Ταυτοποίηση όπως στο checkLatest (≥ 2 ορισμένα κριτήρια), αλλά το όνομα PDF ελέγχεται από το
// bodyStructure ώστε να κατεβαίνουν ΜΟΝΟ τα μηνύματα που ταιριάζουν. Ίδιο μήνυμα σε πολλούς φακέλους
// (ίδιο Message-ID) μετράει μία φορά. Επιστρέφει { ok, lists: [{ mailbox, uid, date, messageId,
// subject, filename, content }] } σε ΧΡΟΝΟΛΟΓΙΚΗ σειρά (παλαιότερη πρώτη) ή { error }.
const MAX_BULK_LISTS = 40
async function fetchAllLists(config) {
  const cfg = withDefaults(config)
  const client = makeClient(cfg)
  try {
    await client.connect()
    const found = new Map() // κλειδί (Message-ID ή φάκελος:uid) → υποψήφιο
    for (const box of await listSelectable(client)) {
      let lock = null
      try {
        lock = await client.getMailboxLock(box.path)
        const uids = await client.search({ since: daysAgo(cfg.searchDays) }, { uid: true })
        if (!uids || !uids.length) continue
        const q = { uid: true, envelope: true, internalDate: true, bodyStructure: true }
        for await (const msg of client.fetch({ uid: uids }, q)) {
          const env = msg.envelope || {}
          const envScore = envelopeScore(env, cfg)
          if (envScore < 1) continue
          const pdfName = pdfNameFromStructure(msg.bodyStructure)
          if (!pdfName) continue
          if (envScore + (contains(pdfName, cfg.filenameMatch) ? 1 : 0) < 2) continue
          const messageId = (env.messageId || '').trim()
          const key = messageId || `${box.path}:${msg.uid}`
          if (found.has(key)) continue
          const date = msg.internalDate || env.date || null
          found.set(key, {
            mailbox: box.path,
            uid: msg.uid,
            date,
            t: date ? new Date(date).getTime() : 0,
            messageId,
            subject: env.subject || '',
          })
        }
      } catch (err) {
        if (connectionLost(client)) throw err
      } finally {
        if (lock) try { lock.release() } catch {}
      }
    }
    // Οι πιο πρόσφατες MAX_BULK_LISTS, σε χρονολογική σειρά.
    const picked = [...found.values()].sort((a, b) => a.t - b.t).slice(-MAX_BULK_LISTS)
    const lists = []
    for (const c of picked) {
      let lock = null
      try {
        lock = await client.getMailboxLock(c.mailbox)
        const att = await fetchPdfAttachment(client, c.uid)
        if (!att) continue
        lists.push({
          mailbox: c.mailbox,
          uid: c.uid,
          date: c.date,
          messageId: c.messageId,
          subject: c.subject,
          filename: att.filename,
          content: att.content,
        })
      } catch (err) {
        if (connectionLost(client)) throw err
      } finally {
        if (lock) try { lock.release() } catch {}
      }
    }
    return { ok: true, lists }
  } catch (err) {
    return { error: friendly(err) }
  } finally {
    try { await client.logout() } catch { try { client.close() } catch {} }
  }
}

// Καθαρισμός HTML σε απλό κείμενο (πρόχειρο) — fallback όταν λείπει το text/plain μέρος.
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Έλεγχος αν ένα μήνυμα (envelope) ταιριάζει σε κανόνα «e-mail → Ημερολόγιο».
// Κανόνας: { senderMatch (υποχρεωτικό), subjectMatch? }. Ταιριάζει αν ο αποστολέας περιέχει
// το senderMatch ΚΑΙ (αν οριστεί) το θέμα περιέχει το subjectMatch.
function ruleMatches(env, rule) {
  if (!rule || !rule.senderMatch || !String(rule.senderMatch).trim()) return false
  if (!contains(fromString(env), rule.senderMatch)) return false
  if (rule.subjectMatch && String(rule.subjectMatch).trim() && !contains((env && env.subject) || '', rule.subjectMatch))
    return false
  return true
}

// Σάρωση όλων των φακέλων (INBOX πρώτα) για μηνύματα που ταιριάζουν στους κανόνες (τελευταίες
// searchDays ημέρες). Ο αποστολέας αναζητείται στον server (IMAP FROM: substring, χωρίς διάκριση
// πεζών/κεφαλαίων), ώστε να μην κατεβαίνουν οι envelopes όλων των μηνυμάτων· το τελικό ταίριασμα
// (π.χ. θέμα με τόνους) γίνεται τοπικά με ruleMatches μόνο στα ευρήματα.
// Παραλείπει μηνύματα με Message-ID που υπάρχει ήδη στο knownIds (Set) — φθηνό, χωρίς λήψη σώματος.
// Για τα ταιριάσματα κατεβάζει το σώμα (text/plain ή fallback από HTML).
// Επιστρέφει { ok, matches: [{ messageId, date, subject, body, ruleId }] } ή, αν κοπεί η σύνδεση,
// { error, matches } με όσα είχαν ήδη συλλεχθεί (ώστε να εισαχθούν).
// ΜΟΝΟ ανάγνωση.
async function fetchCalendarMatches(config, rules, knownIds) {
  const cfg = withDefaults(config)
  const activeRules = (rules || []).filter((r) => r && r.enabled !== false && r.senderMatch)
  if (!activeRules.length) return { ok: true, matches: [] }
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds || [])
  const client = makeClient(cfg)
  const matches = []
  try {
    await client.connect()
    const boxes = await listSelectable(client)
    for (const box of boxes) {
      let lock = null
      try {
        lock = await client.getMailboxLock(box.path)
        const since = daysAgo(cfg.searchDays)
        const uidSet = new Set()
        for (const rule of activeRules) {
          const uids = await client.search({ since, from: String(rule.senderMatch).trim() }, { uid: true })
          for (const u of uids || []) uidSet.add(u)
        }
        if (!uidSet.size) continue
        // 1ο πέρασμα (φθηνό): envelopes μόνο των ευρημάτων → ταίριασμα κανόνα & dedup.
        const candidates = [] // { uid, messageId, date, subject, ruleId }
        for await (const msg of client.fetch({ uid: [...uidSet] }, { uid: true, envelope: true, internalDate: true })) {
          const env = msg.envelope || {}
          const messageId = (env.messageId || '').trim()
          if (messageId && known.has(messageId)) continue
          const rule = activeRules.find((r) => ruleMatches(env, r))
          if (!rule) continue
          candidates.push({
            uid: msg.uid,
            messageId,
            date: msg.internalDate || env.date || null,
            subject: env.subject || '(χωρίς θέμα)',
            ruleId: rule.id,
          })
        }
        // 2ο πέρασμα: κατέβασε σώμα μόνο για τα υποψήφια.
        for (const c of candidates) {
          let body = ''
          try {
            const full = await client.fetchOne(c.uid, { source: true }, { uid: true })
            if (full && full.source) {
              const parsed = await simpleParser(full.source)
              body = (parsed.text && parsed.text.trim()) || htmlToText(parsed.html) || ''
            }
          } catch (err) {
            if (connectionLost(client)) throw err
            // αλλιώς: σημείωση χωρίς σώμα
          }
          matches.push({ messageId: c.messageId, date: c.date, subject: c.subject, body, ruleId: c.ruleId })
        }
      } catch (err) {
        // Κομμένη σύνδεση → διακοπή με σφάλμα· αλλιώς αγνόησε τον φάκελο (π.χ. δεν ανοίγει).
        if (connectionLost(client)) throw err
      } finally {
        if (lock) try { lock.release() } catch {}
      }
    }
    return { ok: true, matches }
  } catch (err) {
    return { error: friendly(err), matches }
  } finally {
    try { await client.logout() } catch { try { client.close() } catch {} }
  }
}

module.exports = { testConnection, checkLatest, downloadByUid, fetchCalendarMatches, fetchAllLists, norm, contains, DEFAULT_SEARCH_DAYS }
