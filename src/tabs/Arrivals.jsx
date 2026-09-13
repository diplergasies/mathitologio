import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import FyloCell from '../components/FyloCell'
import BulkEnrollModal from '../components/BulkEnrollModal'
import BulkDeleteByDikaModal from '../components/BulkDeleteByDikaModal'
import ManualArrivalModal from '../components/ManualArrivalModal'
import EnrollDocsPrompt from '../components/EnrollDocsPrompt'
import BulkDocumentModal from '../components/BulkDocumentModal'
import LastImportBadge from '../components/LastImportBadge'
import { useSelection } from '../useSelection'
import { birthSortValue, proposedSortValue } from '../sort'
import { GraduationCap, Trash2, Users, Hash, UserPlus } from 'lucide-react'

export default function Arrivals({ version, bump }) {
  const [students, setStudents] = useState([])
  const [bulkEnroll, setBulkEnroll] = useState(false)
  const [dikaDelete, setDikaDelete] = useState(false)
  const [manual, setManual] = useState(false)
  const [promptOn, setPromptOn] = useState(true) // ρύθμιση: ερώτηση έκδοσης εγγράφων μετά την εγγραφή
  const [enrolledForDocs, setEnrolledForDocs] = useState([]) // ερώτηση για αυτούς
  const [docStudents, setDocStudents] = useState([]) // επιλογή εγγράφων για αυτούς
  const sel = useSelection()

  function load() {
    api.listStudents('arrival').then((r) => setStudents(r || []))
  }
  useEffect(load, [version])

  useEffect(() => {
    api.getSettings().then((s) => setPromptOn(!s || s.enrollDocsPrompt !== '0'))
  }, [])

  async function toggleEpitropos(s) {
    await api.updateStudent(s.id, { epitropos: s.epitropos === 'Ναι' ? 'Όχι' : 'Ναι' })
    bump()
  }

  const columns = [
    { key: 'eponymo', label: 'Επώνυμο', editable: true },
    { key: 'onoma', label: 'Όνομα', editable: true },
    { key: 'patronymo', label: 'Πατρώνυμο', editable: true },
    { key: 'monada', label: 'Μονάδα', editable: true },
    { key: 'dika', label: 'ΔΙΚΑ', editable: true },
    { key: 'fylo', label: 'Φύλο', render: (s) => <FyloCell student={s} onChanged={bump} /> },
    { key: 'imerominia_gennisis', label: 'Ημ. γέννησης', sortable: true, sortAccessor: birthSortValue, editable: true },
    { key: 'ithageneia', label: 'Ιθαγένεια', editable: true },
    { key: 'glossa', label: 'Γλώσσα', editable: true },
    { key: 'imerominia_afixis', label: 'Ημ. άφιξης', editable: true },
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
      key: 'proposed',
      label: 'Προτεινόμενη τάξη',
      sortable: true,
      sortAccessor: proposedSortValue,
      render: (s) => `${s.computed_type} · ${s.computed_grade}`,
    },
  ]

  async function enrollOne(s) {
    await api.enroll(s.id)
    bump()
    if (promptOn) setEnrolledForDocs([s])
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

  async function applyColor(ids, color) {
    await api.setStudentColor(ids, color)
    sel.clear()
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
        onSetColor={applyColor}
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
          onDone={(res) => {
            setBulkEnroll(false)
            const enrolledIds = (res && res.enrolledIds) || []
            const objs = students.filter((s) => enrolledIds.includes(s.id))
            sel.clear()
            bump()
            if (promptOn && objs.length) setEnrolledForDocs(objs)
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

      {enrolledForDocs.length > 0 && (
        <EnrollDocsPrompt
          students={enrolledForDocs}
          onClose={() => setEnrolledForDocs([])}
          onYes={() => {
            setDocStudents(enrolledForDocs)
            setEnrolledForDocs([])
          }}
        />
      )}

      {docStudents.length > 0 && (
        <BulkDocumentModal students={docStudents} onClose={() => setDocStudents([])} />
      )}
    </div>
  )
}
