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
    title: 'Μαθητολόγιο',
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
  }
})

ipcMain.handle('schoolYear:set', (_e, nipYear) => {
  const S = grades.schoolYearStartFromNip(nipYear)
  if (!Number.isFinite(S) || S < 2000 || S > 2100) return { error: 'Μη έγκυρο έτος' }
  db.setSettings({ schoolYearStart: String(S) })
  return { ok: true, schoolYearStart: S, table: grades.gradeTable(S) }
})

ipcMain.handle('import:xlsx', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Επιλογή αρχείου μαθητών',
    properties: ['openFile'],
    filters: [{ name: 'Φύλλα εργασίας', extensions: ['xlsx', 'xls'] }],
  })
  if (canceled || !filePaths.length) return { canceled: true }

  const filePath = filePaths[0]
  const { records, missingFields, totalRows } = importer.parseFile(filePath)

  const syStart = getSchoolYearStart()
  const syLabel = grades.schoolYearLabel(syStart)

  // Πλήθος υπαρχόντων batch -> color_index (κυκλικά).
  const cnt = db.query('SELECT COUNT(*) AS c FROM batches')[0].c
  const colorIndex = cnt % BATCH_COLOR_COUNT

  const batchId = db.run(
    `INSERT INTO batches (imported_at, source_filename, school_year, color_index)
     VALUES ($a, $f, $y, $c)`,
    { $a: nowIso(), $f: path.basename(filePath), $y: syLabel, $c: colorIndex }
  )

  const afixis = todayDisplay()
  let imported = 0
  let excluded = 0

  let skipped = 0
  for (const r of records) {
    // Παράλειψη κενών/άκυρων γραμμών (χωρίς όνομα, επώνυμο και ΔΙΚΑ).
    if (!r.eponymo && !r.onoma && !r.dika) {
      skipped++
      continue
    }
    const cls = r.birth_year != null ? grades.classify(r.birth_year, syStart) : null
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
    imported++
  }

  return { canceled: false, imported, excluded, totalRows, missingFields, batchId }
})

function studentsByStatus(status) {
  return db.query(
    `SELECT s.*, b.color_index AS batch_color, b.school_year AS batch_year,
            b.imported_at AS batch_imported_at, sc.name AS school_name, sc.type AS school_type
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
  const cls = grades.classify(s.birth_year, getSchoolYearStart())
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
  const cls = grades.classify(s.birth_year, getSchoolYearStart())
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

ipcMain.handle('students:delete', (_e, id) => {
  db.run(
    `UPDATE students SET prev_status=status, status='deleted', deleted_at=$now, updated_at=$now WHERE id=$id`,
    { $now: nowIso(), $id: id }
  )
  return { ok: true }
})

ipcMain.handle('students:restore', (_e, id) => {
  const rows = db.query('SELECT prev_status FROM students WHERE id=$id', { $id: id })
  const prev = rows.length && rows[0].prev_status ? rows[0].prev_status : 'arrival'
  db.run(
    `UPDATE students SET status=$prev, prev_status=NULL, deleted_at=NULL, updated_at=$now WHERE id=$id`,
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
  if (!sets.length) return { ok: true }
  db.run(`UPDATE students SET ${sets.join(', ')}, updated_at=$now WHERE id=$id`, params)
  return { ok: true }
})

// ---- Μαζικές ενέργειες ----------------------------------------------------

ipcMain.handle('students:bulkDelete', (_e, ids = []) => {
  ids.forEach((id) =>
    db.run(
      `UPDATE students SET prev_status=status, status='deleted', deleted_at=$now, updated_at=$now WHERE id=$id`,
      { $now: nowIso(), $id: id }
    )
  )
  return { ok: true, count: ids.length }
})

ipcMain.handle('students:bulkRestore', (_e, ids = []) => {
  ids.forEach((id) => {
    const rows = db.query('SELECT prev_status FROM students WHERE id=$id', { $id: id })
    const prev = rows.length && rows[0].prev_status ? rows[0].prev_status : 'arrival'
    db.run(
      `UPDATE students SET status=$p, prev_status=NULL, deleted_at=NULL, updated_at=$now WHERE id=$id`,
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
  const allSchools = db.query('SELECT * FROM schools')
  let enrolled = 0 // εγγράφηκαν με σχολείο
  let needSchool = 0 // εγγράφηκαν αλλά χωρίς σχολείο (επιλογή αργότερα)
  const skipped = []
  for (const id of ids) {
    const rows = db.query('SELECT * FROM students WHERE id=$id', { $id: id })
    if (!rows.length) continue
    const s = rows[0]
    const cls = grades.classify(s.birth_year, syStart)
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
      const templatePath = path.join(templatesDir(), tf)
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

ipcMain.handle('schools:add', (_e, { name, type }) => {
  if (!name || !type) return { error: 'Συμπλήρωσε όνομα και τύπο' }
  if (!grades.SCHOOL_TYPES.includes(type)) return { error: 'Μη έγκυρος τύπος σχολείου' }
  const id = db.run('INSERT INTO schools (name, type) VALUES ($n, $t)', { $n: name, $t: type })
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

ipcMain.handle('schools:update', (_e, { id, name, type }) => {
  if (!name || !type) return { error: 'Συμπλήρωσε όνομα και τύπο' }
  if (!grades.SCHOOL_TYPES.includes(type)) return { error: 'Μη έγκυρος τύπος σχολείου' }
  db.run('UPDATE schools SET name=$n, type=$t WHERE id=$id', { $n: name, $t: type, $id: id })
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
  const dir = templatesDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(pptx|docx)$/i.test(f))
    .map((f) => {
      let tokens = []
      try {
        tokens = documents.extractTokens(path.join(dir, f))
      } catch {
        tokens = []
      }
      return {
        file: f,
        label: f.replace(/\.(pptx|docx)$/i, ''),
        needsSignee: tokens.includes('signee') || tokens.includes('signee.prop'),
      }
    })
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

  const templatePath = path.join(templatesDir(), templateFile)
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

// ---------------------------------------------------------------- App lifecycle

app.whenReady().then(async () => {
  await db.init(app.getPath('userData'))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
