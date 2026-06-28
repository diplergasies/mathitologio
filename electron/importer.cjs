'use strict'

const XLSX = require('xlsx')

// Κανονικοποίηση κεφαλίδας: πεζά, χωρίς τόνους, χωρίς διπλά κενά.
function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Κανονικό πεδίο -> αποδεκτές παραλλαγές κεφαλίδας (κανονικοποιημένες).
const FIELD_ALIASES = {
  monada: ['μοναδα'],
  dika: ['δικα'],
  onoma: ['ονομα', 'μικρο ονομα'],
  eponymo: ['επωνυμο'],
  patronymo: ['πατρωνυμο', 'ονομα πατρος', 'πατερας'],
  mitronymo: ['μητρωνυμο', 'ονομα μητρος', 'μητερα'],
  fylo: ['φυλο'],
  glossa: ['γλωσσα', 'μητρικη γλωσσα'],
  ithageneia: ['ιθαγενεια', 'υπηκοοτητα'],
  imerominia_gennisis: [
    'ημερομηνια γεννησης', 'ημ. γεννησης', 'ημ γεννησης',
    'ημερομηνια γεννησεως', 'ημ/νια γεννησης', 'ημερομ. γεννησης',
  ],
}

function buildHeaderMap(headerRow) {
  // headerRow: array of cell values. Επιστρέφει { field: columnIndex }.
  const map = {}
  headerRow.forEach((cell, idx) => {
    const n = norm(cell)
    if (!n) return
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(n) && map[field] === undefined) {
        map[field] = idx
      }
    }
  })
  return map
}

// Δύο ψηφία -> τετραψήφιο έτος (07 -> 2007, 99 -> 1999).
function expandYear(yy) {
  const n = Number(yy)
  if (n >= 100) return n
  return n <= 30 ? 2000 + n : 1900 + n
}

// Ανάλυση ημερομηνίας γέννησης -> { display: 'dd/mm/yyyy', year }.
function parseBirthDate(value) {
  if (value == null || value === '') return { display: '', year: null }

  if (value instanceof Date && !isNaN(value)) {
    // Χρήση UTC components: ντετερμινιστικό αποτέλεσμα ανεξαρτήτως ζώνης ώρας του μηχανήματος
    // (οι ημερομηνίες αποθηκεύονται ως ISO με ώρα ~τέλος ημέρας τοπικά — το UTC κρατά τη σωστή ημέρα).
    const d = value
    return {
      display: `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`,
      year: d.getUTCFullYear(),
    }
  }

  if (typeof value === 'number') {
    // Excel serial date -> JS Date.
    const parsed = XLSX.SSF ? XLSX.SSF.parse_date_code(value) : null
    if (parsed && parsed.y) {
      return {
        display: `${String(parsed.d).padStart(2, '0')}/${String(parsed.m).padStart(2, '0')}/${parsed.y}`,
        year: parsed.y,
      }
    }
  }

  const s = String(value).trim()
  // dd/mm/yyyy ή dd-mm-yyyy ή dd.mm.yyyy
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/)
  if (m) {
    const year = expandYear(m[3])
    return { display: `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${year}`, year }
  }
  // yyyy-mm-dd
  m = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/)
  if (m) {
    return { display: `${m[3].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[1]}`, year: Number(m[1]) }
  }
  // Εφεδρικά: πρώτο τετραψήφιο σε λογικό εύρος ετών.
  m = s.match(/(19|20)\d{2}/)
  return { display: s, year: m ? Number(m[0]) : null }
}

