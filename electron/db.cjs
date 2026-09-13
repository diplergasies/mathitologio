'use strict'

const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')

let SQL = null
let db = null
let dbPath = null

// Εντοπισμός του sql-wasm.wasm τόσο σε dev όσο και μέσα σε συσκευασμένο app (asar.unpacked).
function resolveWasmPath() {
  let p = require.resolve('sql.js/dist/sql-wasm.wasm')
  if (p.includes('app.asar') && !p.includes('app.asar.unpacked')) {
    p = p.replace('app.asar', 'app.asar.unpacked')
  }
  return p
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  source_filename TEXT,
  school_year TEXT,
  color_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS calendar_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER,
  monada TEXT,
  dika TEXT,
  onoma TEXT,
  eponymo TEXT,
  patronymo TEXT,
  mitronymo TEXT,
  fylo TEXT,
  glossa TEXT,
  ithageneia TEXT,
  imerominia_gennisis TEXT,
  birth_year INTEGER,
  imerominia_afixis TEXT,
  epitropos TEXT NOT NULL DEFAULT 'Όχι',
  computed_type TEXT,
  computed_grade TEXT,
  status TEXT NOT NULL DEFAULT 'arrival',
  prev_status TEXT,
  school_id INTEGER,
  current_grade TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
`

async function init(userDataDir) {
  if (db) return db
  SQL = await initSqlJs({ locateFile: () => resolveWasmPath() })
  dbPath = path.join(userDataDir, 'mathitologio.sqlite')
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }
  db.run(SCHEMA)
  ensureColumn('students', 'deleted_at', 'TEXT')
  ensureColumn('students', 'enrolled_at', 'TEXT')
  // Flags σχολείου για το Παρατηρητήριο (Α1.2/1.3/1.4). Ανεξάρτητα μεταξύ τους.
  ensureColumn('schools', 'dyep', 'INTEGER NOT NULL DEFAULT 0') // έχει ΔΥΕΠ
  ensureColumn('schools', 'ty', 'INTEGER NOT NULL DEFAULT 0') // λειτουργεί Τμήμα Υποδοχής
  // Flags μαθητή (Α1.5 / Α3.1) + λόγος διαγραφής (Γ1/Γ2).
  ensureColumn('students', 'asynodeftos', "TEXT NOT NULL DEFAULT 'Όχι'")
  ensureColumn('students', 'eidiki_agogi', "TEXT NOT NULL DEFAULT 'Όχι'")
  // Ενήλικας μαθητής: οι ενήλικες κατατάσσονται σε κανονική βαθμίδα (μέσω των χειροκίνητων
  // ευρών ηλικίας), άρα δεν διακρίνονται από την ηλικία — χρειάζεται ρητό flag για τη
  // δρομολόγηση της κατηγορίας εγγράφων (αυτο-υπογραφή, ΥΔ-ΖΕΠ ενηλίκων).
  ensureColumn('students', 'enilikas', "TEXT NOT NULL DEFAULT 'Όχι'")
  ensureColumn('students', 'deletion_reason', 'TEXT')
  // Χειροκίνητος χρωματικός κωδικός γραμμής (color code) ανά μαθητή — ώστε διαφορετικοί
  // ΣΕΠ στην ίδια δομή να ξεχωρίζουν τους μαθητές τους. Αποθηκεύεται ως hex ή NULL.
  ensureColumn('students', 'color_code', 'TEXT')
  // Μεταδεδομένα e-mail για λίστες που ήρθαν μέσω αυτόματης εισαγωγής (sch.gr, πειραματικό):
  // ώρα άφιξης (INTERNALDATE, ISO) & Message-ID. Το Message-ID χρησιμεύει ως αξιόπιστο κλειδί
  // dedup ώστε δύο ομώνυμες λίστες της ίδιας ημέρας (ίδιο όνομα PDF) να μη μπερδεύονται.
  ensureColumn('batches', 'email_date', 'TEXT')
  ensureColumn('batches', 'email_message_id', 'TEXT')
  // Backfill: παλαιότεροι εγγεγραμμένοι χωρίς enrolled_at -> updated_at/created_at (καλύτερη εκτίμηση).
  db.run(
    `UPDATE students SET enrolled_at = COALESCE(updated_at, created_at)
      WHERE status='enrolled' AND (enrolled_at IS NULL OR enrolled_at='')`
  )
  markAdults() // αυτόματη σήμανση ενηλίκων (και για τους ήδη εγγεγραμμένους)
  save()
  return db
}

// Ηλικία σε έτη από ημερομηνία γέννησης 'DD/MM/YYYY' έως σήμερα (ή null αν δεν αναλύεται).
function ageFromDisplay(display) {
  const m = String(display || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3])
  const now = new Date()
  let age = now.getFullYear() - y
  // Αφαίρεση 1 αν δεν έχει «κλείσει» ακόμη τα γενέθλια φέτος.
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--
  return age
}

// Σημαίνει ως ενήλικες (enilikas='Ναι') όσους μαθητές είναι ≥18 ετών βάσει σημερινής
// ημ. − ημ. γέννησης. ΜΟΝΟ αναβάθμιση (ποτέ δεν υποβαθμίζει χειροκίνητες τιμές). Idempotent.
function markAdults() {
  if (!db) return
  const rows = query(
    `SELECT id, imerominia_gennisis FROM students
      WHERE enilikas IS NULL OR enilikas <> 'Ναι'`
  )
  const ids = rows.filter((r) => { const a = ageFromDisplay(r.imerominia_gennisis); return a != null && a >= 18 }).map((r) => r.id)
  if (!ids.length) return
  db.run(`UPDATE students SET enilikas='Ναι' WHERE id IN (${ids.map((n) => Number(n)).join(',')})`)
  save()
  return ids.length
}

// Προσθήκη στήλης σε υπάρχοντα πίνακα αν λείπει (migration).
function ensureColumn(table, col, decl) {
  const cols = query(`PRAGMA table_info(${table})`)
  if (!cols.some((c) => c.name === col)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`)
  }
}

