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
  // Backfill: παλαιότεροι εγγεγραμμένοι χωρίς enrolled_at -> updated_at/created_at (καλύτερη εκτίμηση).
  db.run(
    `UPDATE students SET enrolled_at = COALESCE(updated_at, created_at)
      WHERE status='enrolled' AND (enrolled_at IS NULL OR enrolled_at='')`
  )
  save()
  return db
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
}
