import { DownloadCloud, X, Loader2 } from 'lucide-react'

// Καρφιτσωμένη, μη-παρεμποδιστική μπάρα στην κορυφή — μόνο για σημαντικές ενημερώσεις.
// Μένει ορατή μέχρι ο χρήστης να πατήσει «Λήψη» ή «×».
export default function UpdateBanner({ state, onDownload, onDismiss }) {
  const phase = state?.state
  // Ορατή έκδοση = μόνο major.minor (ίδιο σκεπτικό με το header).
  const version = state?.version ? String(state.version).split('.').slice(0, 2).join('.') : ''
  const percent = state?.percent ?? 0

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
        <span className="flex flex-1 items-center gap-2">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          Η ενημέρωση εφαρμόζεται… το πρόγραμμα θα επανεκκινήσει.
        </span>
      )}
    </div>
  )
}
