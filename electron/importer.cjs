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

// Διαβάζει το αρχείο και επιστρέφει { records: [...], headerMap, missingFields, totalRows }.
function parseFile(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })

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

module.exports = { parseFile, parseBirthDate, FIELD_ALIASES }
