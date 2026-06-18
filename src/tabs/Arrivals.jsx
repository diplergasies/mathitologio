import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import BulkEnrollModal from '../components/BulkEnrollModal'
import { useSelection } from '../useSelection'
import { GraduationCap, Trash2, Users } from 'lucide-react'

const columns = [
  { key: 'eponymo', label: 'Επώνυμο' },
  { key: 'onoma', label: 'Όνομα' },
  { key: 'patronymo', label: 'Πατρώνυμο' },
  { key: 'fylo', label: 'Φύλο' },
  { key: 'imerominia_gennisis', label: 'Ημ. γέννησης' },
  { key: 'ithageneia', label: 'Ιθαγένεια' },
  { key: 'glossa', label: 'Γλώσσα' },
  { key: 'imerominia_afixis', label: 'Ημ. άφιξης' },
  { key: 'epitropos', label: 'Επίτροπος' },
  {
    key: 'proposed',
    label: 'Προτεινόμενη τάξη',
    render: (s) => `${s.computed_type} · ${s.computed_grade}`,
  },
]

export default function Arrivals({ version, bump }) {
  const [students, setStudents] = useState([])
  const [bulkEnroll, setBulkEnroll] = useState(false)
  const sel = useSelection()

  function load() {
    api.listStudents('arrival').then((r) => setStudents(r || []))
  }
  useEffect(load, [version])

  async function enrollOne(s) {
    await api.enroll(s.id)
    bump()
  }

  async function del(s) {
    if (!confirm(`Διαγραφή του μαθητή ${s.eponymo} ${s.onoma};`)) return
    await api.deleteStudent(s.id)
    bump()
  }

  async function bulkDelete() {
    if (!confirm(`Μαζική διαγραφή ${sel.ids.length} μαθητών;`)) return
    await api.bulkDelete(sel.ids)
    sel.clear()
    bump()
  }

  return (
    <div>
      <div className="mb-3 text-sm text-slate-500">{students.length} αφίξεις προς εγγραφή</div>

      {sel.ids.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <Users size={16} className="text-blue-600" />
          <span className="font-medium text-blue-700">{sel.ids.length} επιλεγμένοι</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setBulkEnroll(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              <GraduationCap size={14} /> Μαζική εγγραφή
            </button>
            <button
              onClick={bulkDelete}
              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} /> Μαζική διαγραφή
            </button>
          </div>
        </div>
      )}

      <StudentTable
        students={students}
        columns={columns}
        emptyText="Καμία άφιξη. Κάνε εισαγωγή αρχείου XLSX."
        selectable
        selectedIds={sel.ids}
        onToggle={sel.toggle}
        onToggleAll={sel.toggleAll}
        renderActions={(s) => (
          <>
            <button
              onClick={() => enrollOne(s)}
              title="Εγγραφή στους Μαθητές"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              <GraduationCap size={14} /> Εγγραφή
            </button>
            <button
              onClick={() => del(s)}
              title="Διαγραφή"
              className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      />

      {bulkEnroll && (
        <BulkEnrollModal
          ids={sel.ids}
          onClose={() => setBulkEnroll(false)}
          onDone={() => {
            setBulkEnroll(false)
            sel.clear()
            bump()
          }}
        />
      )}
    </div>
  )
}
