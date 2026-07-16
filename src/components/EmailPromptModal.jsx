import Modal from './Modal'
import { Mail, Download } from 'lucide-react'

// Επιβεβαίωση εισαγωγής νέας λίστας που βρέθηκε στο e-mail (sch.gr).
export default function EmailPromptModal({ prompt, busy, onImport, onClose }) {
  const dateStr = prompt.date ? new Date(prompt.date).toLocaleDateString('el-GR') : ''

  const footer = (
    <>
      <button
        onClick={onClose}
        disabled={busy}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
      >
        Όχι τώρα
      </button>
      <button
        onClick={() => onImport(prompt)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        <Download size={15} /> {busy ? 'Εισαγωγή…' : 'Εισαγωγή'}
      </button>
    </>
  )

  return (
    <Modal title="Νέα λίστα πληθυσμού" onClose={busy ? () => {} : onClose} footer={footer}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-600">
          <Mail size={20} />
        </div>
        <div className="min-w-0 text-sm text-slate-700">
          <p className="mb-2">
            Βρέθηκε καινούρια λίστα <strong>«{prompt.filename}»</strong>. Να εισαχθεί;
          </p>
          {prompt.subject && (
            <p className="truncate text-xs text-slate-500">Θέμα: {prompt.subject}</p>
          )}
          {dateStr && <p className="text-xs text-slate-500">Ημερομηνία e-mail: {dateStr}</p>}
          <p className="mt-2 text-xs text-slate-400">
            Η εισαγωγή ακολουθεί τους ίδιους κανόνες με τη χειροκίνητη (σχολική ηλικία, διπλά ΔΙΚΑ,
            ανίχνευση αποχωρήσεων).
          </p>
        </div>
      </div>
    </Modal>
  )
}
