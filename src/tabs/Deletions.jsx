import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import { useSelection } from '../useSelection'
import { Undo2, Users, Trash2 } from 'lucide-react'

function fmtDeleted(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const columns = [
  { key: 'eponymo', label: 'Επώνυμο' },
  { key: 'onoma', label: 'Όνομα' },
  { key: 'patronymo', label: 'Πατρώνυμο' },
  { key: 'fylo', label: 'Φύλο' },
  { key: 'imerominia_gennisis', label: 'Ημ. γέννησης' },
  { key: 'school_name', label: 'Σχολείο' },
  { key: 'current_grade', label: 'Τάξη' },
  { key: 'deleted_at', label: 'Ημ. διαγραφής', render: (s) => fmtDeleted(s.deleted_at) },
  {
    key: 'prev_status',
    label: 'Επιστροφή σε',
    render: (s) => (s.prev_status === 'enrolled' ? 'Μαθητές' : 'Αφίξεις'),
  },
]

export default function Deletions({ version, bump }) {
  const [students, setStudents] = useState([])
  const sel = useSelection()

  function load() {
    api.listStudents('deleted').then((r) => setStudents(r || []))
  }
  useEffect(load, [version])

  async function restore(s) {
    await api.restoreStudent(s.id)
    bump()
  }

  async function bulkRestore() {
    await api.bulkRestore(sel.ids)
    sel.clear()
    bump()
  }

  async function purge(s) {
    if (!confirm(`ΟΡΙΣΤΙΚΗ διαγραφή του μαθητή ${s.eponymo} ${s.onoma};\nΔεν αναιρείται.`)) return
    await api.purgeStudent(s.id)
    bump()
  }

  async function bulkPurge() {
    if (!confirm(`ΟΡΙΣΤΙΚΗ διαγραφή ${sel.ids.length} μαθητών;\nΔεν αναιρείται.`)) return
    await api.bulkPurge(sel.ids)
    sel.clear()
    bump()
  }

  return (
    <div>
      <div className="mb-3 text-sm text-slate-500">{students.length} διαγραμμένοι</div>

      {sel.ids.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <Users size={16} className="text-blue-600" />
          <span className="font-medium text-blue-700">{sel.ids.length} επιλεγμένοι</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={bulkRestore}
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
            >
              <Undo2 size={14} /> Μαζική επαναφορά
            </button>
            <button
              onClick={bulkPurge}
              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              <Trash2 size={14} /> Οριστική διαγραφή
            </button>
          </div>
        </div>
      )}

      <StudentTable
        students={students}
        columns={columns}
        emptyText="Καμία διαγραφή."
        searchable
        selectable
        selectedIds={sel.ids}
        onToggle={sel.toggle}
        onToggleAll={sel.toggleAll}
        renderActions={(s) => (
          <>
            <button
              onClick={() => restore(s)}
              title="Επαναφορά"
              className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
            >
              <Undo2 size={14} /> Επαναφορά
            </button>
            <button
              onClick={() => purge(s)}
              title="Οριστική διαγραφή"
              className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      />
    </div>
  )
}
