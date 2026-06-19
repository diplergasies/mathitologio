'use strict'

// Αντιστοίχιση έτους γέννησης → τύπος σχολείου & τάξη (επίσημη ελληνική κλίμακα).
// Για σχολικό έτος που ξεκινά το έτος Y (π.χ. 2025 για 2025-2026):
//   ηλικία = Y - έτος γέννησης
//     4        -> Νηπιαγωγείο / Προνήπιο
//     5        -> Νηπιαγωγείο / Νήπιο
//     6..11    -> Δημοτικό  Α′..ΣΤ′
//     12..14   -> Γυμνάσιο  Α′..Γ′
//     15..17   -> Λύκειο ή ΕΠΑΛ  Α′..Γ′
// Έλεγχος: Y=2025 -> Προνήπιο=2021, Α′Δημ=2019, Γ′Λυκ=2008.

const SCHOOL_TYPES = ['Νηπιαγωγείο', 'Δημοτικό', 'Γυμνάσιο', 'Λύκειο', 'ΕΠΑΛ']

const DIMOTIKO_GRADES = ['Α′', 'Β′', 'Γ′', 'Δ′', 'Ε′', 'ΣΤ′']
const TRIETIA_GRADES = ['Α′', 'Β′', 'Γ′'] // Γυμνάσιο / Λύκειο / ΕΠΑΛ

// Λίστα έγκυρων τάξεων ανά τύπο σχολείου (για το modal αλλαγής τάξης).
function gradesForType(type) {
  switch (type) {
    case 'Νηπιαγωγείο':
      return ['Προνήπιο', 'Νήπιο']
    case 'Δημοτικό':
      return DIMOTIKO_GRADES.slice()
    case 'Γυμνάσιο':
    case 'Λύκειο':
    case 'ΕΠΑΛ':
      return TRIETIA_GRADES.slice()
    default:
      return []
  }
}

// Επιστρέφει { category, grade, eligibleTypes } ή null αν εκτός σχολικής ηλικίας.
// category = ο "λογικός" τύπος βαθμίδας· eligibleTypes = τύποι σχολείων όπου μπορεί να εγγραφεί.
function classify(birthYear, schoolYearStart) {
  const Y = Number(schoolYearStart)
  const age = Y - Number(birthYear)

  if (age === 4) return { category: 'Νηπιαγωγείο', grade: 'Προνήπιο', eligibleTypes: ['Νηπιαγωγείο'] }
  if (age === 5) return { category: 'Νηπιαγωγείο', grade: 'Νήπιο', eligibleTypes: ['Νηπιαγωγείο'] }
  if (age >= 6 && age <= 11) {
    return { category: 'Δημοτικό', grade: DIMOTIKO_GRADES[age - 6], eligibleTypes: ['Δημοτικό'] }
  }
  if (age >= 12 && age <= 14) {
    return { category: 'Γυμνάσιο', grade: TRIETIA_GRADES[age - 12], eligibleTypes: ['Γυμνάσιο'] }
  }
  if (age >= 15 && age <= 17) {
    // Ηλικίες Λυκείου: επιτρέπεται Λύκειο (ΓΕΛ) ή ΕΠΑΛ.
    return { category: 'Λύκειο', grade: TRIETIA_GRADES[age - 15], eligibleTypes: ['Λύκειο', 'ΕΠΑΛ'] }
  }
  return null
}

function isSchoolAge(birthYear, schoolYearStart) {
  return classify(birthYear, schoolYearStart) !== null
}

// Προβιβασμός: από (τύπος, τάξη) -> επόμενο βήμα.
// Επιστρέφει { type, grade } (επόμενη τάξη, ίσως νέος τύπος στα όρια βαθμίδας),
// ή { graduated: true } (απόφοιτος Γ′ Λυκείου/ΕΠΑΛ), ή null αν άγνωστο.
function promote(type, grade) {
  if (type === 'Νηπιαγωγείο') {
    if (grade === 'Προνήπιο') return { type: 'Νηπιαγωγείο', grade: 'Νήπιο' }
    return { type: 'Δημοτικό', grade: 'Α′' } // Νήπιο -> Δημοτικό
  }
  if (type === 'Δημοτικό') {
    const i = DIMOTIKO_GRADES.indexOf(grade)
    if (i < 0) return null
    if (i < DIMOTIKO_GRADES.length - 1) return { type: 'Δημοτικό', grade: DIMOTIKO_GRADES[i + 1] }
    return { type: 'Γυμνάσιο', grade: 'Α′' } // ΣΤ′ -> Γυμνάσιο
  }
  if (type === 'Γυμνάσιο') {
    const i = TRIETIA_GRADES.indexOf(grade)
    if (i < 0) return null
    if (i < TRIETIA_GRADES.length - 1) return { type: 'Γυμνάσιο', grade: TRIETIA_GRADES[i + 1] }
    return { type: 'Λύκειο', grade: 'Α′' } // Γ′ Γυμνασίου -> Λύκειο (ή ΕΠΑΛ — default Λύκειο)
  }
  if (type === 'Λύκειο' || type === 'ΕΠΑΛ') {
    const i = TRIETIA_GRADES.indexOf(grade)
    if (i < 0) return null
    if (i < TRIETIA_GRADES.length - 1) return { type, grade: TRIETIA_GRADES[i + 1] }
    return { graduated: true } // Γ′ -> απόφοιτος
  }
  return null
}

// Το έτος έναρξης του τρέχοντος σχολικού έτους με βάση μια ημερομηνία.
// Το σχολικό έτος αλλάζει ~1 Σεπτεμβρίου: μήνες Ιαν–Αυγ ανήκουν στο έτος που ξεκίνησε πέρυσι.
function currentSchoolYearStart(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth() // 0=Ιαν
  return m >= 8 ? y : y - 1
}

function schoolYearLabel(start) {
  return `${start}-${start + 1}`
}

// Διάρκειες βαθμίδων (έτη) ανά ηλικιακό εύρος.
const TYPE_AGES = [
  { type: 'Νηπιαγωγείο', minAge: 4, maxAge: 5 },
  { type: 'Δημοτικό', minAge: 6, maxAge: 11 },
  { type: 'Γυμνάσιο', minAge: 12, maxAge: 14 },
  { type: 'Λύκειο/ΕΠΑΛ', minAge: 15, maxAge: 17 },
]

// Πίνακας τύπων σχολείου -> εύρος ετών γέννησης, για δεδομένο έτος έναρξης σχ. έτους S.
function gradeTable(S) {
  S = Number(S)
  return TYPE_AGES.map((t) => ({
    type: t.type,
    fromYear: S - t.maxAge, // μεγαλύτερος μαθητής → μικρότερο έτος γέννησης
    toYear: S - t.minAge, // μικρότερος μαθητής → μεγαλύτερο έτος γέννησης
    years: t.maxAge - t.minAge + 1,
  }))
}

// Το έτος γέννησης του προνηπίου (μικρότερη ηλικία Νηπιαγωγείου) = S - 4.
function nipiagogeioYear(S) {
  return Number(S) - 4
}

// Αντίστροφο: από το έτος προνηπίου P προκύπτει το έτος έναρξης σχ. έτους S = P + 4.
function schoolYearStartFromNip(P) {
  return Number(P) + 4
}

module.exports = {
  SCHOOL_TYPES,
  gradesForType,
  classify,
  isSchoolAge,
  promote,
  currentSchoolYearStart,
  schoolYearLabel,
  gradeTable,
  nipiagogeioYear,
  schoolYearStartFromNip,
}
