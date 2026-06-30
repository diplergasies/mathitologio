'use strict'

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const fs = require('fs')
const path = require('path')

const db = require('./db.cjs')
const grades = require('./grades.cjs')
const importer = require('./importer.cjs')
const documents = require('./documents.cjs')

const isDev = !!process.env.VITE_DEV_SERVER_URL

// Απενεργοποίηση επιτάχυνσης υλικού: η εφαρμογή δεν είναι γραφικά απαιτητική και έτσι
// αποφεύγονται προβλήματα GPU driver σε ποικίλα μηχανήματα (και headless περιβάλλοντα).
app.disableHardwareAcceleration()

// Παλέτα απαλών αποχρώσεων ανά batch (κυκλική) — αναφορά· η απόδοση γίνεται στο renderer.
const BATCH_COLOR_COUNT = 8

function resourcesDir() {
  return isDev ? path.join(__dirname, '..', 'resources') : process.resourcesPath
}

function templatesDir() {
  return isDev
    ? path.join(__dirname, '..', 'resources', 'templates')
    : path.join(process.resourcesPath, 'templates')
}

// Φάκελος προτύπων χρήστη — επιβιώνει στα updates (όπως η βάση & το προφίλ LibreOffice).
function userTemplatesDir() {
  return path.join(app.getPath('userData'), 'templates')
}

// Επίλυση διαδρομής προτύπου: τα πρότυπα χρήστη υπερισχύουν των ενσωματωμένων (ίδιο όνομα).
function resolveTemplatePath(file) {
  const u = path.join(userTemplatesDir(), file)
  if (fs.existsSync(u)) return u
  return path.join(templatesDir(), file)
}

function nowIso() {
  return new Date().toISOString()
}

function todayDisplay() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Έτος έναρξης σχολικού έτους: από τις Ρυθμίσεις (αν οριστεί) αλλιώς αυτόματο από την ημερομηνία.
function getSchoolYearStart() {
  const v = db.getAllSettings().schoolYearStart
  return v ? Number(v) : grades.currentSchoolYearStart()
}

// Χειροκίνητα εύρη ετών γέννησης ανά βαθμίδα (αν έχουν οριστεί στις Ρυθμίσεις).
// Επιστρέφει πίνακα [{ type, fromYear, toYear }] ή null (→ classify πέφτει σε defaults).
function getGradeRanges() {
  const v = db.getAllSettings().gradeRanges
  if (!v) return null
  try {
    const parsed = JSON.parse(v)
    return Array.isArray(parsed) && parsed.length ? parsed : null
  } catch {
    return null
  }
}

// Δημιουργεί το dictionary tokens για ένα μαθητή (κοινό σε ατομική & μαζική έκδοση).
function buildDocData(s, cfg) {
  return {
    'Όνομα': s.onoma,
    'Επώνυμο': s.eponymo,
    'Πατρώνυμο': s.patronymo,
    'Μητρώνυμο': s.mitronymo,
    'ΔΙΚΑ': s.dika,
    'Φύλο': s.fylo,
    'ΦΥΛΟ': s.fylo,
    'Γλώσσα': s.glossa,
    'Ιθαγένεια': s.ithageneia,
    'ΗμΓεν': s.imerominia_gennisis,
    'Ημερομηνία γέννησης': s.imerominia_gennisis,
    'ΗμΑφιξης': s.imerominia_afixis,
    'Μονάδα': s.monada,
    'Σχολείο': s.school_name || '',
    'Τύπος': s.school_type || '',
    'Τάξη': s.current_grade || s.computed_grade || '',
    'TAXI': s.current_grade || s.computed_grade || '',
    'Επίτροπος': s.epitropos,
    'ΣΕΠ': cfg.sep || '',
    'Νομός': cfg.nomos || '',
    'Δομή': cfg.domi || '',
    'PERIF': cfg.perif || '',
    'DATE': todayDisplay(),
    'Ημερομηνία': todayDisplay(),
  }
}

// Όλα τα tokens που γεμίζει η εφαρμογή (για προειδοποίηση άγνωστων σε πρότυπα χρήστη).
const KNOWN_TOKENS = Object.keys(buildDocData({}, {})).concat(['signee', 'signee.prop'])

