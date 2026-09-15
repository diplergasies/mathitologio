import Modal from './Modal'
import { ArrowRight, Home } from 'lucide-react'

// Ενημερωτικό pop-up μετά από εισαγωγή λίστας: εμφανίζει τους διαμένοντες που άλλαξαν δωμάτιο
// (Μονάδα) — ταυτοποιήθηκαν βάσει ΔΙΚΑ και η νέα Μονάδα ΕΝΗΜΕΡΩΘΗΚΕ ΗΔΗ αυτόματα. Μόνο ανάγνωση.
export default function RoomChangesModal({ changes, onClose }) {
  const rows = changes || []
  const footer = (
    <button
      onClick={onClose}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      Εντάξει
    </button>
  )

  return (
    <Modal title="Ενημερώθηκαν δωμάτια (Μονάδα)" onClose={onClose} footer={footer}>
      <div className="space-y-3 text-sm">
        <p className="rounded-md bg-blue-50 p-2 text-xs text-blue-700">
          Οι παρακάτω διαμένοντες βρέθηκαν στη νέα λίστα με <strong>διαφορετική Μονάδα</strong>{' '}
          (ταυτοποίηση βάσει ΔΙΚΑ). Το δωμάτιο <strong>ενημερώθηκε αυτόματα</strong> στο Μαθητολόγιο.
        </p>

        <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-1.5 font-semibold">Μαθητής</th>
                <th className="px-3 py-1.5 font-semibold">ΔΙΚΑ</th>
                <th className="px-3 py-1.5 font-semibold">Παλιά Μονάδα</th>
                <th className="px-2 py-1.5" />
                <th className="px-3 py-1.5 font-semibold">Νέα Μονάδα</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-700">
                    {c.eponymo} {c.onoma}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">{c.dika || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-500 line-through">{c.from || '—'}</td>
                  <td className="px-2 py-1.5 text-slate-400">
                    <ArrowRight size={14} />
                  </td>
                  <td className="px-3 py-1.5 font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <Home size={13} className="text-blue-500" /> {c.to || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
