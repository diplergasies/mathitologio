import { useEffect, useState } from 'react'
import Modal from './Modal'
import api from '../api'
import { GraduationCap, ArrowRight } from 'lucide-react'

// Περιγραφή του επόμενου βήματος ενός μαθητή.
function nextLabel(next) {
  if (!next) return '—'
  if (next.graduated) return 'Απόφοιτος → Διαγραφές'
  return `${next.type} · ${next.grade}`
}

export default function PromotionModal({ onClose, onDone }) {
  const [data, setData] = useState(null)
  const [decisions, setDecisions] = useState({}) // { [id]: bool }
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.promotionPreview().then((d) => {
      setData(d)
      // Προεπιλογή: όλοι όσοι έχουν έγκυρο επόμενο βήμα = Ναι (προβιβάζονται).
      const init = {}
      ;(d.rows || []).forEach((r) => {
        if (r.next) init[r.id] = true
      })
      setDecisions(init)
    })
  }, [])

  const rows = data ? data.rows : []
  const promotable = rows.filter((r) => r.next)
  const checkedIds = promotable.filter((r) => decisions[r.id]).map((r) => r.id)
  const allChecked = promotable.length > 0 && promotable.every((r) => decisions[r.id])

  function toggle(id) {
    setDecisions((d) => ({ ...d, [id]: !d[id] }))
  }
  function toggleAll(checked) {
    setDecisions(() => {
      const next = {}
      promotable.forEach((r) => (next[r.id] = checked))
      return next
    })
  }

  async function apply() {
    setBusy(true)
    const res = await api.applyPromotion(checkedIds)
    setBusy(false)
    setResult(res)
  }

  function close() {
    if (result) onDone()
    onClose()
  }

  const footer = result ? (
    <button
      onClick={close}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      Κλείσιμο
    </button>
  ) : (
    <>
      <button
        onClick={onClose}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Άκυρο
      </button>
      <button
        onClick={apply}
        disabled={busy || !data}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {busy ? 'Γίνεται…' : `Εφαρμογή προβιβασμού (${checkedIds.length})`}
      </button>
    </>
  )

  return (
    <Modal
      title={data ? `Προβιβασμός — Νέο σχολικό έτος ${data.nextLabel}` : 'Προβιβασμός'}
      onClose={onClose}
      footer={footer}
    >
      {!data ? (
        <p className="text-sm text-slate-400">Φόρτωση…</p>
      ) : result ? (
        <div className="space-y-2 text-sm">
          <p className="rounded-md bg-green-50 p-2 text-green-700">
            Προβιβάστηκαν: <strong>{result.promoted}</strong> μαθητές.
          </p>
          {result.graduated > 0 && (
            <p className="rounded-md bg-blue-50 p-2 text-blue-700">
              Απόφοιτοι (μεταφέρθηκαν στις Διαγραφές): <strong>{result.graduated}</strong>.
            </p>
          )}
          {result.needSchool > 0 && (
            <p className="rounded-md bg-amber-50 p-2 text-amber-700">
              Χρειάζονται νέο σχολείο (άλλαξαν βαθμίδα): <strong>{result.needSchool}</strong> — επίλεξέ
              τους από την καρτέλα Μαθητές (κίτρινο κελί Σχολείο).
            </p>
          )}
          <p className="rounded-md bg-slate-50 p-2 text-slate-600">
            Νέο σχολικό έτος: <strong>{result.yearLabel}</strong>.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
          Δεν υπάρχουν εγγεγραμμένοι μαθητές για προβιβασμό.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <GraduationCap size={18} className="mt-0.5 shrink-0 text-blue-600" />
            <span>
              Επίλεξε ποιοι μαθητές προβιβάστηκαν στην επόμενη τάξη (προεπιλογή: όλοι). Όσοι
              ξετσεκαριστούν, μένουν στην ίδια τάξη. Με την εφαρμογή προχωρά και το σχολικό έτος.
            </span>
          </p>
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 font-semibold">Μαθητής</th>
                  <th className="px-3 py-2 font-semibold">Τρέχουσα</th>
                  <th className="px-2 py-2"></th>
                  <th className="px-3 py-2 font-semibold">Επόμενη</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const grad = r.next && r.next.graduated
                  return (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={!!decisions[r.id]}
                          disabled={!r.next}
                          onChange={() => toggle(r.id)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-slate-700">
                        {r.eponymo} {r.onoma}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {r.currentType} · {r.currentGrade}
                      </td>
                      <td className="px-2 py-1.5 text-slate-300">
                        <ArrowRight size={14} />
                      </td>
                      <td className={`px-3 py-1.5 ${grad ? 'text-blue-600' : 'text-slate-700'}`}>
                        {nextLabel(r.next)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