// Υπολογισμός υπογράφοντα ({{signee}}, {{signee.prop}}) βάσει της επιλογής του χρήστη.
// choice: { type: 'father'|'mother'|'sep'|'other', name?, prop? }
function computeSignee(s, cfg, choice) {
  const surname = s.eponymo || ''
  if (!choice) return { signee: '', prop: '' }
  switch (choice.type) {
    case 'father':
      return { signee: `${s.patronymo || ''} ${surname}`.trim(), prop: 'πατέρας' }
    case 'mother':
      return { signee: `${s.mitronymo || ''} ${surname}`.trim(), prop: 'μητέρα' }
    case 'sep':
      return { signee: cfg.sep || '', prop: 'ΣΕΠ' }
    case 'other':
      return { signee: choice.name || '', prop: choice.prop || '' }
    default:
      return { signee: '', prop: '' }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Μαθητολόγιο ΣΕΠ',
    show: false, // εμφανίζεται μεγιστοποιημένο όταν είναι έτοιμο (χωρίς αναβόσβημα)
    // Σε dev δείχνουμε το εικονίδιο στο παράθυρο/taskbar· στο packaged το αναλαμβάνει το .exe.
    ...(isDev ? { icon: path.join(__dirname, '..', 'build', 'icon.png') } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setMenuBarVisibility(false)

  // Εκκίνηση με μεγιστοποιημένο παράθυρο.
  win.once('ready-to-show', () => {
    win.maximize()
    win.show()
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// ---------------------------------------------------------------- IPC handlers

ipcMain.handle('app:info', () => {
  const S = getSchoolYearStart()
  // Πρώτη εκκίνηση: καμία ρύθμιση ΣΕΠ συμπληρωμένη ΚΑΙ κανένα σχολείο καταχωρημένο.
  const cfg = db.getAllSettings()
  const schoolsCount = db.query('SELECT COUNT(*) AS c FROM schools')[0].c
  const firstRun = !cfg.sep && !cfg.perif && !cfg.nomos && !cfg.domi && schoolsCount === 0
  return {
    version: app.getVersion(),
    schoolYearStart: S,
    schoolYearLabel: grades.schoolYearLabel(S),
    firstRun,
  }
})

// Πίνακας τύπων σχολείου + ρυθμιζόμενο έτος Νηπιαγωγείου.
ipcMain.handle('schoolYear:get', () => {
  const S = getSchoolYearStart()
  return {
    schoolYearStart: S,
    schoolYearLabel: grades.schoolYearLabel(S),
    nipYear: grades.nipiagogeioYear(S),
    table: grades.gradeTable(S),
    ranges: getGradeRanges() || grades.defaultRanges(S),
  }
})

// Κανονικοποίηση χειροκίνητων ευρών: ακέραιοι, fromYear ≤ toYear, μόνο γνωστές βαθμίδες.
function normalizeRanges(ranges, S) {
  const defaults = grades.defaultRanges(S)
  return defaults.map((d) => {
    const r = Array.isArray(ranges) ? ranges.find((x) => x && x.type === d.type) : null
    let from = r != null ? Math.trunc(Number(r.fromYear)) : NaN
    let to = r != null ? Math.trunc(Number(r.toYear)) : NaN
    if (!Number.isFinite(from)) from = d.fromYear
    if (!Number.isFinite(to)) to = d.toYear
    if (from > to) [from, to] = [to, from]
    return { type: d.type, fromYear: from, toYear: to }
  })
}

ipcMain.handle('schoolYear:set', (_e, payload) => {
  // Οπισθοσυμβατότητα: αποδοχή είτε σκέτου number (παλιό) είτε { nipYear, ranges }.
  const nipYear = payload && typeof payload === 'object' ? payload.nipYear : payload
  const S = grades.schoolYearStartFromNip(nipYear)
  if (!Number.isFinite(S) || S < 2000 || S > 2100) return { error: 'Μη έγκυρο έτος' }
  const ranges = normalizeRanges(payload && typeof payload === 'object' ? payload.ranges : null, S)
  db.setSettings({ schoolYearStart: String(S), gradeRanges: JSON.stringify(ranges) })
  return { ok: true, schoolYearStart: S, table: grades.gradeTable(S), ranges }
})

// Κοινή λογική εισαγωγής (XLSX ή PDF): δημιουργία batch, έλεγχος διπλών ΔΙΚΑ, εισαγωγή.
// parsed = { records, missingFields, totalRows } (από importer.parseFile ή importer.parsePdf).
function insertRecords(filePath, parsed) {
  const { records, missingFields, totalRows } = parsed

  const syStart = getSchoolYearStart()
  const ranges = getGradeRanges()
  const syLabel = grades.schoolYearLabel(syStart)

  // Πλήθος υπαρχόντων batch -> color_index (κυκλικά).
  const cnt = db.query('SELECT COUNT(*) AS c FROM batches')[0].c
  const colorIndex = cnt % BATCH_COLOR_COUNT

  const batchId = db.run(
    `INSERT INTO batches (imported_at, source_filename, school_year, color_index)
     VALUES ($a, $f, $y, $c)`,
    { $a: nowIso(), $f: path.basename(filePath), $y: syLabel, $c: colorIndex }
  )

  // Έλεγχος διπλών ΔΙΚΑ: σε σχέση με ενεργούς μαθητές (άφιξη/εγγεγραμμένοι) ΚΑΙ μέσα στο ίδιο
  // αρχείο. Οι διαγραμμένοι ΔΕΝ μετράνε (επιτρέπεται επανεμφάνιση). Κενά ΔΙΚΑ δεν θεωρούνται διπλά.
  const existing = new Set(
    db
      .query("SELECT dika FROM students WHERE dika != '' AND status IN ('arrival','enrolled')")
      .map((r) => String(r.dika).trim())
  )
  const seenInFile = new Set()

  const afixis = todayDisplay()
  let imported = 0
  let excluded = 0
  let skipped = 0
  let duplicates = 0

  for (const r of records) {
    // Παράλειψη κενών/άκυρων γραμμών (χωρίς όνομα, επώνυμο και ΔΙΚΑ).
    if (!r.eponymo && !r.onoma && !r.dika) {
      skipped++
      continue
    }
    // Παράλειψη διπλών ΔΙΚΑ.
    const dika = String(r.dika || '').trim()
    if (dika && (existing.has(dika) || seenInFile.has(dika))) {
      duplicates++
      continue
    }
    const cls = r.birth_year != null ? grades.classify(r.birth_year, syStart, ranges) : null
    if (!cls) {
      excluded++
      continue
    }
    db.run(
      `INSERT INTO students
        (batch_id, monada, dika, onoma, eponymo, patronymo, mitronymo, fylo, glossa,
         ithageneia, imerominia_gennisis, birth_year, imerominia_afixis, epitropos,
         computed_type, computed_grade, status, created_at, updated_at)
       VALUES
        ($batch, $monada, $dika, $onoma, $eponymo, $patronymo, $mitronymo, $fylo, $glossa,
         $ithageneia, $imgen, $byear, $afixis, 'Όχι',
         $ctype, $cgrade, 'arrival', $now, $now)`,
      {
        $batch: batchId,
        $monada: r.monada,
        $dika: r.dika,
        $onoma: r.onoma,
        $eponymo: r.eponymo,
        $patronymo: r.patronymo,
        $mitronymo: r.mitronymo,
        $fylo: r.fylo,
        $glossa: r.glossa,
        $ithageneia: r.ithageneia,
        $imgen: r.imerominia_gennisis,
        $byear: r.birth_year,
        $afixis: afixis,
        $ctype: cls.category,
        $cgrade: cls.grade,
        $now: nowIso(),
      }
    )
    if (dika) seenInFile.add(dika)
    imported++
  }

  return { canceled: false, imported, excluded, duplicates, totalRows, missingFields, batchId }
}

ipcMain.handle('import:xlsx', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Επιλογή αρχείου μαθητών',
    properties: ['openFile'],
    filters: [{ name: 'Φύλλα εργασίας', extensions: ['xlsx', 'xls'] }],
  })
  if (canceled || !filePaths.length) return { canceled: true }
  return insertRecords(filePaths[0], importer.parseFile(filePaths[0]))
})

ipcMain.handle('import:pdf', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Επιλογή αρχείου PDF μαθητών',
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePaths.length) return { canceled: true }
  try {
    const parsed = await importer.parsePdf(filePaths[0])
    return insertRecords(filePaths[0], parsed)
  } catch (err) {
    return { canceled: false, error: `Αποτυχία ανάγνωσης PDF: ${err && err.message ? err.message : err}` }
  }
})

// Κοινό batch για όλες τις χειροκίνητες καταχωρήσεις ενός σχολικού έτους (ένα χρώμα/πηγή).
function getOrCreateManualBatch(syLabel) {
  const MANUAL = 'Χειροκίνητη καταχώρηση'
  const rows = db.query(
    'SELECT id FROM batches WHERE source_filename=$f AND school_year=$y ORDER BY id DESC LIMIT 1',
    { $f: MANUAL, $y: syLabel }
  )
  if (rows.length) return rows[0].id
  const cnt = db.query('SELECT COUNT(*) AS c FROM batches')[0].c
  const colorIndex = cnt % BATCH_COLOR_COUNT
  return db.run(
    `INSERT INTO batches (imported_at, source_filename, school_year, color_index)
     VALUES ($a, $f, $y, $c)`,
    { $a: nowIso(), $f: MANUAL, $y: syLabel, $c: colorIndex }
  )
}

