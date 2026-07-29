import { DownloadCloud, X, RotateCw, CheckCircle2 } from 'lucide-react'

// Καρφιτσωμένη, μη-παρεμποδιστική μπάρα στην κορυφή.
//  • Σημαντικές (major): «διαθέσιμη» → «Λήψη» → πρόοδος → «Επανεκκίνηση εφαρμογής» (ο χρήστης
//    αποφασίζει πότε γίνεται η επανεκκίνηση — δεν γίνεται αυτόματα).
//  • Σιωπηλές (silent-ready): διακριτική ενημέρωση ότι θα εφαρμοστεί & θα ανοίξει ξανά μόνη της
//    στο κλείσιμο (συνοδεύεται και από ειδοποίηση OS).
export default function UpdateBanner({ state, onDownload, onInstall, onDismiss }) {
  const phase = state?.state
  // Ορατή έκδοση = μόνο major.minor (ίδιο σκεπτικό με το header).
  const version = state?.version ? String(state.version).split('.').slice(0, 2).join('.') : ''
  const percent = state?.percent ?? 0

  // Σιωπηλή ενημέρωση έτοιμη — διακριτική, πρασινωπή μπάρα (χωρίς κουμπί ενέργειας).
  if (phase === 'silent-ready') {
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

  return (
    <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-5 py-2.5 text-sm text-blue-800">
      <DownloadCloud size={18} className="shrink-0 text-blue-600" />

      {phase === 'available' && (
        <>
          <span className="flex-1">
            Νέα έκδοση{version ? ` ${version}` : ''} του Μαθητολογίου είναι διαθέσιμη.
          </span>
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <DownloadCloud size={14} /> Λήψη
          </button>
          <button
            onClick={() => onDismiss(state?.version)}
            title="Απόκρυψη"
            className="rounded p-1 text-blue-500 hover:bg-blue-100"
          >
            <X size={16} />
          </button>
        </>
      )}

      {phase === 'downloading' && (
        <>
          <span className="shrink-0">Λήψη ενημέρωσης… {percent}%</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      )}

      {(phase === 'downloaded' || phase === 'installing') && (
        <>
          <span className="flex-1">
            Η ενημέρωση{version ? ` ${version}` : ''} κατέβηκε. Πατήστε για επανεκκίνηση όποτε είστε
            έτοιμοι — η εφαρμογή θα κλείσει, θα εγκατασταθεί η ενημέρωση και θα ανοίξει ξανά.
          </span>
          <button
            onClick={onInstall}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <RotateCw size={14} /> Επανεκκίνηση εφαρμογής
          </button>
          <button
            onClick={() => onDismiss?.(state?.version)}
            title="Αργότερα"
            className="rounded p-1 text-blue-500 hover:bg-blue-100"
          >
            <X size={16} />
          </button>
        </>
      )}
    </div>
  )
}