// Κοινός πυρήνας: δέχεται 2D πίνακα γραμμών (rows[0] = κεφαλίδες) και χτίζει τα records.
// Χρησιμοποιείται τόσο από το XLSX (parseFile) όσο και από το PDF (parsePdf).
// Επιστρέφει { records: [...], headerMap, missingFields, totalRows }.
function recordsFromRows(rows) {
  if (!rows.length) {
    return { records: [], headerMap: {}, missingFields: Object.keys(FIELD_ALIASES), totalRows: 0 }
  }

  const headerMap = buildHeaderMap(rows[0])
  const missingFields = Object.keys(FIELD_ALIASES).filter((f) => headerMap[f] === undefined)

  const records = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => c === '' || c == null)) continue

    const get = (field) => {
      const idx = headerMap[field]
      return idx === undefined ? '' : (row[idx] == null ? '' : String(row[idx]).trim())
    }

    const birthRaw = headerMap.imerominia_gennisis !== undefined
      ? row[headerMap.imerominia_gennisis]
      : ''
    const birth = parseBirthDate(birthRaw)

    records.push({
      monada: get('monada'),
      dika: get('dika'),
      onoma: get('onoma'),
      eponymo: get('eponymo'),
      patronymo: get('patronymo'),
      mitronymo: get('mitronymo'),
      fylo: get('fylo'),
      glossa: get('glossa'),
      ithageneia: get('ithageneia'),
      imerominia_gennisis: birth.display,
      birth_year: birth.year,
    })
  }

  return { records, headerMap, missingFields, totalRows: records.length }
}

// Διαβάζει αρχείο XLSX/XLS και επιστρέφει το ίδιο σχήμα με το recordsFromRows.
function parseFile(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  return recordsFromRows(rows)
}

// ───────────────────────── PDF → 2D πίνακας (ανακατασκευή πίνακα) ─────────────────────────
// Στρατηγική: το pdf2json δίνει για κάθε «κομμάτι» κειμένου θέση (x, y) και πλάτος (w).
// 1) Ομαδοποιούμε σε γραμμές κατά y. 2) Εντοπίζουμε τη γραμμή κεφαλίδων (όσες λέξεις
// ταιριάζουν με γνωστές κεφαλίδες). 3) Από τις κεφαλίδες ορίζουμε όρια στηλών (x) και
// αντιστοιχίζουμε κάθε κελί δεδομένων στη στήλη του. Λειτουργεί για PDF με text layer και
// σταθερή μορφή πίνακα (π.χ. εξαγωγές «ΣΕΠ»). Σαρωμένα PDF (χωρίς κείμενο) δεν υποστηρίζονται.

const PDF_Y_TOL = 0.5 // ανοχή y (μονάδες pdf2json) για να θεωρηθούν δύο items στην ίδια γραμμή

function pdfDecode(t) {
  try {
    return decodeURIComponent(t)
  } catch {
    return t
  }
}

// Text items μιας σελίδας → [{ x, y, str }] (κενά αγνοούνται). ΠΡΟΣΟΧΗ: το πεδίο `w` του
// pdf2json ΔΕΝ είναι στην ίδια κλίμακα με το `x` (είναι πλάτος σε «text space», πολύ μεγαλύτερο)
// — γι' αυτό ΔΕΝ χρησιμοποιείται για όρια στηλών· βασιζόμαστε αποκλειστικά στο x.
function pdfPageItems(page) {
  const texts = (page && page.Texts) || []
  return texts
    .map((t) => ({
      x: Number(t.x) || 0,
      y: Number(t.y) || 0,
      str: (t.R || []).map((r) => pdfDecode(r.T)).join(''),
    }))
    .filter((it) => it.str && it.str.trim() !== '')
}

// Ομαδοποίηση items σε γραμμές κατά y (ταξινομημένες πάνω→κάτω, μέσα στη γραμμή αριστερά→δεξιά).
function pdfClusterRows(items) {
  const rows = []
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(last.y - it.y) <= PDF_Y_TOL) {
      last.items.push(it)
    } else {
      rows.push({ y: it.y, items: [it] })
    }
  }
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x))
  return rows
}

function pdfIsKnownHeader(str) {
  const n = norm(str)
  return Object.values(FIELD_ALIASES).some((aliases) => aliases.includes(n))
}

