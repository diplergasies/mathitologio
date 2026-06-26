import { useState } from 'react'
import Modal from './Modal'
import api from '../api'
import { AlertTriangle } from 'lucide-react'

// Κανονικοποίηση ΔΙΚΑ για αντιστοίχιση: αφαίρεση όλων των κενών (αντοχή σε typos).
function normDika(v) {
  return String(v == null ? '' : v).replace(/\s+/g, '')
}

// Μαζική διαγραφή μαθητών με βάση λίστα αριθμών ΔΙΚΑ (χωρισμένων με κόμμα).
// students: η τρέχουσα λίστα της καρτέλας (αφίξεις ή εγγεγραμμένοι) — scope αναζήτησης.
export default function BulkDeleteByDikaModal({ students, onClose, onDeleted }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null) // { matched: [...], notFound: [...] }
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  function search() {
    // Διαχωρισμός σε κόμμα / άνω-κάτω τελεία / νέα γραμμή, καθάρισμα & dedupe.
    const tokens = [...new Set(
      text
        .split(/[,;\n\r]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    )]

    const byDika = new Map()
    for (const s of students) byDika.set(normDika(s.dika), s)

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

  async function confirmDelete() {
    setBusy(true)
    await api.bulkDelete(preview.matched.map((s) => s.id), reason.trim())
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
        disabled={!text.trim()}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        ΟΚ
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
        {busy ? 'Γίνεται…' : `Διαγραφή ${preview.matched.length} μαθητών`}
      </button>
    </>
  )

  return (
    <Modal title="Μαζική διαγραφή με ΔΙΚΑ" onClose={onClose} footer={footer}>
      {!preview ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Επικόλλησε τους αριθμούς <strong>ΔΙΚΑ</strong> των μαθητών, χωρισμένους με κόμμα (,).
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="rounded-md bg-slate-50 p-2 text-slate-500">
              Κανένας μαθητής δεν βρέθηκε με τους ΔΙΚΑ που έδωσες σε αυτήν την καρτέλα.
            </p>
          )}

          {preview.matched.length > 0 && (
            <div>
              <label className="mb-1 block text-sm text-slate-600">
                Λόγος διαγραφής (προαιρετικό)
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
