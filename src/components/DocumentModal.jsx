import { useEffect, useState } from 'react'
import Modal from './Modal'
import api from '../api'
import SigneePicker, { signeeValid } from './SigneePicker'
import { FileText, Loader2, ArrowLeft } from 'lucide-react'

export default function DocumentModal({ student, onClose }) {
  const [templates, setTemplates] = useState([])
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)
  const [signeeFor, setSigneeFor] = useState(null) // template object που χρειάζεται υπογράφοντα
  const [choice, setChoice] = useState({ type: 'father' })

  useEffect(() => {
    api.listTemplates().then((t) => setTemplates(t || []))
  }, [])

  const hints = {
    father: `${student.patronymo || ''} ${student.eponymo || ''}`.trim(),
    mother: `${student.mitronymo || ''} ${student.eponymo || ''}`.trim(),
  }

  async function doGenerate(file, signee) {
    setBusy(file)
    setMessage(null)
    const res = await api.generateDocument(student.id, file, signee)
    setBusy(null)
    setSigneeFor(null)
    if (res && res.error) setMessage({ type: 'error', text: res.error })
    else if (res && res.ok) setMessage({ type: 'ok', text: 'Το PDF αποθηκεύτηκε (άνοιξε ο φάκελος).' })
  }

  function onTemplateClick(t) {
    if (t.needsSignee) {
      setChoice({ type: 'father' })
      setSigneeFor(t)
    } else {
      doGenerate(t.file, null)
    }
  }

  // Βήμα επιλογής υπογράφοντα
  if (signeeFor) {
    return (
      <Modal
        title="Έκδοση εγγράφου — υπογράφων"
        onClose={onClose}
        footer={
          <>
            <button
              onClick={() => setSigneeFor(null)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> Πίσω
            </button>
            <button
              onClick={() => doGenerate(signeeFor.file, choice)}
              disabled={!signeeValid(choice) || busy}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy ? 'Δημιουργία…' : 'Έκδοση PDF'}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          <strong>{signeeFor.label}</strong> για{' '}
          <strong>
            {student.eponymo} {student.onoma}
          </strong>
        </p>
        <SigneePicker value={choice} onChange={setChoice} allowOther hints={hints} />
      </Modal>
    )
  }

  return (
    <Modal title="Έκδοση εγγράφων" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">
        <strong>
          {student.eponymo} {student.onoma}
        </strong>{' '}
        — {student.school_name || '—'} ({student.current_grade || '—'})
      </p>

      {templates.length === 0 ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Δεν βρέθηκαν templates.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <button
              key={t.file}
              onClick={() => onTemplateClick(t)}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === t.file ? (
                <Loader2 size={16} className="animate-spin text-blue-600" />
              ) : (
                <FileText size={16} className="text-blue-600" />
              )}
              <span>{t.label}</span>
              {t.needsSignee && <span className="ml-auto text-xs text-slate-400">απαιτεί υπογράφοντα</span>}
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
