// Βοηθητικά για ταξινόμηση μαθητών (ηλικιακή / ανά σχολείο-βαθμίδα).

// Αριθμητική τιμή ημ. γέννησης (yyyymmdd) για ηλικιακή ταξινόμηση.
// Μικρότερη τιμή = μεγαλύτερος μαθητής (παλαιότερη ημερομηνία).
export function birthSortValue(s) {
  const m = String(s.imerominia_gennisis || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return Number(m[3] + m[2] + m[1])
  return s.birth_year ? Number(s.birth_year) * 10000 : null
}

// Σειρά βαθμίδων (για ταξινόμηση κατά προτεινόμενο τύπο σχολείου).
const TYPE_RANK = {
  'Νηπιαγωγείο': 1,
  'Δημοτικό': 2,
  'Γυμνάσιο': 3,
  'Λύκειο': 4,
  'ΕΠΑΛ': 5,
}

// Τιμή ταξινόμησης κατά προτεινόμενη βαθμίδα, με δευτερεύον κριτήριο την ηλικία.
export function proposedSortValue(s) {
  const rank = TYPE_RANK[s.computed_type] || 9
  const birth = birthSortValue(s) || 0
  return rank * 1e9 + birth
}
