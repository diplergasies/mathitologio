import { useEffect, useState } from 'react'
import Modal from './Modal'
import api from '../api'
import { defaultReason, loadSavedReasons, dedupeReasons, REASONS_KEY } from '../lib/deletionReasons'
import { Trash2, X } from 'lucide-react'

// Επιλογή λόγου ανά μαθητή: 'p:<κείμενο>' (προεπιλεγμένος ή συνηθισμένος λόγος), 'other' ή 'blank'.
const OTHER = 'other'
const BLANK = 'blank'
const preset = (text) => `p:${text}`

// Pop-up διαγραφής με λόγο ΑΝΑ ΜΑΘΗΤΗ (Γ1/Γ2/Γ3 Παρατηρητηρίου). Επιλογές: «Αποχώρηση από {{Δομή}}»
// (προεπιλογή), οι συνηθισμένοι λόγοι του χρήστη, «Άλλο» (ελεύθερο κείμενο που μπορεί να
// αποθηκευτεί ως συνηθισμένος λόγος) και «Κενό». Με πολλούς μαθητές υπάρχει και γραμμή «Για όλους».
// onConfirm(reasons): reasons = { [id]: κείμενο λόγου ή null }.
export default function DeleteReasonModal({ title = 'Διαγραφή μαθητή', message, students = [], onConfirm, onClose }) {
  const [loaded, setLoaded] = useState(false)
  const [defReason, setDefReason] = useState('')
  const [saved, setSaved] = useState([])
  const [choice, setChoice] = useState({}) // id -> επιλογή
  const [otherText, setOtherText] = useState({}) // id -> κείμενο «Άλλο»
  const [saveFlag, setSaveFlag] = useState({}) // id -> αποθήκευση ως συνηθισμένος λόγος
  const [all, setAll] = useState({ choice: '', text: '', save: false }) // γραμμή «Για όλους»
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getSettings().then((s) => {
      const def = defaultReason(s || {})
      setDefReason(def)
      setSaved(loadSavedReasons(s || {}))
      const init = {}
      for (const st of students) init[st.id] = preset(def)
      setChoice(init)
      setAll({ choice: preset(def), text: '', save: false })
      setLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const many = students.length > 1
  const options = [defReason, ...saved]

  function setForAll(patch) {
    const next = { ...all, ...patch }
    setAll(next)
    const ids = students.map((s) => s.id)
    if (patch.choice !== undefined) setChoice(Object.fromEntries(ids.map((id) => [id, next.choice])))
    if (patch.text !== undefined) setOtherText(Object.fromEntries(ids.map((id) => [id, next.text])))
    if (patch.save !== undefined) setSaveFlag(Object.fromEntries(ids.map((id) => [id, next.save])))
  }

  // Αφαίρεση συνηθισμένου λόγου· όσοι τον είχαν επιλεγμένο γυρίζουν στην προεπιλογή.
  async function removeSaved(text) {
    const next = saved.filter((r) => r !== text)
    setSaved(next)
    await api.setSettings({ [REASONS_KEY]: JSON.stringify(next) })
    const gone = preset(text)
    setChoice((prev) =>
      Object.fromEntries(Object.entries(prev).map(([id, c]) => [id, c === gone ? preset(defReason) : c]))
    )
    if (all.choice === gone) setAll((a) => ({ ...a, choice: preset(defReason) }))
  }

  const missingOther = students.filter((s) => choice[s.id] === OTHER && !String(otherText[s.id] || '').trim())

  async function confirm() {
    if (missingOther.length) {
      setError('Συμπλήρωσε τον λόγο στο «Άλλο» ή διάλεξε άλλη επιλογή.')
      return
    }
    setBusy(true)
    setError(null)
    const reasons = {}
    const toSave = []
    for (const s of students) {
      const c = choice[s.id]
      if (c === BLANK) reasons[s.id] = null
      else if (c === OTHER) {
        const t = String(otherText[s.id] || '').trim()
        reasons[s.id] = t
        if (saveFlag[s.id]) toSave.push(t)
      } else reasons[s.id] = String(c || preset(defReason)).slice(2)
    }
    try {
      if (toSave.length) {
        const next = dedupeReasons([...saved, ...toSave], defReason)
        await api.setSettings({ [REASONS_KEY]: JSON.stringify(next) })
      }
      await onConfirm(reasons)
    } catch (e) {
      setBusy(false)
      setError(`Αποτυχία διαγραφής: ${e && e.message ? e.message : e}`)
      return
    }
    setBusy(false)
    onClose()
  }

  // Ομάδα επιλογών (radio) για μία γραμμή· name μοναδικό ανά γραμμή.
  // Καλείται ως συνάρτηση (όχι ως <Component/>) ώστε το πεδίο κειμένου να μη χάνει το focus.
  function reasonChoices({ name, value, onPick, text, onText, save, onSave, focus }) {
    return (
      <>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {options.map((r, i) => (
            <label key={r} className="group inline-flex items-center gap-1.5 text-slate-700">
              <input type="radio" name={name} checked={value === preset(r)} onChange={() => onPick(preset(r))} />
              <span>{r}</span>
              {i > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    removeSaved(r)
                  }}
                  title="Αφαίρεση από τους συνηθισμένους λόγους"
                  className="rounded p-0.5 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              )}
            </label>
          ))}
          <label className="inline-flex items-center gap-1.5 text-slate-700">
            <input type="radio" name={name} checked={value === OTHER} onChange={() => onPick(OTHER)} />
            <span>Άλλο</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-slate-500">
            <input type="radio" name={name} checked={value === BLANK} onChange={() => onPick(BLANK)} />
            <span>Κενό (χωρίς λόγο)</span>
          </label>
        </div>
        {value === OTHER && (
          <div className="mt-2 space-y-1.5">
            <input
              value={text || ''}
              onChange={(e) => onText(e.target.value)}
              placeholder="Γράψε τον λόγο διαγραφής…"
              autoFocus={focus}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={!!save} onChange={(e) => onSave(e.target.checked)} />
              Αποθήκευση ως συνηθισμένος λόγος (θα εμφανίζεται ως επιλογή στις επόμενες διαγραφές)
            </label>
          </div>
        )}
      </>
    )
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
        disabled={busy || !loaded || !students.length}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
      >
        <Trash2 size={15} /> {busy ? 'Γίνεται…' : many ? `Διαγραφή ${students.length} μαθητών` : 'Διαγραφή'}
      </button>
    </>
  )

  return (
    <Modal title={title} onClose={onClose} footer={footer} wide={many}>
      {!loaded ? (
        <p className="text-sm text-slate-500">Φόρτωση…</p>
      ) : (
        <div className="space-y-3 text-sm">
          {message && <p className="text-slate-600">{message}</p>}

          {many && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5">
              <p className="mb-1.5 font-medium text-blue-800">Ίδιος λόγος για όλους</p>
              {reasonChoices({
                name: 'reason-all',
                value: all.choice,
                onPick: (c) => setForAll({ choice: c }),
                text: all.text,
                onText: (t) => setForAll({ text: t }),
                save: all.save,
                onSave: (v) => setForAll({ save: v }),
                focus: true,
              })}
              <p className="mt-1.5 text-xs text-blue-700">
                Εφαρμόζεται σε όλους. Μετά μπορείς να αλλάξεις τον λόγο σε όποιον μαθητή θέλεις.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {students.map((s) => {
              const miss = error && missingOther.some((m) => m.id === s.id)
              return (
                <div
                  key={s.id}
                  className={`rounded-md border p-2.5 ${miss ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                >
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-slate-800">
                      {s.eponymo} {s.onoma}
                    </span>
                    {s.dika && <span className="text-xs text-slate-400">ΔΙΚΑ {s.dika}</span>}
                  </div>
                  {reasonChoices({
                    name: `reason-${s.id}`,
                    value: choice[s.id],
                    onPick: (c) => setChoice((p) => ({ ...p, [s.id]: c })),
                    text: otherText[s.id],
                    onText: (t) => setOtherText((p) => ({ ...p, [s.id]: t })),
                    save: saveFlag[s.id],
                    onSave: (v) => setSaveFlag((p) => ({ ...p, [s.id]: v })),
                    focus: !many,
                  })}
                </div>
              )
            })}
          </div>

          {error && <p className="rounded-md bg-red-50 p-2 text-red-700">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
