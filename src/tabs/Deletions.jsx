import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import { useSelection } from '../useSelection'
import { Undo2, Users, Trash2, Pencil, Check, X } from 'lucide-react'

function fmtDeleted(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Deletions({ version, bump }) {
  const [students, setStudents] = useState([])
  const [editId, setEditId] = useState(null)
  const [editReason, setEditReason] = useState('')
  const sel = useSelection()

  function startEditReason(s) {
    setEditId(s.id)
    setEditReason(s.deletion_reason || '')
  }

  async function saveReason() {
    await api.updateStudent(editId, { deletion_reason: editReason.trim() })
    setEditId(null)
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
    { key: 'imerominia_gennisis', label: 'Ημ. γέννησης', editable: true },
    { key: 'school_name', label: 'Σχολείο' },
    { key: 'current_grade', label: 'Τάξη', editable: true },
    { key: 'deleted_at', label: 'Ημ. διαγραφής', render: (s) => fmtDeleted(s.deleted_at) },
    {
      key: 'deletion_reason',
      label: 'Λόγος διαγραφής',
      render: (s) =>
        editId === s.id ? (
          <div className="flex items-center gap-1">
            <input
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveReason()}
              autoFocus
              className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <button
              onClick={saveReason}
              title="Αποθήκευση"
              className="rounded-md border border-green-200 p-1 text-green-700 hover:bg-green-50"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => setEditId(null)}
              title="Άκυρο"
              className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => startEditReason(s)}
            title="Επεξεργασία λόγου"
            className="inline-flex items-center gap-1 text-left text-slate-600 hover:text-blue-600"
          >
            <span className={s.deletion_reason ? '' : 'text-slate-300'}>
              {s.deletion_reason || '—'}
            </span>
            <Pencil size={12} className="text-slate-400" />
          </button>
        ),
    },
    {
      key: 'prev_status',
      label: 'Επιστροφή σε',
      render: (s) => (s.prev_status === 'enrolled' ? 'Μαθητές' : 'Αφίξεις'),
    },
  ]

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
        onCellSave={saveCell}
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
