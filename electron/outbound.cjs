'use strict'

// Εξερχόμενοι κανόνες (trigger στην εφαρμογή → e-mail ή πακέτο εγγράφων) και ουρά Εκκρεμοτήτων.
// Η αποστολή SMTP γίνεται απέξω (callback), ώστε αυτό το αρχείο να μη φορτώνει το Electron.

const RULES_KEY = 'mail_outbound_rules'

const DEFAULT_SUBJECT = 'Διαγραφή μαθητών — {{school}}'
const DEFAULT_BODY = 'Διεγράφησαν οι μαθητές με τα παρακάτω ΔΙΚΑ:\n{{dikas}}'

function defaultRules() {
  return [
    {
      id: 'rule-deletion',
      trigger: 'student.deleted',
      enabled: false,
      mode: 'confirm',
      cc: '',
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
    },
    {
      id: 'rule-package',
      trigger: 'student.enrolled',
      enabled: false,
      mode: 'confirm',
    },
  ]
}

function loadRules(settings) {
  const s = settings || {}
  if (!s[RULES_KEY]) {
    const rules = defaultRules()
    // Η παλιά ερώτηση «έκδοση πακέτου μετά την εγγραφή» γίνεται κανόνας με έγκριση.
    if (s.enrollDocsPrompt === '1') {
      const pkg = rules.find((r) => r.trigger === 'student.enrolled')
      if (pkg) pkg.enabled = true
    }
    return rules
  }
  try {
    const arr = JSON.parse(s[RULES_KEY])
    return Array.isArray(arr) ? normalizeRules(arr) : defaultRules()
  } catch {
    return defaultRules()
  }
}

function normalizeRules(arr) {
  const byTrigger = new Map(defaultRules().map((r) => [r.trigger, r]))
  for (const raw of arr) {
    if (!raw || !byTrigger.has(raw.trigger)) continue
    const base = byTrigger.get(raw.trigger)
    byTrigger.set(raw.trigger, {
      ...base,
      ...raw,
      id: base.id,
      trigger: base.trigger,
      enabled: raw.enabled === true,
      mode: raw.mode === 'auto' ? 'auto' : 'confirm',
      cc: String(raw.cc || ''),
      subject: String(raw.subject || base.subject || ''),
      body: String(raw.body || base.body || ''),
    })
  }
  return [...byTrigger.values()]
}

function activeRule(rules, trigger) {
  return (rules || []).find((r) => r && r.trigger === trigger && r.enabled === true) || null
}

function idList(ids) {
  return [...new Set((ids || []).map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))]
}

function fill(tpl, map) {
  let s = String(tpl || '')
  for (const [k, v] of Object.entries(map || {})) {
    s = s.split('{{' + k + '}}').join(v == null ? '' : String(v))
  }
  return s
}

// Χωρίζει διευθύνσεις (κόμμα, ελληνικό ερωτηματικό, κενά). Επιστρέφει { ok, addresses } ή { error }.
function parseAddresses(raw) {
  const tokens = String(raw || '')
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  const bad = tokens.filter((t) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))
  if (bad.length) return { error: `Μη έγκυρη διεύθυνση: ${bad[0]}` }
  return { ok: true, addresses: tokens }
}

function enrolledSnapshots(db, ids) {
  const nums = idList(ids)
  if (!nums.length) return []
  return db.query(
    `SELECT s.id, s.dika, s.onoma, s.eponymo, s.school_id,
            sc.name AS school_name, sc.email AS school_email
       FROM students s
       LEFT JOIN schools sc ON sc.id = s.school_id
      WHERE s.status = 'enrolled' AND s.id IN (${nums.join(',')})`
  )
}

function studentBrief(s) {
  return {
    id: s.id,
    dika: s.dika || '',
    onoma: s.onoma || '',
    eponymo: s.eponymo || '',
  }
}

function groupBySchool(rows) {
  const groups = new Map()
  for (const s of rows || []) {
    const key = s.school_id == null || s.school_id === '' ? 'none' : String(s.school_id)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }
  return [...groups.entries()].map(([key, students]) => ({
    schoolId: key === 'none' ? null : Number(key),
    schoolName: students[0].school_name || '',
    students: students.map(studentBrief),
  }))
}

function insertPending(db, kind, payload, now, status) {
  return db.run(
    `INSERT INTO pending_actions (kind, payload, status, created_at, updated_at)
     VALUES ($k, $p, $s, $n, $n)`,
    { $k: kind, $p: JSON.stringify(payload), $s: status || 'open', $n: now }
  )
}