// Δόμηση κελιών κεφαλίδας: σαρώνουμε αριστερά→δεξιά και ΣΗΜΑΣΙΟΛΟΓΙΚΑ ενώνουμε δύο διαδοχικές
// λέξεις ΜΟΝΟ όταν ο συνδυασμός τους ταιριάζει με γνωστή πολυλεκτική κεφαλίδα (π.χ. «Ημερομηνία»
// + «γέννησης» → «Ημερομηνία γέννησης»). Δεν χρησιμοποιούμε αποστάσεις x για ένωση, γιατί το κενό
// ανάμεσα στις λέξεις μιας κεφαλίδας δεν διακρίνεται γεωμετρικά από το κενό μεταξύ στηλών.
// Κάθε κελί κρατά το x του πρώτου του item ως «άγκυρα» στήλης.
function pdfBuildHeaderCells(items) {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  const cells = []
  let i = 0
  while (i < sorted.length) {
    let take = 1
    if (i + 1 < sorted.length) {
      const two = sorted[i].str.trim() + ' ' + sorted[i + 1].str.trim()
      if (pdfIsKnownHeader(two)) take = 2
    }
    const str = sorted
      .slice(i, i + take)
      .map((s) => s.str.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    cells.push({ x: sorted[i].x, str })
    i += take
  }
  return cells
}

// Δείκτης στήλης ενός item: η άγκυρα με το μεγαλύτερο x που είναι ≤ item.x (floor). Έτσι τα
// πολλαπλά κομμάτια μιας τιμής (π.χ. σύνθετος κωδικός Μονάδας σε 2-3 items) πέφτουν στη σωστή στήλη.
function pdfColIndex(x, anchors) {
  let j = 0
  for (let k = 0; k < anchors.length; k++) {
    if (x >= anchors[k] - 0.01) j = k
    else break
  }
  return j
}

// Ανακατασκευή 2D πίνακα από όλες τις σελίδες· rows[0] = ετικέτες κεφαλίδων.
function pdfRowsFromPages(pages) {
  let headerCells = null
  let anchors = null
  const out = []

  for (const page of pages) {
    const lineRows = pdfClusterRows(pdfPageItems(page))
    if (!lineRows.length) continue

    // Εντοπισμός γραμμής κεφαλίδων σε αυτή τη σελίδα (μέγιστες αναγνωρισμένες κεφαλίδες, ≥2).
    let headerIdx = -1
    let headerScore = 0
    const perRowCells = lineRows.map((r) => pdfBuildHeaderCells(r.items))
    perRowCells.forEach((cells, idx) => {
      const score = cells.reduce((s, c) => s + (pdfIsKnownHeader(c.str) ? 1 : 0), 0)
      if (score > headerScore) {
        headerScore = score
        headerIdx = idx
      }
    })

    if (headerScore >= 2) {
      headerCells = perRowCells[headerIdx]
      anchors = headerCells.map((c) => c.x)
      if (!out.length) out.push(headerCells.map((c) => c.str)) // κεφαλίδα μόνο μία φορά
    }

    if (!headerCells || !anchors) continue // χωρίς κεφαλίδα ακόμη → δεν μπορούμε να χαρτογραφήσουμε

    // Γραμμές δεδομένων: όλες πλην της γραμμής κεφαλίδων αυτής της σελίδας.
    lineRows.forEach((r, idx) => {
      if (idx === headerIdx) return
      const cols = new Array(headerCells.length).fill('')
      for (const it of r.items) {
        const j = pdfColIndex(it.x, anchors)
        cols[j] = cols[j] ? cols[j] + ' ' + it.str.trim() : it.str.trim()
      }
      if (cols.some((c) => c !== '')) out.push(cols.map((c) => c.replace(/\s+/g, ' ').trim()))
    })
  }

  return out
}

// Διαβάζει αρχείο PDF (μέσω pdf2json) και επιστρέφει το ίδιο σχήμα με το parseFile.
async function parsePdf(filePath) {
  const mod = require('pdf2json')
  // Συμβατότητα με default/named/CJS εξαγωγή του pdf2json.
  const PDFParser = (mod && (mod.default || mod.PDFParser)) || mod

  const pdfData = await new Promise((resolve, reject) => {
    const parser = new PDFParser()
    parser.on('pdfParser_dataError', (err) =>
      reject(err && err.parserError ? err.parserError : err)
    )
    parser.on('pdfParser_dataReady', (data) => resolve(data))
    parser.loadPDF(filePath)
  })

  const pages = (pdfData && pdfData.Pages) || []
  return recordsFromRows(pdfRowsFromPages(pages))
}

module.exports = { parseFile, parsePdf, recordsFromRows, parseBirthDate, FIELD_ALIASES }
