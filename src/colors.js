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
