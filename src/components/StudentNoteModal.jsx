import { useState } from 'react'
import Modal from './Modal'
import { Trash2 } from 'lucide-react'

// Pop-up ελεύθερης σημείωσης για έναν μαθητή (ένα ενιαίο text-box). Το κείμενο φαίνεται μόνο εδώ,
// όχι στον πίνακα. Η σημείωση ακολουθεί τον μαθητή σε Αφίξεις/Μαθητές/Διαγραφές.
export default function StudentNoteModal({ student, onSave, onClose }) {
  const [text, setText] = useState(student.note || '')
  const [busy, setBusy] = useState(false)
  const hadNote = !!(student.note && String(student.note).trim())

  async function save(value) {
    if (busy) return
    setBusy(true)
    await onSave(value)
  }

  const footer = (
    <>
      {hadNote && (
        <button
          onClick={() => save('')}
          disabled={busy}
          className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          <Trash2 size={15} /> Καθαρισμός
        </button>
      )}
      <button
        onClick={onClose}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Άκυρο
      </button>
      <button
        onClick={() => save(text)}
        disabled={busy}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {busy ? 'Γίνεται…' : 'Αποθήκευση'}
      </button>
    </>
  )

  const fullName = `${student.eponymo || ''} ${student.onoma || ''}`.trim()

  return (
    <Modal title={fullName ? `Σημείωση — ${fullName}` : 'Σημείωση'} onClose={onClose} footer={footer}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        rows={6}
        placeholder="Γράψε ό,τι θέλεις για τον μαθητή…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
      />
    </Modal>
  )
}
