import { useEffect, useState } from 'react'
import Modal from './Modal'
import api from '../api'
import SigneePicker, { signeeValid } from './SigneePicker'
import { Loader2, ArrowLeft } from 'lucide-react'

// Δέχεται είτε `students` (αντικείμενα με ονόματα) είτε παλιό `ids` (μόνο id).
export default function BulkDocumentModal({ students, ids: idsProp, onClose }) {
  const list = (students && students.length ? students : (idsProp || []).map((id) => ({ id })))
  const ids = list.map((s) => s.id)

  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [signeeStep, setSigneeStep] = useState(false)
  const [signees, setSignees] = useState({}) // { [id]: choice }

  useEffect(() => {
    api.listTemplates().then((t) => {
      const arr = t || []
      setTemplates(arr)
      setSelected(arr.map((x) => x.file))
    })
  }, [])

  // Αρχικοποίηση επιλογής υπογράφοντα ανά μαθητή (default: Πατέρας).
  const idsKey = ids.join(',')
  useEffect(() => {
    setSignees((prev) => {
      const next = { ...prev }
      for (const id of ids) if (!next[id]) next[id] = { type: 'father' }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  function toggle(file) {
    setSelected((sel) => (sel.includes(file) ? sel.filter((f) => f !== file) : [...sel, file]))
  }

  function setChoiceFor(id, choice) {
    setSignees((prev) => ({ ...prev, [id]: choice }))
  }

  const needsSignee = templates.some((t) => selected.includes(t.file) && t.needsSignee)
  const allValid = ids.every((id) => signeeValid(signees[id]))

  function onGenerateClick() {
    if (needsSignee) setSigneeStep(true)
    else doBulk(null)
  }

  async function doBulk(withSignees) {
    setBusy(true)
    setResult(null)
    const res = await api.bulkGenerate(ids, selected, withSignees || undefined)
    setBusy(false)
    setSigneeStep(false)
    if (res && !res.canceled) setResult(res)
  }

  const nameOf = (s) =>
    `${s.eponymo || ''} ${s.onoma || ''}`.trim() || `Μαθητής #${s.id}`

  // Βήμα επιλογής υπογράφοντα — ξεχωριστά ανά μαθητή.
  if (signeeStep) {
    return (
      <Modal
        title="Έκδοση εγγράφων — υπογράφων ανά μαθητή"
        onClose={onClose}
        footer={
          <>
            <button
              onClick={() => setSigneeStep(false)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> Πίσω
            </button>
            <button
              onClick={() => doBulk(signees)}
              disabled={!allValid || busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? 'Δημιουργία…' : `Έκδοση για ${ids.length}`}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          Επίλεξε ποιος υπογράφει <strong>για κάθε μαθητή</strong>.
        </p>
        <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
          {list.map((s) => (
            <div key={s.id} className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">{nameOf(s)}</p>
              <SigneePicker value={signees[s.id]} onChange={(c) => setChoiceFor(s.id, c)} allowOther />
            </div>
          ))}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={`Μαζική έκδοση εγγράφων (${ids.length} μαθητές)`}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Κλείσιμο
          </button>
          {!result && (
            <button
              onClick={onGenerateClick}
              disabled={busy || !selected.length}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? 'Δημιουργία…' : needsSignee ? 'Συνέχεια' : `Έκδοση για ${ids.length} μαθητές`}
            </button>
          )}
        </>
      }
    >
      {templates.length === 0 ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Δεν βρέθηκαν templates.</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-600">Επιλογή εγγράφων προς έκδοση (όλα ανά μαθητή):</p>
          <div className="space-y-1">
            {templates.map((t) => (
              <label
                key={t.file}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 p-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(t.file)}
                  onChange={() => toggle(t.file)}
                />
                {t.label}
                {t.needsSignee && (
                  <span className="ml-auto text-xs text-slate-400">απαιτεί υπογράφοντα</span>
                )}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Θα δημιουργηθεί φάκελος «Έγγραφα &lt;ημερομηνία&gt;» με υποφακέλους ανά έγγραφο ({ids.length} ×{' '}
            {selected.length} = {ids.length * selected.length} αρχεία).
          </p>
        </>
      )}

      {result && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="rounded-md bg-green-50 p-2 text-green-700">
            Δημιουργήθηκαν <strong>{result.generated}</strong> PDF στον φάκελο «Έγγραφα &lt;ημερομηνία&gt;»
            (υποφάκελοι ανά έγγραφο).
          </p>
          {result.failed && result.failed.length > 0 && (
            <div className="rounded-md bg-red-50 p-2 text-red-700">
              <p className="font-medium">Αποτυχίες ({result.failed.length}):</p>
              <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5">
                {result.failed.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