// Χειροκίνητη καταχώρηση μαθητή στις Αφίξεις. Ίδιοι κανόνες με την εισαγωγή
// (σχολική ηλικία, έλεγχος διπλού ΔΙΚΑ σε ενεργούς).
ipcMain.handle('students:addManual', (_e, f = {}) => {
  const eponymo = String(f.eponymo || '').trim()
  const onoma = String(f.onoma || '').trim()
  const dika = String(f.dika || '').trim()
  if (!eponymo && !onoma && !dika) {
    return { error: 'Συμπλήρωσε τουλάχιστον Επώνυμο, Όνομα ή ΔΙΚΑ.' }
  }

  const birth = importer.parseBirthDate(String(f.imerominia_gennisis || '').trim())
  if (!birth.year) {
    return { error: 'Συμπλήρωσε έγκυρη ημερομηνία γέννησης.' }
  }

  const syStart = getSchoolYearStart()
  const cls = grades.classify(birth.year, syStart, getGradeRanges())
  if (!cls) {
    return {
      error: `Εκτός σχολικής ηλικίας για το σχολικό έτος ${grades.schoolYearLabel(syStart)} (έτος γέννησης ${birth.year}).`,
    }
  }

  if (dika) {
    const dup = db.query(
      "SELECT 1 FROM students WHERE dika=$d AND status IN ('arrival','enrolled') LIMIT 1",
      { $d: dika }
    )
    if (dup.length) return { error: `Υπάρχει ήδη ενεργός μαθητής με ΔΙΚΑ ${dika}.` }
  }

  const syLabel = grades.schoolYearLabel(syStart)
  const batchId = getOrCreateManualBatch(syLabel)
  const afixis = f.imerominia_afixis
    ? importer.parseBirthDate(String(f.imerominia_afixis).trim()).display || todayDisplay()
    : todayDisplay()
  const now = nowIso()

  const id = db.run(
    `INSERT INTO students
      (batch_id, monada, dika, onoma, eponymo, patronymo, mitronymo, fylo, glossa,
       ithageneia, imerominia_gennisis, birth_year, imerominia_afixis, epitropos,
       computed_type, computed_grade, status, created_at, updated_at)
     VALUES
      ($batch, $monada, $dika, $onoma, $eponymo, $patronymo, $mitronymo, $fylo, $glossa,
       $ithageneia, $imgen, $byear, $afixis, $epitropos,
       $ctype, $cgrade, 'arrival', $now, $now)`,
    {
      $batch: batchId,
      $monada: String(f.monada || '').trim(),
      $dika: dika,
      $onoma: onoma,
      $eponymo: eponymo,
      $patronymo: String(f.patronymo || '').trim(),
      $mitronymo: String(f.mitronymo || '').trim(),
      $fylo: String(f.fylo || '').trim(),
      $glossa: String(f.glossa || '').trim(),
      $ithageneia: String(f.ithageneia || '').trim(),
      $imgen: birth.display,
      $byear: birth.year,
      $afixis: afixis,
      $epitropos: f.epitropos === 'Ναι' ? 'Ναι' : 'Όχι',
      $ctype: cls.category,
      $cgrade: cls.grade,
      $now: now,
    }
  )
  return { ok: true, id, computed: `${cls.category} · ${cls.grade}` }
})

// ΟΛΙΚΟ reset: διαγραφή όλων των μαθητών & batches (Αφίξεις/Μαθητές/Διαγραφές και
// συνεπώς Παρατηρητήριο/Αποτύπωση). ΔΕΝ θίγει σχολεία, ρυθμίσεις, πρότυπα.
ipcMain.handle('data:reset', () => {
  db.run('DELETE FROM students')
  db.run('DELETE FROM batches')
  return { ok: true }
})

function studentsByStatus(status) {
  return db.query(
    `SELECT s.*, b.color_index AS batch_color, b.school_year AS batch_year,
            b.imported_at AS batch_imported_at, sc.name AS school_name, sc.type AS school_type,
            sc.dyep AS school_dyep, sc.ty AS school_ty
       FROM students s
       LEFT JOIN batches b ON b.id = s.batch_id
       LEFT JOIN schools sc ON sc.id = s.school_id
      WHERE s.status = $st
      ORDER BY s.batch_id DESC, s.eponymo COLLATE NOCASE, s.onoma COLLATE NOCASE`,
    { $st: status }
  )
}

ipcMain.handle('students:list', (_e, status) => studentsByStatus(status))

ipcMain.handle('students:enrollOptions', (_e, id) => {
  const rows = db.query('SELECT * FROM students WHERE id = $id', { $id: id })
  if (!rows.length) return { error: 'Δεν βρέθηκε ο μαθητής' }
  const s = rows[0]
  const cls = grades.classify(s.birth_year, getSchoolYearStart(), getGradeRanges())
  if (!cls) return { error: 'Ο μαθητής είναι εκτός σχολικής ηλικίας' }

  const placeholders = cls.eligibleTypes.map((_t, i) => `$t${i}`).join(',')
  const params = {}
  cls.eligibleTypes.forEach((t, i) => (params[`$t${i}`] = t))
  const schools = db.query(
    `SELECT * FROM schools WHERE type IN (${placeholders}) ORDER BY type, name COLLATE NOCASE`,
    params
  )
  return { computed_grade: cls.grade, eligibleTypes: cls.eligibleTypes, schools }
})

ipcMain.handle('students:enroll', (_e, { id, schoolId }) => {
  const rows = db.query('SELECT * FROM students WHERE id = $id', { $id: id })
  if (!rows.length) return { error: 'Δεν βρέθηκε ο μαθητής' }
  const s = rows[0]
  const cls = grades.classify(s.birth_year, getSchoolYearStart(), getGradeRanges())
  const grade = cls ? cls.grade : s.computed_grade

  // Αν δεν δόθηκε σχολείο, auto-ανάθεση ΜΟΝΟ αν υπάρχει ακριβώς ένα κατάλληλο· αλλιώς κενό
  // (ο χρήστης θα επιλέξει αργότερα από την καρτέλα Μαθητές).
  let assigned = schoolId != null ? schoolId : null
  if (assigned == null && cls) {
    const ph = cls.eligibleTypes.map((_t, i) => `$t${i}`).join(',')
    const params = {}
    cls.eligibleTypes.forEach((t, i) => (params[`$t${i}`] = t))
    const matches = db.query(`SELECT id FROM schools WHERE type IN (${ph})`, params)
    if (matches.length === 1) assigned = matches[0].id
  }

  db.run(
    `UPDATE students
        SET status='enrolled', prev_status=status, school_id=$sid,
            current_grade=$g, enrolled_at=$now, updated_at=$now
      WHERE id=$id`,
    { $sid: assigned, $g: grade, $now: nowIso(), $id: id }
  )
  return { ok: true, schoolAssigned: assigned != null }
})

