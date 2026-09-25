import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import api from '../api'
import SigneePicker, { signeeValid } from './SigneePicker'
import SignaturePad from './SignaturePad'
import { Loader2, ArrowLeft } from 'lucide-react'

// Κλειδί ομαδοποίησης ανά ΠΡΑΓΜΑΤΙΚΟ υπογράφοντα (ίδια λογική με το computeSignee στο main):
// ίδιος signee → ίδια ομάδα → μία υπογραφή/πεδία για όλους. Οι γονείς είναι ξεχωριστό
// φυσικό πρόσωπο ανά μαθητή· ο ΣΕΠ είναι ένας για όλους· ο μαθητής (self) ξεχωριστός.
function signeeGroupKey(s, choice) {
  const c = choice || { type: 'father' }
  switch (c.type) {
    case 'father':
      return `father|${`${s.patronymo || ''} ${s.eponymo || ''}`.trim()}`
    case 'mother':
      return `mother|${`${s.mitronymo || ''} ${s.eponymo || ''}`.trim()}`
    case 'sep':
      return 'sep'
    case 'self':
      return `self|${s.id}`
    case 'guardian':
      return `guardian|${(c.name || '').trim()}`
    case 'other':
      return `other|${(c.name || '').trim()}|${(c.prop || '').trim()}`
    default:
      return `type|${c.type}`
  }
}

// Φιλική ετικέτα υπογράφοντα για την κεφαλίδα της ομάδας.
function signeeLabel(s, choice) {
  const c = choice || { type: 'father' }
  switch (c.type) {
    case 'father':
      return `${`${s.patronymo || ''} ${s.eponymo || ''}`.trim()} (πατέρας)`
    case 'mother':
      return `${`${s.mitronymo || ''} ${s.eponymo || ''}`.trim()} (μητέρα)`
    case 'sep':
      return 'ΣΕΠ'
    case 'self':
      return `${`${s.onoma || ''} ${s.eponymo || ''}`.trim()} (ο ίδιος / η ίδια)`
    case 'guardian':
      return `${(c.name || '').trim()} (επίτροπος)`
    case 'other':
      return `${(c.name || '').trim()}${c.prop ? ` (${c.prop})` : ''}`
    default:
      return '—'
  }
}

