import { useEffect, useState } from 'react'
import Modal from './Modal'
import api from '../api'
import { FileText, Loader2 } from 'lucide-react'

export default function DocumentModal({ student, onClose }) {
  const [templates, setTemplates] = useState([])
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    api.listTemplates().then((t) => setTemplates(t || []))
  }, [])

  async function generate(file) {
    setBusy(file)
    setMessage(null)
    const res = await api.generateDocument(student.id, file)
    setBusy(null)
    if (res && res.error) setMessage({ type: 'error', text: res.error })
    else if (res && res.ok)
      setMessage({ type: 'ok', text: 'Το PDF αποθηκεύτηκε (άνοιξε ο φάκελος).' })
  }

  return (
    <Modal title="Έκδοση εγγράφων" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">
        <strong>
          {student.eponymo} {student.onoma}
        </strong>{' '}
        — {student.school_name} ({student.current_grade})
      </p>

      {templates.length === 0 ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Δεν βρέθηκαν templates. Τοποθέτησε τα αρχεία .pptx στον φάκελο των templates της εφαρμογής.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <button
              key={t.file}
              onClick={() => generate(t.file)}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === t.file ? (
                <Loader2 size={16} className="animate-spin text-blue-600" />
              ) : (
                <FileText size={16} className="text-blue-600" />
              )}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {message && (
        <p
          className={`mt-3 rounded-md p-2 text-sm ${
            message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {message.text}
        </p>
      )}
    </Modal>
  )
}
