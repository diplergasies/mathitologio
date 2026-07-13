import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import BulkEnrollModal from '../components/BulkEnrollModal'
import BulkDeleteByDikaModal from '../components/BulkDeleteByDikaModal'
import ManualArrivalModal from '../components/ManualArrivalModal'
import LastImportBadge from '../components/LastImportBadge'
import { useSelection } from '../useSelection'
import { birthSortValue, proposedSortValue } from '../sort'
import { GraduationCap, Trash2, Users, Hash, UserPlus } from 'lucide-react'

const columns = [
  { key: 'eponymo', label: 'Επώνυμο', editable: true },
  { key: 'onoma', label: 'Όνομα', editable: true },
  { key: 'patronymo', label: 'Πατρώνυμο', editable: true },
  { key: 'monada', label: 'Μονάδα', editable: true },
  { key: 'dika', label: 'ΔΙΚΑ', editable: true },
  { key: 'fylo', label: 'Φύλο', editable: true },
  { key: 'imerominia_gennisis', label: 'Ημ. γέννησης', sortable: true, sortAccessor: birthSortValue, editable: true },
  { key: 'ithageneia', label: 'Ιθαγένεια', editable: true },
  { key: 'glossa', label: 'Γλώσσα', editable: true },
  { key: 'imerominia_afixis', label: 'Ημ. άφιξης', editable: true },
  { key: 'epitropos', label: 'Επίτροπος', editable: true },
  {
    key: 'proposed',
    label: 'Προτεινόμενη τάξη',
    sortable: true,
    sortAccessor: proposedSortValue,
    render: (s) => `${s.computed_type} · ${s.computed_grade}`,
  },
]

export default function Arrivals({ version, bump }) {
  const [students, setStudents] = useState([])
  const [bulkEnroll, setBulkEnroll] = useState(false)
  const [dikaDelete, setDikaDelete] = useState(false)
  const [manual, setManual] = useState(false)
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

  async function saveCell(id, key, value) {
    await api.updateStudent(id, { [key]: value })
    bump()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-slate-500">{students.length} αφίξεις προς εγγραφή</span>
          <LastImportBadge version={version} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setManual(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus size={15} /> Χειροκίνητη καταχώρηση
          </button>
          <button
            onClick={() => setDikaDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Hash size={15} /> Μαζική διαγραφή με ΔΙΚΑ
          </button>
        </div>
      </div>

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
        searchable
        selectable
        selectedIds={sel.ids}
        onToggle={sel.toggle}
        onToggleAll={sel.toggleAll}
        onCellSave={saveCell}
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

      {dikaDelete && (
        <BulkDeleteByDikaModal
          onClose={() => setDikaDelete(false)}
          onDeleted={() => {
            sel.clear()
            bump()
          }}
        />
      )}

      {manual && (
        <ManualArrivalModal
          onClose={() => setManual(false)}
          onAdded={() => bump()}
        />
      )}
    </div>
  )
}