// Ανάθεση/αλλαγή σχολείου σε εγγεγραμμένο μαθητή (από την καρτέλα Μαθητές).
ipcMain.handle('students:setSchool', (_e, { id, schoolId }) => {
  db.run('UPDATE students SET school_id=$sid, updated_at=$now WHERE id=$id', {
    $sid: schoolId != null ? schoolId : null,
    $now: nowIso(),
    $id: id,
  })
  return { ok: true }
})

ipcMain.handle('students:delete', (_e, { id, reason } = {}) => {
  db.run(
    `UPDATE students SET prev_status=status, status='deleted', deleted_at=$now, deletion_reason=$r, updated_at=$now WHERE id=$id`,
    { $now: nowIso(), $r: reason || null, $id: id }
  )
  return { ok: true }
})

ipcMain.handle('students:restore', (_e, id) => {
  const rows = db.query('SELECT prev_status FROM students WHERE id=$id', { $id: id })
  const prev = rows.length && rows[0].prev_status ? rows[0].prev_status : 'arrival'
  db.run(
    `UPDATE students SET status=$prev, prev_status=NULL, deleted_at=NULL, deletion_reason=NULL, updated_at=$now WHERE id=$id`,
    { $prev: prev, $now: nowIso(), $id: id }
  )
  return { ok: true, status: prev }
})

ipcMain.handle('students:update', (_e, { id, fields }) => {
  const sets = []
  const params = { $id: id, $now: nowIso() }
  if (fields.current_grade !== undefined) {
    sets.push('current_grade=$g')
    params.$g = fields.current_grade
  }
  if (fields.epitropos !== undefined) {
    sets.push('epitropos=$ep')
    params.$ep = fields.epitropos
  }
  if (fields.asynodeftos !== undefined) {
    sets.push('asynodeftos=$as')
    params.$as = fields.asynodeftos
  }
  if (fields.eidiki_agogi !== undefined) {
    sets.push('eidiki_agogi=$ea')
    params.$ea = fields.eidiki_agogi
  }
  if (fields.deletion_reason !== undefined) {
    sets.push('deletion_reason=$dr')
    params.$dr = fields.deletion_reason || null
  }
  if (!sets.length) return { ok: true }
  db.run(`UPDATE students SET ${sets.join(', ')}, updated_at=$now WHERE id=$id`, params)
  return { ok: true }
})

// ---- Μαζικές ενέργειες ----------------------------------------------------

ipcMain.handle('students:bulkDelete', (_e, payload = []) => {
  // Συμβατότητα: δέχεται είτε πίνακα ids είτε { ids, reason }.
  const ids = Array.isArray(payload) ? payload : payload.ids || []
  const reason = Array.isArray(payload) ? null : payload.reason || null
  ids.forEach((id) =>
    db.run(
      `UPDATE students SET prev_status=status, status='deleted', deleted_at=$now, deletion_reason=$r, updated_at=$now WHERE id=$id`,
      { $now: nowIso(), $r: reason, $id: id }
    )
  )
  return { ok: true, count: ids.length }
})

ipcMain.handle('students:bulkRestore', (_e, ids = []) => {
  ids.forEach((id) => {
    const rows = db.query('SELECT prev_status FROM students WHERE id=$id', { $id: id })
    const prev = rows.length && rows[0].prev_status ? rows[0].prev_status : 'arrival'
    db.run(
      `UPDATE students SET status=$p, prev_status=NULL, deleted_at=NULL, deletion_reason=NULL, updated_at=$now WHERE id=$id`,
      { $p: prev, $now: nowIso(), $id: id }
    )
  })
  return { ok: true, count: ids.length }
})

// Οριστική (μη αναστρέψιμη) διαγραφή από τη βάση.
ipcMain.handle('students:purge', (_e, id) => {
  db.run('DELETE FROM students WHERE id=$id', { $id: id })
  return { ok: true }
})

ipcMain.handle('students:bulkPurge', (_e, ids = []) => {
  ids.forEach((id) => db.run('DELETE FROM students WHERE id=$id', { $id: id }))
  return { ok: true, count: ids.length }
})

// mode: 'auto' (μοναδικό σχολείο του τύπου) ή 'school' (συγκεκριμένο schoolId).
ipcMain.handle('students:bulkEnroll', (_e, { ids = [], mode, schoolId }) => {
  const syStart = getSchoolYearStart()
  const ranges = getGradeRanges()
  const allSchools = db.query('SELECT * FROM schools')
  let enrolled = 0 // εγγράφηκαν με σχολείο
  let needSchool = 0 // εγγράφηκαν αλλά χωρίς σχολείο (επιλογή αργότερα)
  const skipped = []
  for (const id of ids) {
    const rows = db.query('SELECT * FROM students WHERE id=$id', { $id: id })
    if (!rows.length) continue
    const s = rows[0]
    const cls = grades.classify(s.birth_year, syStart, ranges)
    if (!cls) {
      skipped.push(`${s.eponymo} ${s.onoma} — εκτός σχολικής ηλικίας`)
      continue
    }
    let target = null
    if (mode === 'school') {
      const sc = allSchools.find((x) => x.id === schoolId)
      if (sc && cls.eligibleTypes.includes(sc.type)) target = sc
      // ασύμβατος τύπος -> εγγράφεται με κενό σχολείο
    } else {
      const matches = allSchools.filter((x) => cls.eligibleTypes.includes(x.type))
      if (matches.length === 1) target = matches[0]
      // 0 ή >1 -> εγγράφεται με κενό σχολείο
    }
    db.run(
      `UPDATE students SET status='enrolled', prev_status=status, school_id=$sid,
              current_grade=$g, enrolled_at=$now, updated_at=$now WHERE id=$id`,
      { $sid: target ? target.id : null, $g: cls.grade, $now: nowIso(), $id: id }
    )
    if (target) enrolled++
    else needSchool++
  }
  return { ok: true, enrolled, needSchool, skipped }
})

// ---- Προβιβασμός / νέο σχολικό έτος ---------------------------------------

// Μοναδικό σχολείο ενός τύπου -> id, αλλιώς null (ίδια λογική με την εγγραφή).
function singleSchoolOfType(type) {
  const matches = db.query('SELECT id FROM schools WHERE type=$t', { $t: type })
  return matches.length === 1 ? matches[0].id : null
}

