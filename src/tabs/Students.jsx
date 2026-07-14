import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import DocumentModal from '../components/DocumentModal'
import BulkDocumentModal from '../components/BulkDocumentModal'
import BulkDeleteByDikaModal from '../components/BulkDeleteByDikaModal'
import DeleteReasonModal from '../components/DeleteReasonModal'
import SchoolCell from '../components/SchoolCell'
import GradeCell from '../components/GradeCell'
import LastImportBadge from '../components/LastImportBadge'
import { useSelection } from '../useSelection'
import { birthSortValue } from '../sort'
import { isoToDMY } from '../calendarUtils'
import { FileText, Trash2, Users, Hash } from 'lucide-react'

export default function Students({ version, bump }) {
  const [students, setStudents] = useState([])
  const [docFor, setDocFor] = useState(null)
  const [bulkDoc, setBulkDoc] = useState(false)
  const [dikaDelete, setDikaDelete] = useState(false)
  const [delFor, setDelFor] = useState(null) // μαθητής προς διαγραφή (single)
  const [bulkDel, setBulkDel] = useState(false) // μαζική διαγραφή επιλεγμένων
  const sel = useSelection()

  function load() {
    api.listStudents('enrolled').then((r) => setStudents(r || []))
  }
  useEffect(load, [version])

  async function toggleEpitropos(s) {
    await api.updateStudent(s.id, { epitropos: s.epitropos === 'Ναι' ? 'Όχι' : 'Ναι' })
    bump()
  }

  async function toggleAsyn(s) {
    await api.updateStudent(s.id, { asynodeftos: s.asynodeftos === 'Ναι' ? 'Όχι' : 'Ναι' })
    bump()
  }

  async function toggleEidiki(s) {
    await api.updateStudent(s.id, { eidiki_agogi: s.eidiki_agogi === 'Ναι' ? 'Όχι' : 'Ναι' })
    bump()
  }

  async function saveCell(id, key, value) {
    await api.updateStudent(id, { [key]: value })
    bump()
  }

  const columns = [
    { key: 'eponymo', label: 'Επώνυμο', editable: true },
    { key: 'onoma', label: 'Όνομα', editable: true },
    { key: 'patronymo', label: 'Πατρώνυμο', editable: true },
    { key: 'monada', label: 'Μονάδα', editable: true },
    { key: 'dika', label: 'ΔΙΚΑ', editable: true },
    { key: 'fylo', label: 'Φύλο', editable: true },
    { key: 'ithageneia', label: 'Ιθαγένεια', editable: true },
    { key: 'imerominia_gennisis', label: 'Ημ. γέννησης', sortable: true, sortAccessor: birthSortValue, editable: true },
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
    { key: 'imerominia_afixis', label: 'Ημ. άφιξης', editable: true },
    {
      key: 'enrolled_at',
      label: 'Ημ. εγγραφής',
      editable: true,
      render: (s) => isoToDMY(s.enrolled_at) || '—',
      editAccessor: (s) => isoToDMY(s.enrolled_at),
    },
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
    {
      key: 'asynodeftos',
      label: 'Ασυνόδευτος',
      render: (s) => (
        <button
          onClick={() => toggleAsyn(s)}
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            s.asynodeftos === 'Ναι' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {s.asynodeftos || 'Όχι'}
        </button>
      ),
    },
    {
      key: 'eidiki_agogi',
      label: 'Ειδ. αγωγή',
      render: (s) => (
        <button
          onClick={() => toggleEidiki(s)}
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            s.eidiki_agogi === 'Ναι' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {s.eidiki_agogi || 'Όχι'}
        </button>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-slate-500">{students.length} εγγεγραμμένοι μαθητές</span>
          <LastImportBadge version={version} />
        </div>
        <button
          onClick={() => setDikaDelete(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Hash size={15} /> Μαζική διαγραφή με ΔΙΚΑ
        </button>
      </div>

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
              onClick={() => setBulkDel(true)}
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
        onCellSave={saveCell}
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
              onClick={() => setDelFor(s)}
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

      {delFor && (
        <DeleteReasonModal
          title="Διαγραφή μαθητή"
          message={`Διαγραφή του μαθητή ${delFor.eponymo} ${delFor.onoma};`}
          onConfirm={async (reason) => {
            await api.deleteStudent(delFor.id, reason)
            bump()
          }}
          onClose={() => setDelFor(null)}
        />
      )}

      {bulkDel && (
        <DeleteReasonModal
          title="Μαζική διαγραφή"
          message={`Μαζική διαγραφή ${sel.ids.length} μαθητών;`}
          count={`${sel.ids.length} μαθητών`}
          onConfirm={async (reason) => {
            await api.bulkDelete(sel.ids, reason)
            sel.clear()
            bump()
          }}
          onClose={() => setBulkDel(false)}
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
    </div>
  )
}
