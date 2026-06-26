import { useState } from 'react'
import Modal from './Modal'
import { Trash2 } from 'lucide-react'

// Modal επιβεβαίωσης διαγραφής με προαιρετικό λόγο (ελεύθερο κείμενο, Γ1/Γ2).
// Electron δεν υποστηρίζει window.prompt — γι' αυτό χρησιμοποιούμε modal.
export default function DeleteReasonModal({ title = 'Διαγραφή μαθητή', message, count, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    await onConfirm(reason.trim())
    setBusy(false)
    onClose()
  }

  const footer = (
    <>
      <button
        onClick={onClose}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Άκυρο
      </button>
      <button
        onClick={confirm}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
      >
        <Trash2 size={15} /> {busy ? 'Γίνεται…' : count ? `Διαγραφή ${count}` : 'Διαγραφή'}
      </button>
    </>
  )

  return (
    <Modal title={title} onClose={onClose} footer={footer}>
      <div className="space-y-3">
        {message && <p className="text-sm text-slate-600">{message}</p>}
        <div>
          <label className="mb-1 block text-sm text-slate-600">Λόγος διαγραφής (προαιρετικό)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="π.χ. αναχώρηση από τη δομή, μετεγγραφή, ενηλικίωση…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            autoFocus
          />
        </div>
      </div>
    </Modal>
  )
}
