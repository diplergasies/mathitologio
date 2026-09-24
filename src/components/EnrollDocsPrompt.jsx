import Modal from './Modal'
import { FileText } from 'lucide-react'

// Ερώτηση μετά την εγγραφή: «Θέλεις να εκδώσεις το πακέτο εγγραφής;»
export default function EnrollDocsPrompt({ students = [], onYes, onClose }) {
  const n = students.length
  return (
    <Modal
      title="Έκδοση πακέτου εγγραφής"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Όχι
          </button>
          <button
            onClick={onYes}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <FileText size={14} /> Ναι — έκδοση πακέτου
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        {n === 1 ? 'Εγγράφηκε 1 μαθητής.' : `Εγγράφηκαν ${n} μαθητές.`} Θέλεις να εκδώσεις το πακέτο εγγραφής για{' '}
        {n === 1 ? 'αυτόν' : `αυτούς (διαδοχικά, ένα ανά μαθητή)`};
      </p>
    </Modal>
  )
}