// Λίστα εγγεγραμμένων μαθητών με προ-υπολογισμένο επόμενο βήμα προβιβασμού.
ipcMain.handle('promotion:preview', () => {
  const S = getSchoolYearStart()
  const rows = db.query(
    `SELECT s.id, s.eponymo, s.onoma, s.current_grade, s.computed_type, sc.type AS school_type
       FROM students s LEFT JOIN schools sc ON sc.id = s.school_id
      WHERE s.status='enrolled'
      ORDER BY s.eponymo COLLATE NOCASE, s.onoma COLLATE NOCASE`
  )
  return {
    schoolYearStart: S,
    schoolYearLabel: grades.schoolYearLabel(S),
    nextLabel: grades.schoolYearLabel(S + 1),
    rows: rows.map((r) => {
      const currentType = r.school_type || r.computed_type || ''
      return {
        id: r.id,
        eponymo: r.eponymo,
        onoma: r.onoma,
        currentType,
        currentGrade: r.current_grade || '',
        next: grades.promote(currentType, r.current_grade),
      }
    }),
  }
})

// Εφαρμογή προβιβασμού: promotedIds = όσοι προβιβάστηκαν (οι υπόλοιποι μένουν ως έχουν).
ipcMain.handle('promotion:apply', (_e, promotedIds = []) => {
  let promoted = 0
  let graduated = 0
  let needSchool = 0
  const now = nowIso()

  for (const id of promotedIds) {
    const rows = db.query(
      `SELECT s.*, sc.type AS school_type
         FROM students s LEFT JOIN schools sc ON sc.id = s.school_id
        WHERE s.id=$id AND s.status='enrolled'`,
      { $id: id }
    )
    if (!rows.length) continue
    const s = rows[0]
    const effType = s.school_type || s.computed_type || ''
    const next = grades.promote(effType, s.current_grade)
    if (!next) continue

    if (next.graduated) {
      // Απόφοιτος -> Διαγραφές (soft delete, όπως students:delete).
      db.run(
        `UPDATE students SET prev_status=status, status='deleted', deleted_at=$now, updated_at=$now WHERE id=$id`,
        { $now: now, $id: id }
      )
      graduated++
      continue
    }

    // Σχολείο: ίδιος τύπος -> κράτα το ίδιο· αλλιώς auto-assign μοναδικού ή κενό.
    let schoolId
    if (next.type === effType) {
      schoolId = s.school_id != null ? s.school_id : null
    } else {
      schoolId = singleSchoolOfType(next.type)
    }
    if (schoolId == null) needSchool++

    db.run(
      `UPDATE students
          SET current_grade=$g, computed_type=$ct, computed_grade=$g, school_id=$sid, updated_at=$now
        WHERE id=$id`,
      { $g: next.grade, $ct: next.type, $sid: schoolId, $now: now, $id: id }
    )
    promoted++
  }

  // Προχώρα το σχολικό έτος κατά 1.
  const yearStart = getSchoolYearStart() + 1
  db.setSettings({ schoolYearStart: String(yearStart) })

  // Αν υπάρχουν χειροκίνητα εύρη, μετατόπισέ τα κατά +1 ώστε να μείνουν συνεπή με το νέο έτος.
  const storedRanges = getGradeRanges()
  if (storedRanges) {
    const shifted = storedRanges.map((r) => ({
      type: r.type,
      fromYear: Number(r.fromYear) + 1,
      toYear: Number(r.toYear) + 1,
    }))
    db.setSettings({ gradeRanges: JSON.stringify(shifted) })
  }

  return { ok: true, promoted, graduated, needSchool, yearStart, yearLabel: grades.schoolYearLabel(yearStart) }
})

ipcMain.handle('documents:bulkGenerate', async (_e, { ids = [], templateFiles = [], signee }) => {
  if (!templateFiles.length) return { error: 'Δεν επιλέχθηκαν templates' }
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Επιλογή φακέλου αποθήκευσης εγγράφων',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || !filePaths.length) return { canceled: true }
  const outDir = filePaths[0]
  const cfg = db.getAllSettings()
  let generated = 0
  const failed = []
  for (const id of ids) {
    const rows = db.query(
      `SELECT s.*, sc.name AS school_name, sc.type AS school_type
         FROM students s LEFT JOIN schools sc ON sc.id = s.school_id WHERE s.id=$id`,
      { $id: id }
    )
    if (!rows.length) continue
    const s = rows[0]
    const data = buildDocData(s, cfg)
    if (signee) {
      const sg = computeSignee(s, cfg, signee)
      data['signee'] = sg.signee
      data['signee.prop'] = sg.prop
    }
    for (const tf of templateFiles) {
      const templatePath = resolveTemplatePath(tf)
      if (!fs.existsSync(templatePath)) {
        failed.push(`${tf} (λείπει)`)
        continue
      }
      try {
        const pdf = documents.generate({
          templatePath,
          data,
          resourcesPath: isDev ? null : process.resourcesPath,
          isDev,
          userDataPath: app.getPath('userData'),
        })
        const safe = `${s.eponymo}_${s.onoma}_${tf.replace(/\.(pptx|docx)$/i, '')}.pdf`.replace(
          /[\\/:*?"<>|\s]+/g,
          '_'
        )
        fs.copyFileSync(pdf, path.join(outDir, safe))
        generated++
      } catch (err) {
        failed.push(`${s.eponymo} ${s.onoma} / ${tf}: ${err.message}`)
      }
    }
  }
  return { ok: true, generated, failed, outDir }
})

ipcMain.handle('schools:list', () =>
  db.query('SELECT * FROM schools ORDER BY type, name COLLATE NOCASE')
)

ipcMain.handle('schools:add', (_e, { name, type, dyep, ty }) => {
  if (!name || !type) return { error: 'Συμπλήρωσε όνομα και τύπο' }
  if (!grades.SCHOOL_TYPES.includes(type)) return { error: 'Μη έγκυρος τύπος σχολείου' }
  const id = db.run('INSERT INTO schools (name, type, dyep, ty) VALUES ($n, $t, $d, $ty)', {
    $n: name,
    $t: type,
    $d: dyep ? 1 : 0,
    $ty: ty ? 1 : 0,
  })
  return { ok: true, id }
})

ipcMain.handle('schools:delete', (_e, id) => {
  const used = db.query(
    `SELECT COUNT(*) AS c FROM students WHERE school_id=$id AND status='enrolled'`,
    { $id: id }
  )[0].c
  if (used > 0) {
    return { error: `Δεν διαγράφεται: ${used} εγγεγραμμένοι μαθητές σε αυτό το σχολείο.` }
  }
  db.run('DELETE FROM schools WHERE id=$id', { $id: id })
  return { ok: true }
})

ipcMain.handle('schools:update', (_e, { id, name, type, dyep, ty }) => {
  if (!name || !type) return { error: 'Συμπλήρωσε όνομα και τύπο' }
  if (!grades.SCHOOL_TYPES.includes(type)) return { error: 'Μη έγκυρος τύπος σχολείου' }
  db.run('UPDATE schools SET name=$n, type=$t, dyep=$d, ty=$ty WHERE id=$id', {
    $n: name,
    $t: type,
    $d: dyep ? 1 : 0,
    $ty: ty ? 1 : 0,
    $id: id,
  })
  return { ok: true }
})

ipcMain.handle('grades:forType', (_e, type) => grades.gradesForType(type))

ipcMain.handle('help:readme', () => {
  const p = isDev
    ? path.join(__dirname, '..', 'README.md')
    : path.join(process.resourcesPath, 'README.md')
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return '# Βοήθεια\n\nΔεν βρέθηκε το αρχείο README.'
  }
})