// Δέχεται είτε `students` (αντικείμενα με ονόματα) είτε παλιό `ids` (μόνο id).
export default function BulkDocumentModal({ students, ids: idsProp, onClose }) {
  const list = (students && students.length ? students : (idsProp || []).map((id) => ({ id })))
  const ids = list.map((s) => s.id)

  const [templates, setTemplates] = useState([])
  const [schools, setSchools] = useState([])
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [signeeStep, setSigneeStep] = useState(false)
  const [detailsStep, setDetailsStep] = useState(false)
  const [signees, setSignees] = useState({}) // { [id]: choice }
  const [groupSig, setGroupSig] = useState({}) // { [groupKey]: { dataUrl, wPx, hPx } | null }
  const [groupExtras, setGroupExtras] = useState({}) // { [groupKey]: { token: value } }

  useEffect(() => {
    api.listTemplates().then((t) => {
      setTemplates(t || [])
      // Προεπιλογή: κανένα πρότυπο επιλεγμένο — ο χρήστης επιλέγει ρητά τι θα εκδώσει.
      setSelected([])
    })
    api.listSchools().then((s) => setSchools(s || []))
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
  const needsSign = templates.some((t) => selected.includes(t.file) && t.needsSign)

  // Ελεύθερα πεδία (ask/unknown tokens) των επιλεγμένων προτύπων — ένωση χωρίς διπλότυπα.
  const fields = useMemo(() => {
    const map = new Map()
    for (const t of templates) {
      if (!selected.includes(t.file)) continue
      ;(t.askFields || []).forEach((a) =>
        map.set(a.token, { token: a.token, label: a.label, value: a.value || '', useSchoolList: false })
      )
      ;(t.unknownTokens || []).forEach((tok) => {
        if (!map.has(tok)) map.set(tok, { token: tok, label: tok, value: '', useSchoolList: true })
      })
    }
    return [...map.values()]
  }, [templates, selected])

  // Χρειάζεται δεύτερο βήμα (υπογραφή ή/και πεδία) πέρα από την επιλογή υπογράφοντα;
  const needsDetails = needsSign || fields.length > 0

  const allValid = ids.every((id) => signeeValid(signees[id]))

  // Ομάδες ανά υπογράφοντα (ή μία ομάδα «όλοι» όταν δεν υπάρχει signee).
  const groups = useMemo(() => {
    const map = new Map()
    for (const s of list) {
      const choice = needsSignee ? signees[s.id] || { type: 'father' } : null
      const key = needsSignee ? signeeGroupKey(s, choice) : '_all_'
      if (!map.has(key)) {
        map.set(key, {
          key,
          choice,
          students: [],
          label: needsSignee ? signeeLabel(s, choice) : 'Όλοι οι μαθητές',
        })
      }
      map.get(key).students.push(s)
    }
    return [...map.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, signees, needsSignee])

  // Seed θυμημένων τιμών στα ask-πεδία κάθε ομάδας όταν αλλάζει το σύνολο ομάδων/πεδίων.
  useEffect(() => {
    setGroupExtras((prev) => {
      const next = { ...prev }
      for (const g of groups) {
        const cur = { ...(next[g.key] || {}) }
        for (const f of fields) if (cur[f.token] === undefined) cur[f.token] = f.value
        next[g.key] = cur
      }
      return next
    })
  }, [groups, fields])

  const nameOf = (s) => `${s.eponymo || ''} ${s.onoma || ''}`.trim() || `Μαθητής #${s.id}`

  const detailsValid = groups.every((g) =>
    fields.every((f) => ((groupExtras[g.key] || {})[f.token] || '').trim())
  )

  function onGenerateClick() {
    if (needsSignee) setSigneeStep(true)
    else if (needsDetails) setDetailsStep(true)
    else doBulk(null, false)
  }

  async function doBulk(withSignees, withDetails) {
    setBusy(true)
    setResult(null)
    let opts
    if (withDetails) {
      const signatures = {}
      const extras = {}
      for (const g of groups) {
        for (const s of g.students) {
          if (groupSig[g.key]) signatures[s.id] = groupSig[g.key]
          if (groupExtras[g.key]) extras[s.id] = groupExtras[g.key]
        }
      }
      opts = { signatures, extras }
    }
    const res = await api.bulkGenerate(ids, selected, withSignees || undefined, opts)
    setBusy(false)
    setSigneeStep(false)
    setDetailsStep(false)
    if (res && !res.canceled) setResult(res)
  }

  // Βήμα 3: υπογραφή + ελεύθερα πεδία ανά ομάδα υπογράφοντα.
  if (detailsStep) {
    return (
      <Modal
        title="Έκδοση εγγράφων — υπογραφή & στοιχεία"
        onClose={onClose}
        footer={
          <>
            <button
              onClick={() => {
                setDetailsStep(false)
                if (needsSignee) setSigneeStep(true)
              }}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> Πίσω
            </button>
            <button
              onClick={() => doBulk(needsSignee ? signees : null, true)}
              disabled={!detailsValid || busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? 'Δημιουργία…' : `Έκδοση για ${ids.length}`}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          {needsSign ? 'Σχεδίασε την υπογραφή' : 'Συμπλήρωσε τα στοιχεία'}{' '}
          <strong>ανά υπογράφοντα</strong>
          {groups.length === 1 ? ' (κοινός για όλους — μία φορά).' : `. ${groups.length} ομάδες.`}
        </p>

        <datalist id="bulk-schools">
          {schools.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>

        <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
          {groups.map((g) => (
            <div key={g.key} className="rounded-md border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-700">{g.label}</p>
              <p className="mb-3 text-xs text-slate-400">
                {g.students.map((s) => nameOf(s)).join(', ')}
              </p>

              {fields.length > 0 && (
                <div className="mb-3 space-y-3">
                  {fields.map((f) => (
                    <label key={f.token} className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">{f.label}</span>
                      <input
                        type="text"
                        {...(f.useSchoolList ? { list: 'bulk-schools' } : {})}
                        value={(groupExtras[g.key] || {})[f.token] || ''}
                        onChange={(e) =>
                          setGroupExtras((prev) => ({
                            ...prev,
                            [g.key]: { ...(prev[g.key] || {}), [f.token]: e.target.value },
                          }))
                        }
                        placeholder={f.useSchoolList ? 'Πληκτρολόγησε ή επίλεξε από τη λίστα…' : 'Συμπλήρωσε…'}
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
              )}

              {needsSign && (
                <SignaturePad onChange={(sig) => setGroupSig((prev) => ({ ...prev, [g.key]: sig }))} />
              )}
            </div>
          ))}
        </div>
      </Modal>
    )
  }

  // Βήμα 2: επιλογή υπογράφοντα — ξεχωριστά ανά μαθητή.
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
              onClick={() => {
                if (needsDetails) {
                  setSigneeStep(false)
                  setDetailsStep(true)
                } else {
                  doBulk(signees, false)
                }
              }}
              disabled={!allValid || busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? 'Δημιουργία…' : needsDetails ? 'Συνέχεια' : `Έκδοση για ${ids.length}`}
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
              {busy ? 'Δημιουργία…' : needsSignee || needsDetails ? 'Συνέχεια' : `Έκδοση για ${ids.length} μαθητές`}
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
                {(t.needsSignee || t.needsSign) && (
                  <span className="ml-auto text-xs text-slate-400">
                    {[t.needsSignee ? 'υπογράφων' : null, t.needsSign ? 'υπογραφή' : null]
                      .filter(Boolean)
                      .join(' + ')}
                  </span>
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
