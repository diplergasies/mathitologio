import { useEffect, useState } from 'react'
import Modal from './Modal'
import api from '../api'
import SigneePicker, { signeeValid } from './SigneePicker'
import { FileText, Loader2, ArrowLeft } from 'lucide-react'

export default function DocumentModal({ student, onClose }) {
  const [templates, setTemplates] = useState([])
  const [schools, setSchools] = useState([])
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)
  const [detailsFor, setDetailsFor] = useState(null) // template object που χρειάζεται στοιχεία (υπογράφων / ελεύθερα πεδία)
  const [choice, setChoice] = useState({ type: 'father' })
  const [extras, setExtras] = useState({}) // { [token]: value } για «άγνωστα» tokens (π.χ. σχολεία)

  useEffect(() => {
    api.listTemplates().then((t) => setTemplates(t || []))
    api.listSchools().then((s) => setSchools(s || []))
  }, [])

  const hints = {
    father: `${student.patronymo || ''} ${student.eponymo || ''}`.trim(),
    mother: `${student.mitronymo || ''} ${student.eponymo || ''}`.trim(),
  }

  // Πεδία που πρέπει να συμπληρώσει ο χρήστης την ώρα της έκδοσης:
  //  - askFields: tokens με prefix ? (σταθερά στοιχεία χρήστη) → φιλική ετικέτα + θυμημένη τιμή, χωρίς λίστα σχολείων.
  //  - unknownTokens: «άγνωστα» tokens ανά έγγραφο (π.χ. σχολείο προορισμού) → με λίστα σχολείων, πάντα κενά.
  // Επιστρέφει ενιαία αντικείμενα { token (raw data-key), label, value, useSchoolList }.
  const fieldsOf = (t) => {
    if (!t) return []
    const ask = (t.askFields || []).map((a) => ({
      token: a.token,
      label: a.label,
      value: a.value || '',
      useSchoolList: false,
    }))
    const unknown = (t.unknownTokens || []).map((tok) => ({
      token: tok,
      label: tok,
      value: '',
      useSchoolList: true,
    }))
    return [...ask, ...unknown]
  }

  async function doGenerate(file, signee, extrasVal) {
    setBusy(file)
    setMessage(null)
    const res = await api.generateDocument(student.id, file, signee, extrasVal)
    setBusy(null)
    setDetailsFor(null)
    if (res && res.error) setMessage({ type: 'error', text: res.error })
    else if (res && res.ok) setMessage({ type: 'ok', text: 'Το PDF αποθηκεύτηκε (άνοιξε ο φάκελος).' })
  }

  function onTemplateClick(t) {
    const fields = fieldsOf(t)
    if (t.needsSignee || fields.length) {
      setChoice({ type: 'father' })
      // Seed με data-key = raw token· τα ask-πεδία παίρνουν την θυμημένη τιμή, τα υπόλοιπα κενό.
      setExtras(Object.fromEntries(fields.map((f) => [f.token, f.value])))
      setDetailsFor(t)
    } else {
      doGenerate(t.file, null, null)
    }
  }

  // Βήμα συμπλήρωσης στοιχείων (υπογράφων + ελεύθερα πεδία, π.χ. σχολεία μετεγγραφής)
  if (detailsFor) {
    const fields = fieldsOf(detailsFor)
    const extrasValid = fields.every((f) => (extras[f.token] || '').trim())
    const valid = (!detailsFor.needsSignee || signeeValid(choice)) && extrasValid
    return (
      <Modal
        title="Έκδοση εγγράφου — στοιχεία"
        onClose={onClose}
        footer={
          <>
            <button
              onClick={() => setDetailsFor(null)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> Πίσω
            </button>
            <button
              onClick={() => doGenerate(detailsFor.file, detailsFor.needsSignee ? choice : null, extras)}
              disabled={!valid || busy}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy ? 'Δημιουργία…' : 'Έκδοση PDF'}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          <strong>{detailsFor.label}</strong> για{' '}
          <strong>
            {student.eponymo} {student.onoma}
          </strong>
        </p>

        {fields.length > 0 && (
          <div className="mb-4 space-y-3">
            <datalist id="dm-schools">
              {schools.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            {fields.map((f) => (
              <label key={f.token} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{f.label}</span>
                <input
                  type="text"
                  {...(f.useSchoolList ? { list: 'dm-schools' } : {})}
                  value={extras[f.token] || ''}
                  onChange={(e) => setExtras((p) => ({ ...p, [f.token]: e.target.value }))}
                  placeholder={f.useSchoolList ? 'Πληκτρολόγησε ή επίλεξε από τη λίστα…' : 'Συμπλήρωσε…'}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
            ))}
          </div>
        )}

        {detailsFor.needsSignee && <SigneePicker value={choice} onChange={setChoice} allowOther hints={hints} />}
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
          {templates.map((t) => {
            const extraCount = fieldsOf(t).length
            return (
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
                {(t.needsSignee || extraCount > 0) && (
                  <span className="ml-auto text-xs text-slate-400">
                    {[t.needsSignee ? 'υπογράφων' : null, extraCount > 0 ? 'στοιχεία' : null]
                      .filter(Boolean)
                      .join(' + ')}
                  </span>
                )}
              </button>
            )
          })}
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