ipcMain.handle('settings:get', () => db.getAllSettings())

ipcMain.handle('settings:set', (_e, obj) => {
  db.setSettings(obj || {})
  return { ok: true }
})

ipcMain.handle('documents:list', () => {
  // Σάρωση ενσωματωμένων + προτύπων χρήστη. Σε σύγκρουση ονόματος υπερισχύει το πρότυπο χρήστη.
  const byFile = new Map()
  const scan = (dir, builtin) => {
    if (!fs.existsSync(dir)) return
    fs.readdirSync(dir)
      .filter((f) => /\.(pptx|docx)$/i.test(f))
      .forEach((f) => {
        let tokens = []
        try {
          tokens = documents.extractTokens(path.join(dir, f))
        } catch {
          tokens = []
        }
        byFile.set(f, {
          file: f,
          label: f.replace(/\.(pptx|docx)$/i, ''),
          needsSignee: tokens.includes('signee') || tokens.includes('signee.prop'),
          builtin,
          tokens,
          unknownTokens: tokens.filter((t) => !KNOWN_TOKENS.includes(t)),
        })
      })
  }
  scan(templatesDir(), true)
  scan(userTemplatesDir(), false) // υπερισχύει
  return [...byFile.values()]
})

// Προσθήκη προτύπων χρήστη (αντιγραφή .docx/.pptx στον φάκελο userData/templates).
ipcMain.handle('templates:add', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Προσθήκη προτύπων εγγράφων',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Πρότυπα', extensions: ['docx', 'pptx'] }],
  })
  if (canceled || !filePaths.length) return { canceled: true }
  const dir = userTemplatesDir()
  fs.mkdirSync(dir, { recursive: true })
  const added = []
  const failed = []
  for (const src of filePaths) {
    try {
      const name = path.basename(src)
      fs.copyFileSync(src, path.join(dir, name)) // overwrite αν υπάρχει
      added.push(name)
    } catch (err) {
      failed.push(`${path.basename(src)}: ${err.message}`)
    }
  }
  return { ok: true, added, failed }
})

// Διαγραφή προτύπου χρήστη (μόνο όσα βρίσκονται στον φάκελο userData/templates).
ipcMain.handle('templates:delete', (_e, file) => {
  const dir = userTemplatesDir()
  const target = path.join(dir, path.basename(file || ''))
  // Ασφάλεια: το αρχείο πρέπει να είναι μέσα στον φάκελο χρήστη.
  if (path.dirname(target) !== dir) return { error: 'Μη έγκυρο αρχείο.' }
  if (!fs.existsSync(target)) return { error: 'Τα ενσωματωμένα πρότυπα δεν διαγράφονται.' }
  try {
    fs.unlinkSync(target)
    return { ok: true }
  } catch (err) {
    return { error: err.message }
  }
})

// Άνοιγμα του (μόνιμου) φακέλου προτύπων χρήστη στον explorer. Επιβιώνει στις ενημερώσεις.
// Αντιγράφει τα ενσωματωμένα πρότυπα εκεί (μόνο όσα λείπουν) ώστε να είναι επεξεργάσιμα —
// δεν αντικαθιστά ποτέ υπάρχον αρχείο χρήστη.
ipcMain.handle('templates:openFolder', async () => {
  const dir = userTemplatesDir()
  try {
    fs.mkdirSync(dir, { recursive: true })
    const builtinDir = templatesDir()
    let seeded = 0
    if (fs.existsSync(builtinDir)) {
      for (const f of fs.readdirSync(builtinDir).filter((f) => /\.(pptx|docx)$/i.test(f))) {
        const dest = path.join(dir, f)
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(path.join(builtinDir, f), dest)
          seeded++
        }
      }
    }
    const err = await shell.openPath(dir)
    if (err) return { error: err }
    return { ok: true, path: dir, seeded }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('documents:generate', async (_e, { id, templateFile, signee }) => {
  const rows = db.query(
    `SELECT s.*, sc.name AS school_name, sc.type AS school_type
       FROM students s LEFT JOIN schools sc ON sc.id = s.school_id
      WHERE s.id=$id`,
    { $id: id }
  )
  if (!rows.length) return { error: 'Δεν βρέθηκε ο μαθητής' }
  const s = rows[0]

  const templatePath = resolveTemplatePath(templateFile)
  if (!fs.existsSync(templatePath)) return { error: 'Δεν βρέθηκε το template' }

  const cfg = db.getAllSettings()
  const data = buildDocData(s, cfg)
  if (signee) {
    const sg = computeSignee(s, cfg, signee)
    data['signee'] = sg.signee
    data['signee.prop'] = sg.prop
  }

  let pdfPath
  try {
    pdfPath = documents.generate({
      templatePath,
      data,
      resourcesPath: isDev ? null : process.resourcesPath,
      isDev,
      userDataPath: app.getPath('userData'),
    })
  } catch (err) {
    return { error: err.message }
  }

  const suggested = `${s.eponymo}_${s.onoma}_${templateFile.replace(/\.(pptx|docx)$/i, '')}.pdf`.replace(
    /[\\/:*?"<>|\s]+/g,
    '_'
  )
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Αποθήκευση εγγράφου',
    defaultPath: suggested,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return { canceled: true }
  fs.copyFileSync(pdfPath, filePath)
  // Εμφάνιση στον explorer/finder (ΧΩΡΙΣ να ανοίξει το LibreOffice).
  shell.showItemInFolder(filePath)
  return { ok: true, path: filePath }
})

ipcMain.handle('backup:export', async () => {
  const src = db.getDbPath()
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Εξαγωγή αντιγράφου ασφαλείας',
    defaultPath: `mathitologio_backup_${Date.now()}.sqlite`,
    filters: [{ name: 'Βάση δεδομένων', extensions: ['sqlite'] }],
  })
  if (canceled || !filePath) return { canceled: true }
  fs.copyFileSync(src, filePath)
  return { ok: true, path: filePath }
})

ipcMain.handle('backup:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Επαναφορά από αντίγραφο ασφαλείας',
    properties: ['openFile'],
    filters: [{ name: 'Βάση δεδομένων', extensions: ['sqlite'] }],
  })
  if (canceled || !filePaths.length) return { canceled: true }
  const buf = fs.readFileSync(filePaths[0])
  db.replaceFromBuffer(buf)
  return { ok: true }
})

// ---- Αυτόματα αντίγραφα ασφαλείας -----------------------------------------

