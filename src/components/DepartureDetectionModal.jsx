import { useState } from 'react'
import Modal from './Modal'
import api from '../api'
import { AlertTriangle, Trash2 } from 'lucide-react'

// Ετικέτα κατάστασης μαθητή για την προεπισκόπηση.
function statusLabel(st) {
  return st === 'arrival' ? 'Άφιξη' : st === 'enrolled' ? 'Εγγεγραμμένος' : st || '—'
}

// Τι θα συμβεί ανά μαθητή: οι αφίξεις διαγράφονται οριστικά, οι εγγεγραμμένοι πάνε στις Διαγραφές.
function actionLabel(st) {
  return st === 'arrival' ? 'Οριστική διαγραφή' : 'Στις Διαγραφές'
}

// Pop-up που ανοίγει μετά από εισαγωγή λίστας: εμφανίζει τους μαθητές που υπάρχουν στο
// Μαθητολόγιο αλλά ΛΕΙΠΟΥΝ από τη νέα λίστα (= αποχώρησαν από τη δομή). Ο χρήστης μπορεί να
// τους διαγράψει μαζικά ή ατομικά, τηρώντας: άφιξη -> οριστική διαγραφή, εγγεγραμμένος -> Διαγραφές.
export default function DepartureDetectionModal({ departed, onClose, onDone }) {
  const [rows, setRows] = useState(departed || []) // τοπικό αντίγραφο ώστε ατομικές διαγραφές να αφαιρούν γραμμές
  const [sel, setSel] = useState(() => new Set((departed || []).map((s) => s.id))) // όλοι επιλεγμένοι by default
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedRows = rows.filter((s) => sel.has(s.id))
  const purgeIds = selectedRows.filter((s) => s.status === 'arrival').map((s) => s.id)
  const softIds = selectedRows.filter((s) => s.status === 'enrolled').map((s) => s.id)
  const allChecked = rows.length > 0 && rows.every((s) => sel.has(s.id))

  function toggle(id) {
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSel(allChecked ? new Set() : new Set(rows.map((s) => s.id)))
  }

  // Αφαίρεση γραμμών από την τοπική λίστα μετά από επιτυχή διαγραφή· κλείσιμο αν αδειάσει.
  function removeRows(ids) {
    const idSet = new Set(ids)
    const remaining = rows.filter((s) => !idSet.has(s.id))
    setRows(remaining)
    setSel((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
    onDone()
    if (remaining.length === 0) onClose()
  }

  // Μαζική διαγραφή των επιλεγμένων.
  async function confirmDelete() {
    if (!purgeIds.length && !softIds.length) return
    setBusy(true)
    if (purgeIds.length) await api.bulkPurge(purgeIds)
    if (softIds.length) await api.bulkDelete(softIds, reason.trim())
    setBusy(false)
    removeRows([...purgeIds, ...softIds])
  }

  // Ατομική διαγραφή ενός μαθητή.
  async function deleteOne(s) {
    setBusy(true)
    if (s.status === 'arrival') await api.purgeStudent(s.id)
    else await api.deleteStudent(s.id, reason.trim())
    setBusy(false)
    removeRows([s.id])
  }

  const selCount = selectedRows.length
  const footer = (
    <>
      <button
        onClick={onClose}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Παράβλεψη
      </button>
      <button
        onClick={confirmDelete}
        disabled={busy || selCount === 0}
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
      >
        {busy
          ? 'Γίνεται…'
          : purgeIds.length && softIds.length
            ? `Διαγραφή ${selCount} (${purgeIds.length} οριστικά, ${softIds.length} στις Διαγραφές)`
            : `Διαγραφή ${selCount} επιλεγμένων`}
      </button>
    </>
  )

  return (
    <Modal title="Εντοπίστηκε ότι διαγράφηκαν οι παρακάτω:" onClose={onClose} footer={footer}>
      <div className="space-y-3 text-sm">
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
          Οι παρακάτω μαθητές υπάρχουν στο Μαθητολόγιο αλλά <strong>δεν βρέθηκαν στη νέα λίστα</strong>,
          οπότε μάλλον αποχώρησαν από τη δομή. Οι <strong>αφίξεις</strong> διαγράφονται{' '}
          <strong>οριστικά</strong>· οι <strong>εγγεγραμμένοι</strong> πηγαίνουν στην καρτέλα{' '}
          <strong>Διαγραφές</strong> (με δυνατότητα επαναφοράς).
        </p>

        <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-2 py-1.5">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <th className="px-3 py-1.5 font-semibold">Μαθητής</th>
                <th className="px-3 py-1.5 font-semibold">ΔΙΚΑ</th>
                <th className="px-3 py-1.5 font-semibold">Μονάδα</th>
                <th className="px-3 py-1.5 font-semibold">Κατάσταση</th>
                <th className="px-3 py-1.5 font-semibold">Ενέργεια</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">
                    <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} />
                  </td>
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
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => deleteOne(s)}
                      disabled={busy}
                      title="Διαγραφή αυτού του μαθητή"
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {softIds.length > 0 && (
          <div>
            <label className="mb-1 block text-sm text-slate-600">
              Λόγος αποχώρησης (μόνο για όσους πάνε στις Διαγραφές, προαιρετικό)
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

        {rows.length === 0 && (
          <p className="flex items-center gap-1.5 rounded-md bg-slate-50 p-2 text-slate-500">
            <AlertTriangle size={15} /> Δεν απομένουν μαθητές.
          </p>
        )}
      </div>
    </Modal>
  )
}
