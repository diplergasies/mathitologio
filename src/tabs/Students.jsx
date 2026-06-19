import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import DocumentModal from '../components/DocumentModal'
import BulkDocumentModal from '../components/BulkDocumentModal'
import SchoolCell from '../components/SchoolCell'
import GradeCell from '../components/GradeCell'
import { useSelection } from '../useSelection'
import { birthSortValue } from '../sort'
import { FileText, Trash2, Users } from 'lucide-react'

export default function Students({ version, bump }) {
  const [students, setStudents] = useState([])
  const [docFor, setDocFor] = useState(null)
  const [bulkDoc, setBulkDoc] = useState(false)
  const sel = useSelection()

  function load() {
    api.listStudents('enrolled').then((r) => setStudents(r || []))
  }
  useEffect(load, [version])

  async function del(s) {
    if (!confirm(`Διαγραφή του μαθητή ${s.eponymo} ${s.onoma};`)) return
    await api.deleteStudent(s.id)
    bump()
  }

  async function toggleEpitropos(s) {
    await api.updateStudent(s.id, { epitropos: s.epitropos === 'Ναι' ? 'Όχι' : 'Ναι' })
    bump()
  }

  async function bulkDelete() {
    if (!confirm(`Μαζική διαγραφή ${sel.ids.length} μαθητών;`)) return
    await api.bulkDelete(sel.ids)
    sel.clear()
    bump()
  }

  const columns = [
    { key: 'eponymo', label: 'Επώνυμο' },
    { key: 'onoma', label: 'Όνομα' },
    { key: 'patronymo', label: 'Πατρώνυμο' },
    { key: 'fylo', label: 'Φύλο' },
    { key: 'imerominia_gennisis', label: 'Ημ. γέννησης', sortable: true, sortAccessor: birthSortValue },
    {
      key: 'school_name',
      label: 'Σχολείο',
      sortable: true,
      sortAccessor: (s) => s.school_name || '',
      render: (s) => <SchoolCell student={s} onChanged={bump} />,
    },
    { key: 'school_type', label: 'Τύπος', render: (s) => s.school_type || '—' },
    {
      key: 'current_grade',
      label: 'Τάξη',
      render: (s) => <GradeCell student={s} onChanged={bump} />,
    },
    { key: 'imerominia_afixis', label: 'Ημ. άφιξης' },
    {
      key: 'epitropos',
      label: 'Επίτροπος',
      render: (s) => (
        <button
          onClick={() => toggleEpitropos(s)}
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            s.epitropos === 'Ναι' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {s.epitropos}
        </button>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-3 text-sm text-slate-500">{students.length} εγγεγραμμένοι μαθητές</div>

      {sel.ids.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <Users size={16} className="text-blue-600" />
          <span className="font-medium text-blue-700">{sel.ids.length} επιλεγμένοι</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setBulkDoc(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              <FileText size={14} /> Μαζική έκδοση εγγράφων
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
        emptyText="Κανένας εγγεγραμμένος μαθητής."
        searchable
        selectable
        selectedIds={sel.ids}
        onToggle={sel.toggle}
        onToggleAll={sel.toggleAll}
        renderActions={(s) => (
          <>
            <button
              onClick={() => setDocFor(s)}
              title="Έκδοση εγγράφων"
              className="rounded-md border border-blue-200 p-1 text-blue-600 hover:bg-blue-50"
            >
              <FileText size={14} />
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

      {docFor && <DocumentModal student={docFor} onClose={() => setDocFor(null)} />}
      {bulkDoc && <BulkDocumentModal ids={sel.ids} onClose={() => setBulkDoc(false)} />}
    </div>
  )
}