function deletionPayload(group, rule, lastError) {
  return {
    schoolId: group.schoolId,
    schoolName: group.schoolName || '',
    students: group.students,
    cc: String(rule.cc || ''),
    subject: rule.subject || DEFAULT_SUBJECT,
    body: rule.body || DEFAULT_BODY,
    lastError: lastError || null,
  }
}

// Γράφει μία εκκρεμότητα ανά σχολείο. Επιστρέφει πόσα μπήκαν στην ουρά.
function queueDeletionGroups(db, groups, rule, now, lastErrorFor) {
  let queued = 0
  for (const group of groups) {
    const err = lastErrorFor ? lastErrorFor(group) : null
    insertPending(db, 'email_deletion', deletionPayload(group, rule, err), now, err ? 'failed' : 'open')
    queued++
  }
  return queued
}

function deletionMessage(payload, schoolName, schoolEmail) {
  const dikas = (payload.students || []).map((s) => s.dika || '—').join('\n')
  const map = { school: schoolName || payload.schoolName || '', dikas }
  return {
    to: String(schoolEmail || '').trim(),
    cc: String(payload.cc || '').trim(),
    subject: fill(payload.subject || DEFAULT_SUBJECT, map),
    text: fill(payload.body || DEFAULT_BODY, map),
  }
}

// Μετά από εγγραφή: 'auto' (άνοιξε το πακέτο τώρα), 'confirm' (ουρά) ή null (κανόνας κλειστός).
function onEnrolled(db, ids, now) {
  const rule = activeRule(loadRules(db.getAllSettings()), 'student.enrolled')
  const nums = idList(ids)
  if (!rule || !nums.length) return { packageMode: null }
  if (rule.mode === 'auto') return { packageMode: 'auto' }
  insertPending(db, 'create_package', { studentIds: nums }, now, 'open')
  return { packageMode: 'confirm' }
}

