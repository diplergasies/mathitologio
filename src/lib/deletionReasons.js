// Λόγοι διαγραφής: προεπιλεγμένος («Αποχώρηση από <Δομή>») + συνηθισμένοι λόγοι που αποθήκευσε
// ο χρήστης. Οι συνηθισμένοι κρατιούνται ως JSON πίνακας στη ρύθμιση deletion_reasons (KV settings).
import { fold } from '../search'

export const REASONS_KEY = 'deletion_reasons'

// Προεπιλεγμένος λόγος: «Αποχώρηση από {{Δομή}}» (από Ρυθμίσεις → Δομή φιλοξενίας).
export function defaultReason(settings) {
  const domi = String((settings && settings.domi) || '').trim()
  return domi ? `Αποχώρηση από ${domi}` : 'Αποχώρηση από τη δομή'
}

// Αποθηκευμένοι συνηθισμένοι λόγοι (χωρίς κενά/διπλά και χωρίς τον προεπιλεγμένο).
export function loadSavedReasons(settings) {
  let arr = []
  try {
    const raw = settings && settings[REASONS_KEY]
    arr = raw ? JSON.parse(raw) : []
  } catch {
    arr = []
  }
  if (!Array.isArray(arr)) arr = []
  return dedupeReasons(arr, defaultReason(settings))
}

// Καθάρισμα λίστας: trim, αφαίρεση κενών και διπλών (αγνοώντας τόνους/πεζά-κεφαλαία).
export function dedupeReasons(list, exclude = '') {
  const seen = new Set(exclude ? [fold(exclude.trim())] : [])
  const out = []
  for (const r of list) {
    const t = String(r == null ? '' : r).trim()
    if (!t) continue
    const k = fold(t)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}
