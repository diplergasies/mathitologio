import { useState } from 'react'
import Modal from './Modal'
import api from '../api'
import { AlertTriangle, Trash2 } from 'lucide-react'

const CONFIRM_WORD = 'ΔΙΑΓΡΑΦΗ'

// Ολικό reset δεδομένων — μη αναστρέψιμο. Απαιτεί πληκτρολόγηση λέξης επιβεβαίωσης.
export default function ResetDataModal({ onClose, onDone }) {
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = word.trim().toUpperCase() === CONFIRM_WORD

  async function confirm() {
    if (!ok) return
    setBusy(true)
    const res = await api.resetAllData()
    setBusy(false)
    if (res && res.ok) {
      onDone && onDone()
      onClose()
    }
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
        disabled={!ok || busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
      >
        <Trash2 size={15} /> {busy ? 'Γίνεται…' : 'Οριστική διαγραφή όλων'}
      </button>
    </>
  )

  return (
    <Modal title="Reset — διαγραφή όλων των δεδομένων" onClose={onClose} footer={footer}>
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            Θα διαγραφούν <strong>όλοι οι μαθητές</strong> από Αφίξεις, Μαθητές και Διαγραφές (και
            συνεπώς Παρατηρητήριο & Αποτύπωση). Η ενέργεια είναι <strong>μη αναστρέψιμη</strong>.
            <br />
            Διατηρούνται: σχολεία, ρυθμίσεις, πρότυπα εγγράφων.
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Πρότεινε να κρατήσεις πρώτα ένα αντίγραφο ασφαλείας (Backup). Για επιβεβαίωση, γράψε{' '}
          <strong>{CONFIRM_WORD}</strong>:
        </p>
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder={CONFIRM_WORD}
          autoFocus
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
        />
      </div>
    </Modal>
  )
}
