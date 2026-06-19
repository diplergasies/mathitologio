// Αναζήτηση μαθητών: accent-insensitive (αγνοεί τόνους/πεζά-κεφαλαία) με σωστή
// αντιστοίχιση θέσεων ώστε να χρωματίζεται το ακριβές τμήμα στο ΑΡΧΙΚΟ κείμενο.

// "Δίπλωμα" χαρακτήρα: πεζά + αφαίρεση τόνων/διακριτικών.
export function fold(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Επιστρέφει { folded, map } όπου map[i] = θέση στο αρχικό κείμενο του folded[i].
function foldMap(str) {
  let folded = ''
  const map = []
  for (let i = 0; i < str.length; i++) {
    const dec = fold(str[i])
    for (let j = 0; j < dec.length; j++) {
      folded += dec[j]
      map.push(i)
    }
  }
  return { folded, map }
}

// Πεδία μαθητή που συμμετέχουν στην αναζήτηση (όλα τα ουσιαστικά στοιχεία).
const SEARCH_FIELDS = [
  'eponymo', 'onoma', 'patronymo', 'mitronymo', 'fylo', 'glossa', 'ithageneia',
  'dika', 'monada', 'imerominia_gennisis', 'imerominia_afixis', 'birth_year',
  'school_name', 'school_type', 'current_grade', 'computed_type', 'computed_grade', 'epitropos',
]

export function studentHaystack(s) {
  return SEARCH_FIELDS.map((k) => (s[k] == null ? '' : s[k])).join('  ')
}

// Διασπά το κείμενο σε τμήματα { text, hit } επισημαίνοντας τα matches του όρου.
export function matchSegments(text, term) {
  const original = String(text ?? '')
  const t = fold(term)
  if (!t) return [{ text: original, hit: false }]

  const { folded, map } = foldMap(original)
  const segs = []
  let from = 0
  let lastOrig = 0
  let idx
  while ((idx = folded.indexOf(t, from)) !== -1) {
    const start = map[idx]
    const end = map[idx + t.length - 1] + 1
    if (start > lastOrig) segs.push({ text: original.slice(lastOrig, start), hit: false })
    segs.push({ text: original.slice(start, end), hit: true })
    lastOrig = end
    from = idx + t.length
  }
  if (lastOrig < original.length) segs.push({ text: original.slice(lastOrig), hit: false })
  return segs.length ? segs : [{ text: original, hit: false }]
}