const BACKUP_PREFIX = 'mathitologio_backup_'

// Συχνότητα -> ημέρες (0 = ανενεργό).
function freqDays(freq) {
  if (freq === 'daily') return 1
  if (freq === 'weekly') return 7
  if (freq === 'monthly') return 30
  return 0
}

// Ταξινομήσιμη χρονοσφραγίδα τοπικής ώρας: YYYY-MM-DD_HH-mm-ss.
function backupStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  )
}

// Δημιουργία αντιγράφου (force = αγνοεί συχνότητα/περίοδο, για χειροκίνητο «Backup τώρα»).
function runAutoBackup({ force = false } = {}) {
  try {
    const s = db.getAllSettings()
    const freq = s.backupFrequency || 'off'
    const folder = s.backupFolder || ''
    if (!force) {
      if (freq === 'off' || !folder) return { skipped: true }
      const days = freqDays(freq)
      const last = s.backupLastAt ? Date.parse(s.backupLastAt) : 0
      if (last && Date.now() - last < days * 86400000) return { skipped: true, notDue: true }
    }
    if (!folder) return { error: 'Δεν έχει οριστεί φάκελος αντιγράφων.' }

    fs.mkdirSync(folder, { recursive: true })
    db.save() // εξασφάλισε ότι το αρχείο στον δίσκο είναι ενημερωμένο
    const dest = path.join(folder, `${BACKUP_PREFIX}${backupStamp()}.sqlite`)
    fs.copyFileSync(db.getDbPath(), dest)
    db.setSettings({ backupLastAt: new Date().toISOString() })

    // Rotation: κράτα μόνο τα τελευταία N.
    const keep = Math.max(1, parseInt(s.backupKeep, 10) || 10)
    const files = fs
      .readdirSync(folder)
      .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith('.sqlite'))
      .sort()
      .reverse()
    for (const f of files.slice(keep)) {
      try {
        fs.unlinkSync(path.join(folder, f))
      } catch {
        // αγνόησε αποτυχία διαγραφής μεμονωμένου αρχείου
      }
    }
    return { ok: true, path: dest }
  } catch (err) {
    return { error: err.message }
  }
}

ipcMain.handle('backup:chooseFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Επιλογή φακέλου αντιγράφων ασφαλείας',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: path.join(app.getPath('documents'), 'Μαθητολόγιο-Backups'),
  })
  if (canceled || !filePaths.length) return { canceled: true }
  return { path: filePaths[0] }
})

ipcMain.handle('backup:now', () => runAutoBackup({ force: true }))

