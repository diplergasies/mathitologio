import { useEffect, useState } from 'react'
import Modal from './Modal'
import api from '../api'
import { AlertTriangle } from 'lucide-react'

// Κανονικοποίηση ΔΙΚΑ για αντιστοίχιση: αφαίρεση όλων των κενών (αντοχή σε typos).
function normDika(v) {
  return String(v == null ? '' : v).replace(/\s+/g, '')
}

// Ετικέτα κατάστασης μαθητή για την προεπισκόπηση.
function statusLabel(st) {
  return st === 'arrival' ? 'Άφιξη' : st === 'enrolled' ? 'Εγγεγραμμένος' : st || '—'
}

// Τι θα συμβεί ανά μαθητή: οι αφίξεις διαγράφονται οριστικά, οι εγγεγραμμένοι πάνε στις Διαγραφές.
function actionLabel(st) {
  return st === 'arrival' ? 'Οριστική διαγραφή' : 'Στις Διαγραφές'
}

// Μαζική διαγραφή μαθητών με βάση λίστα αριθμών ΔΙΚΑ (χωρισμένων με κόμμα).
// Ψάχνει ΤΑΥΤΟΧΡΟΝΑ σε αφίξεις + εγγεγραμμένους — ανεξάρτητα από την καρτέλα που το άνοιξε.
export default function BulkDeleteByDikaModal({ onClose, onDeleted }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null) // { matched: [...], notFound: [...] }
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [scope, setScope] = useState(null) // συνδυασμένη λίστα (αφίξεις + εγγεγραμμένοι)· null = φορτώνει

  // Φόρτωση και των δύο λιστών ώστε η αναζήτηση ΔΙΚΑ να καλύπτει όλο τον ενεργό πληθυσμό.
  useEffect(() => {
    let alive = true
    Promise.all([api.listStudents('arrival'), api.listStudents('enrolled')]).then(([a, e]) => {
      if (alive) setScope([...(a || []), ...(e || [])])
    })
    return () => {
      alive = false
    }
  }, [])

  function search() {
    if (!scope) return
    // Διαχωρισμός σε κόμμα / άνω-κάτω τελεία / νέα γραμμή, καθάρισμα & dedupe.
    const tokens = [...new Set(
      text
        .split(/[,;\n\r]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    )]

    const byDika = new Map()
    for (const s of scope) byDika.set(normDika(s.dika), s)

    const matched = []
    const seen = new Set()
    const notFound = []
    for (const tok of tokens) {
      const s = byDika.get(normDika(tok))
      if (s && !seen.has(s.id)) {
        matched.push(s)
        seen.add(s.id)
      } else if (!s) {
        notFound.push(tok)
      }
    }
    setPreview({ matched, notFound })
  }

  // Αφίξεις -> οριστική διαγραφή (purge)· εγγεγραμμένοι -> μαλακή διαγραφή (καρτέλα Διαγραφές).
  const purgeIds = preview ? preview.matched.filter((s) => s.status === 'arrival').map((s) => s.id) : []
  const softIds = preview ? preview.matched.filter((s) => s.status === 'enrolled').map((s) => s.id) : []

  async function confirmDelete() {
    setBusy(true)
    if (purgeIds.length) await api.bulkPurge(purgeIds)
    if (softIds.length) await api.bulkDelete(softIds, reason.trim())
    setBusy(false)
    onDeleted(preview.matched.length)
    onClose()
  }

  const footer = !preview ? (
    <>
      <button
        onClick={onClose}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Άκυρο
      </button>
      <button
        onClick={search}
        disabled={!text.trim() || !scope}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {scope ? 'ΟΚ' : 'Φόρτωση…'}
      </button>
    </>
  ) : (
    <>
      <button
        onClick={() => setPreview(null)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Πίσω
      </button>
      <button
        onClick={confirmDelete}
        disabled={busy || preview.matched.length === 0}
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
      >
        {busy
          ? 'Γίνεται…'
          : purgeIds.length && softIds.length
            ? `Διαγραφή ${preview.matched.length} (${purgeIds.length} οριστικά, ${softIds.length} στις Διαγραφές)`
            : `Διαγραφή ${preview.matched.length} μαθητών`}
      </button>
    </>
  )

  return (
    <Modal title="Μαζική διαγραφή με ΔΙΚΑ" onClose={onClose} footer={footer}>
      {!preview ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Επικόλλησε τους αριθμούς <strong>ΔΙΚΑ</strong> των μαθητών, χωρισμένους με κόμμα (,). Η
            αναζήτηση καλύπτει <strong>και τις Αφίξεις και τους Μαθητές</strong>.
          </p>
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
            Οι <strong>αφίξεις</strong> διαγράφονται <strong>οριστικά</strong> (δεν πηγαίνουν στις
            Διαγραφές, δεν επαναφέρονται). Οι <strong>εγγεγραμμένοι</strong> πηγαίνουν στην καρτέλα
            <strong> Διαγραφές</strong> (με δυνατότητα επαναφοράς).
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="π.χ. 06/000751387, 06/000751385, 06/000751390"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {preview.matched.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-slate-700">
                Βρέθηκαν {preview.matched.length} μαθητές προς διαγραφή:
              </p>
              <div className="max-h-60 overflow-auto rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-500">
                      <th className="px-3 py-1.5 font-semibold">Μαθητής</th>
                      <th className="px-3 py-1.5 font-semibold">ΔΙΚΑ</th>
                      <th className="px-3 py-1.5 font-semibold">Μονάδα</th>
                      <th className="px-3 py-1.5 font-semibold">Κατάσταση</th>
                      <th className="px-3 py-1.5 font-semibold">Ενέργεια</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.matched.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">
                          {s.eponymo} {s.onoma}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">{s.dika || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{s.monada || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{statusLabel(s.status)}</td>
                        <td
                          className={`px-3 py-1.5 ${
                            s.status === 'arrival' ? 'font-medium text-red-600' : 'text-slate-500'
                          }`}
                        >
                          {actionLabel(s.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="rounded-md bg-slate-50 p-2 text-slate-500">
              Κανένας μαθητής δεν βρέθηκε με τους ΔΙΚΑ που έδωσες (σε Αφίξεις ή Μαθητές).
            </p>
          )}

          {softIds.length > 0 && (
            <div>
              <label className="mb-1 block text-sm text-slate-600">
                Λόγος διαγραφής (μόνο για όσους πάνε στις Διαγραφές, προαιρετικό)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="π.χ. αναχώρηση από τη δομή, μετεγγραφή…"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
          )}

          {preview.notFound.length > 0 && (
            <div className="rounded-md bg-amber-50 p-2 text-amber-700">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle size={15} /> Δεν βρέθηκαν ({preview.notFound.length}):
              </p>
              <p className="mt-1 break-words">{preview.notFound.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
