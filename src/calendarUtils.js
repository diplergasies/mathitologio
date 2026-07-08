// Κοινοί βοηθοί ημερολογίου/ημερομηνιών (καθαρό JS, χωρίς εξαρτήσεις).

export const MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

// Ημέρες εβδομάδας, Δευτέρα-πρώτη (σύντομες + πλήρεις).
export const DOW_SHORT = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ']
export const DOW_FULL = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή']

const p2 = (n) => String(n).padStart(2, '0')

// Date -> 'YYYY-MM-DD' (τοπικά components).
export function toKey(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

// 'YYYY-MM-DD' -> 'DD/MM/YYYY'.
export function keyToDMY(key) {
  const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// ISO datetime (ή οτιδήποτε δέχεται ο Date) -> 'DD/MM/YYYY' (μόνο ημερομηνία) ή '' αν άκυρο.
export function isoToDMY(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Δείκτης ημέρας εβδομάδας με Δευτέρα=0 … Κυριακή=6.
function mondayIndex(d) {
  return (d.getDay() + 6) % 7
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonths(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
  return x
}

// Αρχή εβδομάδας (Δευτέρα) για την ημερομηνία d.
export function startOfWeek(d) {
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -mondayIndex(d))
}

// Πλέγμα μήνα: 42 ημερομηνίες (6 εβδομάδες × 7), Δευτέρα-πρώτη, καλύπτει τον μήνα του cursor.
export function monthGrid(cursor) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

// Οι 7 ημερομηνίες της εβδομάδας που περιέχει το cursor (Δευτέρα-πρώτη).
export function weekDays(cursor) {
  const start = startOfWeek(cursor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
