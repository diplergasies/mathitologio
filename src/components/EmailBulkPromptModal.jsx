import Modal from './Modal'
import { Mail, Download } from 'lucide-react'

// Πρώτη χρήση (άδεια βάση): βρέθηκαν πολλές λίστες στο e-mail. Επιλογή: όλες με χρονολογική σειρά
// (σωστό ιστορικό αφίξεων/αποχωρήσεων) ή μόνο η πιο πρόσφατη.
export default function EmailBulkPromptModal({ lists, busy, onImportAll, onImportLatest, onClose }) {
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleString('el-GR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'
  const latest = lists[lists.length - 1]

  const btn = 'rounded-md px-3 py-1.5 text-sm disabled:opacity-40'
  const footer = (
    <>
      <button onClick={onClose} disabled={busy} className={`${btn} border border-slate-300 text-slate-600 hover:bg-slate-50`}>
        Όχι τώρα
      </button>
      <button
        onClick={() => onImportLatest(latest)}
        disabled={busy}
        className={`${btn} border border-blue-300 text-blue-700 hover:bg-blue-50`}
      >
        Μόνο την πιο πρόσφατη
      </button>
      <button
        onClick={onImportAll}
        disabled={busy}
        className={`${btn} inline-flex items-center gap-1.5 bg-blue-600 font-medium text-white hover:bg-blue-700`}
      >
        <Download size={15} /> {busy ? 'Εισαγωγή…' : `Εισαγωγή όλων (${lists.length})`}
      </button>
    </>
  )

  return (
    <Modal title="Βρέθηκαν λίστες πληθυσμού" onClose={busy ? () => {} : onClose} footer={footer}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-600">
          <Mail size={20} />
        </div>
        <div className="min-w-0 flex-1 text-sm text-slate-700">
          <p className="mb-2">
            Βρέθηκαν <strong>{lists.length} λίστες</strong> στο e-mail. Αφού δεν έχει εισαχθεί ακόμη καμία,
            μπορούν να εισαχθούν <strong>όλες με χρονολογική σειρά</strong>: κάθε μαθητής παίρνει ως
            ημερομηνία άφιξης την ημερομηνία της πρώτης λίστας όπου εμφανίστηκε, και στο τέλος
            εμφανίζονται όσοι έχουν αποχωρήσει στο μεταξύ.
          </p>
          <ul className="max-h-56 overflow-y-auto rounded-md border border-slate-200 text-xs">
            {lists.map((l) => (
              <li key={`${l.mailbox}:${l.uid}`} className="flex gap-3 border-b border-slate-100 px-2 py-1 last:border-0">
                <span className="shrink-0 tabular-nums text-slate-500">{fmt(l.date)}</span>
                <span className="truncate">{l.filename}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            Η επιλογή αυτή εμφανίζεται μόνο στην πρώτη εισαγωγή. Μετά, κάθε νέα λίστα προτείνεται
            ξεχωριστά όπως πάντα.
          </p>
        </div>
      </div>
    </Modal>
  )
}