function parsePayload(raw) {
  try {
    const v = JSON.parse(raw || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function stillDeleted(db, ids) {
  const nums = idList(ids)
  if (!nums.length) return []
  return db.query(
    `SELECT id, dika, onoma, eponymo, status FROM students WHERE id IN (${nums.join(',')}) AND status = 'deleted'`
  )
}

function stillEnrolled(db, ids) {
  const nums = idList(ids)
  if (!nums.length) return []
  return db.query(
    `SELECT id, dika, onoma, eponymo, status FROM students WHERE id IN (${nums.join(',')}) AND status = 'enrolled'`
  )
}

function closeAction(db, id, status, payload, now) {
  db.run(
    `UPDATE pending_actions SET status=$s, payload=$p, updated_at=$n WHERE id=$id`,
    { $s: status, $p: JSON.stringify(payload), $n: now, $id: id }
  )
}

// Αφαιρεί μαθητές που δεν είναι πια στη σωστή κατάσταση. Άδεια κάρτα κλείνει.
function refreshAction(db, row, now) {
  const payload = parsePayload(row.payload)
  if (row.kind === 'email_deletion') {
    const live = stillDeleted(db, (payload.students || []).map((s) => s.id))
    const byId = new Map(live.map((s) => [Number(s.id), s]))
    const students = (payload.students || [])
      .filter((s) => byId.has(Number(s.id)))
      .map((s) => {
        const cur = byId.get(Number(s.id))
        return { id: cur.id, dika: cur.dika || '', onoma: cur.onoma || '', eponymo: cur.eponymo || '' }
      })
    if (!students.length) {
      closeAction(db, row.id, 'dismissed', { ...payload, students: [] }, now)
      return null
    }
    if (students.length !== (payload.students || []).length) {
      payload.students = students
      db.run(`UPDATE pending_actions SET payload=$p, updated_at=$n WHERE id=$id`, {
        $p: JSON.stringify(payload),
        $n: now,
        $id: row.id,
      })
    } else {
      payload.students = students
    }
    return { row, payload }
  }
  if (row.kind === 'create_package') {
    const live = stillEnrolled(db, payload.studentIds || [])
    const studentIds = live.map((s) => s.id)
    if (!studentIds.length) {
      closeAction(db, row.id, 'dismissed', { ...payload, studentIds: [] }, now)
      return null
    }
    if (studentIds.length !== (payload.studentIds || []).length) {
      payload.studentIds = studentIds
      db.run(`UPDATE pending_actions SET payload=$p, updated_at=$n WHERE id=$id`, {
        $p: JSON.stringify(payload),
        $n: now,
        $id: row.id,
      })
    }
    return { row, payload, students: live.map(studentBrief) }
  }
  return null
}

function schoolLive(db, schoolId) {
  if (schoolId == null) return null
  const rows = db.query('SELECT id, name, email FROM schools WHERE id=$id', { $id: schoolId })
  return rows.length ? rows[0] : null
}

function summary(db, now) {
  const arrivals = db.query(`SELECT COUNT(*) AS c FROM students WHERE status='arrival'`)[0].c
  const noSchool = db.query(
    `SELECT COUNT(*) AS c FROM students WHERE status='enrolled' AND school_id IS NULL`
  )[0].c
  const rows = db.query(
    `SELECT * FROM pending_actions WHERE status IN ('open', 'failed') ORDER BY id DESC`
  )
  const actions = []
  for (const row of rows) {
    const fresh = refreshAction(db, row, now)
    if (!fresh) continue
    if (row.kind === 'email_deletion') {
      const school = schoolLive(db, fresh.payload.schoolId)
      actions.push({
        id: row.id,
        kind: row.kind,
        status: row.status,
        createdAt: row.created_at,
        lastError: fresh.payload.lastError || null,
        schoolId: fresh.payload.schoolId,
        schoolName: (school && school.name) || fresh.payload.schoolName || '',
        schoolEmail: (school && school.email) || '',
        cc: fresh.payload.cc || '',
        students: fresh.payload.students,
      })
    } else if (row.kind === 'create_package') {
      actions.push({
        id: row.id,
        kind: row.kind,
        status: row.status,
        createdAt: row.created_at,
        students: fresh.students,
      })
    }
  }
  return {
    arrivals,
    noSchool,
    actions,
    count: arrivals + noSchool + actions.length,
  }
}

function dismiss(db, id, now) {
  const rows = db.query(`SELECT id FROM pending_actions WHERE id=$id`, { $id: id })
  if (!rows.length) return { error: 'Δεν βρέθηκε η εκκρεμότητα.' }
  db.run(`UPDATE pending_actions SET status='dismissed', updated_at=$n WHERE id=$id`, { $n: now, $id: id })
  return { ok: true }
}

function markPackageStudent(db, actionId, studentId, now) {
  const rows = db.query(
    `SELECT * FROM pending_actions WHERE id=$id AND kind='create_package'`,
    { $id: actionId }
  )
  if (!rows.length) return { error: 'Δεν βρέθηκε η εκκρεμότητα.' }
  const payload = parsePayload(rows[0].payload)
  payload.studentIds = idList(payload.studentIds).filter((n) => n !== Number(studentId))
  if (!payload.studentIds.length) closeAction(db, actionId, 'done', payload, now)
  else {
    db.run(`UPDATE pending_actions SET payload=$p, updated_at=$n WHERE id=$id`, {
      $p: JSON.stringify(payload),
      $n: now,
      $id: actionId,
    })
  }
  return { ok: true, remaining: payload.studentIds.length }
}

// Βγάζει μαθητές από ανοιχτές κάρτες e-mail (επαναφορά ή οριστική διαγραφή).
function pruneStudents(db, ids, now) {
  const drop = new Set(idList(ids))
  if (!drop.size) return
  const rows = db.query(
    `SELECT * FROM pending_actions WHERE kind='email_deletion' AND status IN ('open', 'failed')`
  )
  for (const row of rows) {
    const payload = parsePayload(row.payload)
    const students = (payload.students || []).filter((s) => !drop.has(Number(s.id)))
    if (students.length === (payload.students || []).length) continue
    payload.students = students
    if (!students.length) closeAction(db, row.id, 'dismissed', payload, now)
    else {
      db.run(`UPDATE pending_actions SET payload=$p, updated_at=$n WHERE id=$id`, {
        $p: JSON.stringify(payload),
        $n: now,
        $id: row.id,
      })
    }
  }
}

function loadOpenDeletion(db, id) {
  const rows = db.query(
    `SELECT * FROM pending_actions WHERE id=$id AND kind='email_deletion'`,
    { $id: id }
  )
  return rows.length ? rows[0] : null
}

module.exports = {
  RULES_KEY,
  DEFAULT_SUBJECT,
  DEFAULT_BODY,
  loadRules,
  normalizeRules,
  activeRule,
  enrolledSnapshots,
  groupBySchool,
  queueDeletionGroups,
  deletionPayload,
  deletionMessage,
  parseAddresses,
  onEnrolled,
  summary,
  dismiss,
  markPackageStudent,
  pruneStudents,
  loadOpenDeletion,
  parsePayload,
  refreshAction,
  fill,
}