ipcMain.handle('backup:list', () => {
  const folder = db.getAllSettings().backupFolder || ''
  if (!folder || !fs.existsSync(folder)) return []
  return fs
    .readdirSync(folder)
    .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith('.sqlite'))
    .map((name) => {
      const st = fs.statSync(path.join(folder, name))
      return { name, size: st.size, mtime: st.mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
})

// ---- Αποτύπωση / μηνιαία στατιστικά ---------------------------------------

const GREEK_MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

const CATEGORY_ORDER = ['Νηπιαγωγείο', 'Δημοτικό', 'Γυμνάσιο', 'Λύκειο', 'ΕΠΑΛ']

// ISO της πρώτης στιγμής του ΕΠΟΜΕΝΟΥ μήνα (όριο "έως & συμπεριλαμβανομένου" του μήνα).
function nextMonthBoundIso(year, month) {
  const y = month === 12 ? year + 1 : year
  return new Date(Date.UTC(y, month % 12, 1, 0, 0, 0)).toISOString()
}

// Κανονικοποίηση φύλου -> 'male' | 'female' | 'other'.
function genderOf(fylo) {
  const f = String(fylo || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
  if (f.startsWith('Α')) return 'male'
  if (f.startsWith('Θ')) return 'female'
  return 'other'
}

function levelOf(category) {
  if (category === 'Νηπιαγωγείο' || category === 'Δημοτικό') return 'Πρωτοβάθμια'
  if (category === 'Γυμνάσιο' || category === 'Λύκειο' || category === 'ΕΠΑΛ') return 'Δευτεροβάθμια'
  return 'Άλλο'
}

function emptyCounts() {
  return { male: 0, female: 0, other: 0, total: 0 }
}
function addCount(c, g) {
  c[g] += 1
  c.total += 1
}

ipcMain.handle('stats:monthly', (_e, period) => {
  const now = new Date()
  const year = Number(period && period.year) || now.getFullYear()
  const month = Number(period && period.month) || now.getMonth() + 1
  const bound = nextMonthBoundIso(year, month)

  const rows = db.query(
    `SELECT s.status, s.prev_status, s.fylo, s.computed_type, s.enrolled_at, s.deleted_at,
            sc.id AS school_id, sc.name AS school_name, sc.type AS school_type
       FROM students s LEFT JOIN schools sc ON sc.id = s.school_id
      WHERE s.status IN ('enrolled', 'deleted')`
  )

  // Μαθητές "παρόντες" στον επιλεγμένο μήνα (στιγμιότυπο τέλους μήνα).
  const present = rows.filter((s) => {
    const enrolledOk = !s.enrolled_at || s.enrolled_at < bound
    if (!enrolledOk) return false
    if (s.status === 'enrolled') return true
    // Διαγραμμένος: μετράει μόνο αν ήταν εγγεγραμμένος και διαγράφηκε ΜΕΤΑ το τέλος του μήνα.
    return s.prev_status === 'enrolled' && s.enrolled_at && s.deleted_at && s.deleted_at >= bound
  })

  const totals = emptyCounts()
  const catCounts = {} // category -> counts
  const schoolMap = new Map() // key -> { name, type, counts }

  for (const s of present) {
    const g = genderOf(s.fylo)
    const category = s.school_type || s.computed_type || '—'
    addCount(totals, g)

    if (!catCounts[category]) catCounts[category] = emptyCounts()
    addCount(catCounts[category], g)

    const key = s.school_id != null ? `id:${s.school_id}` : 'none'
    if (!schoolMap.has(key)) {
      schoolMap.set(key, {
        name: s.school_id != null ? s.school_name : 'Χωρίς σχολείο',
        type: s.school_id != null ? s.school_type : '',
        counts: emptyCounts(),
      })
    }
    addCount(schoolMap.get(key).counts, g)
  }

  // Ανά βαθμίδα (Πρωτοβάθμια / Δευτεροβάθμια) με ανάλυση ανά κατηγορία.
  const levelGroups = { 'Πρωτοβάθμια': [], 'Δευτεροβάθμια': [], 'Άλλο': [] }
  Object.keys(catCounts)
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99))
    .forEach((cat) => {
      levelGroups[levelOf(cat)].push({ category: cat, ...catCounts[cat] })
    })

  const byLevel = ['Πρωτοβάθμια', 'Δευτεροβάθμια', 'Άλλο']
    .filter((lv) => levelGroups[lv].length)
    .map((lv) => {
      const sum = emptyCounts()
      levelGroups[lv].forEach((c) => {
        sum.male += c.male
        sum.female += c.female
        sum.other += c.other
        sum.total += c.total
      })
      return { level: lv, categories: levelGroups[lv], ...sum }
    })

  const TYPE_RANK = { 'Νηπιαγωγείο': 1, 'Δημοτικό': 2, 'Γυμνάσιο': 3, 'Λύκειο': 4, 'ΕΠΑΛ': 5 }
  const bySchool = [...schoolMap.values()]
    .sort((a, b) => {
      if (a.type === '' && b.type !== '') return 1
      if (b.type === '' && a.type !== '') return -1
      const ta = TYPE_RANK[a.type] || 99
      const tb = TYPE_RANK[b.type] || 99
      if (ta !== tb) return ta - tb
      return a.name.localeCompare(b.name, 'el')
    })
    .map((x) => ({ name: x.name, type: x.type, ...x.counts }))

  return {
    year,
    month,
    period: `${GREEK_MONTHS[month - 1]} ${year}`,
    totals,
    byLevel,
    bySchool,
  }
})

// Παρατηρητήριο: εγγραφές μέσα σε ένα 15νθήμερο (βάσει enrolled_at).
// period = { year, month, half }, half: 1 (1–15) ή 2 (16–τέλος μήνα).
ipcMain.handle('stats:observatory', (_e, period) => {
  const now = new Date()
  const year = Number(period && period.year) || now.getFullYear()
  const month = Number(period && period.month) || now.getMonth() + 1
  const half = Number(period && period.half) === 2 ? 2 : 1

  const startIso =
    half === 1
      ? new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString()
      : new Date(Date.UTC(year, month - 1, 16, 0, 0, 0)).toISOString()
  const endIso =
    half === 1
      ? new Date(Date.UTC(year, month - 1, 16, 0, 0, 0)).toISOString()
      : nextMonthBoundIso(year, month)

  // Όσοι ΕΓΓΡΑΦΗΚΑΝ μέσα στο 15νθήμερο (ακόμη κι αν διαγράφηκαν αργότερα).
  const rows = db.query(
    `SELECT s.fylo, s.computed_type, s.asynodeftos, s.eidiki_agogi,
            sc.id AS school_id, sc.name AS school_name, sc.type AS school_type,
            sc.dyep AS school_dyep, sc.ty AS school_ty
       FROM students s LEFT JOIN schools sc ON sc.id = s.school_id
      WHERE s.enrolled_at >= $start AND s.enrolled_at < $end
        AND s.status IN ('enrolled', 'deleted')
        AND (s.status = 'enrolled' OR s.prev_status = 'enrolled')`,
    { $start: startIso, $end: endIso }
  )

  const levelTotals = { 'Πρωτοβάθμια': 0, 'Δευτεροβάθμια': 0, 'Άλλο': 0 }
  const schoolMap = new Map() // key -> { name, type, total }
  let total = 0
  let dyep = 0
  let withTY = 0
  let withoutTY = 0
  let eidiki = 0
  let asynodeftoi = 0

  for (const s of rows) {
    total++
    const category = s.school_type || s.computed_type || 'Άλλο'
    levelTotals[levelOf(category)] += 1

    const key = s.school_id != null ? `id:${s.school_id}` : 'none'
    if (!schoolMap.has(key)) {
      schoolMap.set(key, {
        name: s.school_id != null ? s.school_name : 'Χωρίς σχολείο',
        type: s.school_id != null ? s.school_type : '',
        total: 0,
      })
    }
    schoolMap.get(key).total += 1

    // Α1.2/1.3/1.4 — ανεξάρτητα flags σχολείου (μπορεί να επικαλύπτονται).
    if (s.school_dyep) dyep++
    if (s.school_ty) withTY++
    else withoutTY++

    if (s.eidiki_agogi === 'Ναι') eidiki++
    if (s.asynodeftos === 'Ναι') asynodeftoi++
  }

  const byLevel = ['Πρωτοβάθμια', 'Δευτεροβάθμια'].map((lv) => ({ level: lv, total: levelTotals[lv] }))

  const TYPE_RANK = { 'Νηπιαγωγείο': 1, 'Δημοτικό': 2, 'Γυμνάσιο': 3, 'Λύκειο': 4, 'ΕΠΑΛ': 5 }
  const bySchool = [...schoolMap.values()].sort((a, b) => {
    if (a.type === '' && b.type !== '') return 1
    if (b.type === '' && a.type !== '') return -1
    const ta = TYPE_RANK[a.type] || 99
    const tb = TYPE_RANK[b.type] || 99
    if (ta !== tb) return ta - tb
    return a.name.localeCompare(b.name, 'el')
  })

  return {
    year,
    month,
    half,
    period: `${GREEK_MONTHS[month - 1]} ${year} — ${half === 1 ? '1–15' : '16–τέλος'}`,
    total,
    byLevel,
    bySchool,
    dyep,
    withTY,
    withoutTY,
    eidiki,
    asynodeftoi,
  }
})

// Προθέρμανση LibreOffice στην 1η εκκίνηση (όταν δεν υπάρχει ακόμη το persistent
// προφίλ): αθόρυβη μετατροπή ενός template σε background, ώστε η πρώτη πραγματική
// έκδοση εγγράφου να μη χτυπήσει την ψυχρή καθυστέρηση (DLLs + προφίλ + antivirus).
// Best-effort: ποτέ δεν πρέπει να ρίξει/καθυστερήσει την εκκίνηση.
function warmUpLibreOffice() {
  try {
    const profileDir = path.join(app.getPath('userData'), 'lo_profile')
    if (fs.existsSync(profileDir)) return // ήδη ζεστό από προηγούμενη χρήση
    const dir = templatesDir()
    if (!fs.existsSync(dir)) return
    const tpl = fs.readdirSync(dir).find((f) => /\.(pptx|docx)$/i.test(f))
    if (!tpl) return
    const soffice = documents.findSoffice(isDev ? null : process.resourcesPath, isDev)
    documents
      .warmUpProfile({ templatePath: path.join(dir, tpl), soffice, profileDir })
      .catch(() => {})
  } catch {
    // σιωπηλά — η προθέρμανση είναι προαιρετική
  }
}

// ---------------------------------------------------------------- App lifecycle

app.whenReady().then(async () => {
  await db.init(app.getPath('userData'))
  createWindow()
  warmUpLibreOffice() // fire-and-forget· δεν μπλοκάρει την εκκίνηση
  // Αυτόματο backup στο άνοιγμα, αν έχει περάσει η περίοδος που όρισε ο χρήστης.
  try {
    runAutoBackup()
  } catch (e) {
    console.error('auto-backup', e)
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
