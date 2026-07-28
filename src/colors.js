// Παλέτα απαλών αποχρώσεων ανά batch (κυκλική, 8 χρώματα).
// Κάθε batch παίρνει διαφορετική απόχρωση ώστε να ξεχωρίζει οπτικά στους πίνακες.
export const BATCH_COLORS = [
  { bg: '#eef4ff', border: '#c7d8f5' }, // μπλε
  { bg: '#fef3ee', border: '#f5d2c0' }, // πορτοκαλί
  { bg: '#eefaf0', border: '#c5e8cf' }, // πράσινο
  { bg: '#fdeef6', border: '#f3c9e2' }, // ροζ
  { bg: '#fbf7e8', border: '#ecdfaf' }, // κίτρινο
  { bg: '#eef9fb', border: '#bfe4ec' }, // γαλάζιο
  { bg: '#f3eefb', border: '#d8c7ef' }, // μωβ
  { bg: '#f0f1f3', border: '#d3d6dc' }, // γκρι
]

export function batchColor(colorIndex) {
  const i = ((Number(colorIndex) || 0) % BATCH_COLORS.length + BATCH_COLORS.length) % BATCH_COLORS.length
  return BATCH_COLORS[i]
}

// Χειροκίνητη παλέτα «color code» (6 χρώματα) που δίνει ο χρήστης στις γραμμές μαθητών
// ώστε διαφορετικοί ΣΕΠ στην ίδια δομή να τους ξεχωρίζουν. Πιο κορεσμένα από τα batch
// χρώματα (για να ξεχωρίζουν καθαρά) αλλά αρκετά ανοιχτά ώστε να αντιθέτουν με το σκούρο
// κείμενο (slate-700) των πινάκων.
export const CODE_COLORS = [
  '#fca5a5', // κόκκινο
  '#fdba74', // πορτοκαλί
  '#fde047', // κίτρινο
  '#86efac', // πράσινο
  '#7dd3fc', // γαλάζιο
  '#c4b5fd', // μωβ
]
