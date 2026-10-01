import { X, CheckCircle2 } from 'lucide-react'

// Διακριτική, μη-παρεμποδιστική μπάρα στην κορυφή: μια ενημέρωση κατέβηκε σιωπηλά και θα
// εφαρμοστεί & θα ανοίξει ξανά μόνη της στο κλείσιμο (συνοδεύεται και από ειδοποίηση OS).
export default function UpdateBanner({ state, onDismiss }) {
  if (state?.state !== 'silent-ready') return null
  return (
    <div className="flex items-center gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-800">
      <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
      <span className="flex-1">
        Μια ενημέρωση είναι έτοιμη και θα εφαρμοστεί όταν κλείσετε την εφαρμογή — <strong>θα ανοίξει
        ξανά μόνη της</strong>. Μετά το κλείσιμο μην την ανοίξετε εσείς· περιμένετε λίγο.
      </span>
      <button
        onClick={() => onDismiss?.(state?.version)}
        title="Απόκρυψη"
        className="rounded p-1 text-emerald-600 hover:bg-emerald-100"
      >
        <X size={16} />
      </button>
    </div>
  )
}