function save() {
  if (!db || !dbPath) return
  const data = Buffer.from(db.export())
  fs.writeFileSync(dbPath, data)
}

// SELECT -> array of plain objects.
function query(sql, params = {}) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

// INSERT/UPDATE/DELETE. Επιστρέφει last_insert_rowid για INSERT.
function run(sql, params = {}) {
  db.run(sql, params)
  // Διάβασε το id ΠΡΙΝ το save() — το export() μπορεί να επηρεάσει το last_insert_rowid.
  const r = db.exec('SELECT last_insert_rowid() AS id')
  const id = r.length ? r[0].values[0][0] : null
  save()
  return id
}

function getDbPath() {
  return dbPath
}

// Ρυθμίσεις (key-value). Επιστρέφει αντικείμενο με όλα τα ζεύγη.
function getAllSettings() {
  const rows = query('SELECT key, value FROM settings')
  const out = {}
  rows.forEach((r) => (out[r.key] = r.value))
  return out
}

function setSettings(obj = {}) {
  for (const [key, value] of Object.entries(obj)) {
    run(
      `INSERT INTO settings (key, value) VALUES ($k, $v)
       ON CONFLICT(key) DO UPDATE SET value=$v`,
      { $k: key, $v: value == null ? '' : String(value) }
    )
  }
}

// Αντικατάσταση ολόκληρης της βάσης από buffer (restore backup).
function replaceFromBuffer(buf) {
  if (db) db.close()
  db = new SQL.Database(buf)
  db.run(SCHEMA)
  save()
}

module.exports = {
  init,
  save,
  query,
  run,
  getDbPath,
  replaceFromBuffer,
  getAllSettings,
  setSettings,
  markAdults,
}
