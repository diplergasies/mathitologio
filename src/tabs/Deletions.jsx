import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import StudentNoteModal from '../components/StudentNoteModal'
import DeleteReasonModal from '../components/DeleteReasonModal'
import FyloCell from '../components/FyloCell'
import { useSelection } from '../useSelection'
import { useConfirm } from '../components/ConfirmProvider'
import { Undo2, Users, Trash2 } from 'lucide-react'
import { isoToDMY } from '../calendarUtils'

// Αρχή του λόγου (έως 2 λέξεις)· αν περισσεύει κείμενο, προστίθενται «...».
function shortReason(reason) {
  const text = String(reason || '').trim()
  if (!text) return ''
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= 2) return words.join(' ')
  return `${words.slice(0, 2).join(' ')}...`
}

function fmtDeleted(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Deletions({ version, bump, showToast }) {
  const confirm = useConfirm()
  const [students, setStudents] = useState([])
  const [reasonFor, setReasonFor] = useState(null)
  const [noteFor, setNoteFor] = useState(null)
  const [sub, setSub] = useState('students') // προεπιλογή: διαγραμμένοι από τους Μαθητές
  const sel = useSelection()

  const notifyError = (m) => showToast && showToast(m, 'error')

  async function update(id, fields) {
    try {
      const res = await api.updateStudent(id, fields)
      if (res && res.error) {
        notifyError(res.error)
        bump()
        return false
      }
    } catch (e) {
      notifyError(`Αποτυχία αποθήκευσης: ${e && e.message ? e.message : e}`)
      bump()
      return false
    }
    bump()
    return true
  }

  async function saveCell(id, key, value) {
    await update(id, { [key]: value })
  }

  async function applyColor(ids, color) {
    await api.setStudentColor(ids, color)
    sel.clear()
    bump()
  }

  const baseColumns = [
    { key: 'eponymo', label: 'Επώνυμο', editable: true },
    { key: 'onoma', label: 'Όνομα', editable: true },
    { key: 'patronymo', label: 'Πατρώνυμο', editable: true },
    { key: 'monada', label: 'Μονάδα', editable: true },
    { key: 'dika', label: 'ΔΙΚΑ', editable: true },
    { key: 'fylo', label: 'Φύλο', render: (s) => <FyloCell student={s} onChanged={bump} onError={notifyError} /> },
    { key: 'ithageneia', label: 'Ιθαγένεια', editable: true },
    { key: 'imerominia_gennisis', label: 'Ημ. γέννησης', editable: true },
  ]
  const deletionDateCol = {
    key: 'deleted_at',
    label: 'Ημ. διαγραφής',
    editable: true,
    render: (s) => fmtDeleted(s.deleted_at),
    editAccessor: (s) => isoToDMY(s.deleted_at),
  }
  const studentColumns = [
    ...baseColumns,
    { key: 'school_name', label: 'Σχολείο' },
    { key: 'current_grade', label: 'Τάξη', editable: true },
    {
      key: 'enrolled_at',
      label: 'Ημ. εγγραφής',
      editable: true,
      sortable: true,
      sortAccessor: (s) => {
        const t = s.enrolled_at ? new Date(s.enrolled_at).getTime() : NaN
        return Number.isFinite(t) ? t : null
      },
      render: (s) => isoToDMY(s.enrolled_at) || '—',
      editAccessor: (s) => isoToDMY(s.enrolled_at),
    },
    deletionDateCol,
    {
      key: 'deletion_reason',
      label: 'Λόγος διαγραφής',
      render: (s) => (
        <button
          onClick={() => setReasonFor(s)}
          title={s.deletion_reason || 'Αλλαγή λόγου διαγραφής'}
          className="text-left text-slate-600 hover:text-blue-600"
        >
          <span className={s.deletion_reason ? '' : 'text-slate-300'}>
            {shortReason(s.deletion_reason) || '—'}
          </span>
        </button>
      ),
    },
  ]
  const arrivalColumns = [
    ...baseColumns,
    { key: 'current_grade', label: 'Τάξη', editable: true },
    { key: 'imerominia_afixis', label: 'Ημ. άφιξης', editable: true },
    deletionDateCol,
  ]

  const isStudents = sub === 'students'
  const visible = students.filter((s) =>
    isStudents ? s.prev_status === 'enrolled' : s.prev_status !== 'enrolled'
  )
  const studentCount = students.filter((s) => s.prev_status === 'enrolled').length
  const arrivalCount = students.length - studentCount

  function chooseSub(id) {
    setSub(id)
    sel.clear()
    setReasonFor(null)
  }

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
    if (
      !(await confirm({
        message: `ΟΡΙΣΤΙΚΗ διαγραφή του μαθητή ${s.eponymo} ${s.onoma};\nΔεν αναιρείται.`,
        confirmLabel: 'Οριστική διαγραφή',
      }))
    )
      return
    await api.purgeStudent(s.id)
    bump()
  }

  async function bulkPurge() {
    if (
      !(await confirm({
        message: `ΟΡΙΣΤΙΚΗ διαγραφή ${sel.ids.length} μαθητών;\nΔεν αναιρείται.`,
        confirmLabel: 'Οριστική διαγραφή',
      }))
    )
      return
    await api.bulkPurge(sel.ids)
    sel.clear()
    bump()
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: 'students', label: 'Μαθητές', count: studentCount },
            { id: 'arrivals', label: 'Αφίξεις', count: arrivalCount },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => chooseSub(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                sub === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs font-normal text-slate-400">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

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
        key={sub}
        students={visible}
        columns={isStudents ? studentColumns : arrivalColumns}
        tableId={isStudents ? 'deletions-students' : 'deletions-arrivals'}
        emptyText={isStudents ? 'Κανένας διαγραμμένος μαθητής.' : 'Καμία διαγραμμένη άφιξη.'}
        searchable
        selectable
        selectedIds={sel.ids}
        onToggle={sel.toggle}
        onToggleAll={sel.toggleAll}
        onCellSave={saveCell}
        onSetColor={applyColor}
        onOpenNote={setNoteFor}
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

      {noteFor && (
        <StudentNoteModal
          student={noteFor}
          onClose={() => setNoteFor(null)}
          onSave={async (text) => { await update(noteFor.id, { note: text }); setNoteFor(null) }}
        />
      )}

      {reasonFor && (
        <DeleteReasonModal
          title="Λόγος διαγραφής"
          message="Άλλαξε τον λόγο διαγραφής:"
          students={[reasonFor]}
          initialReasons={{ [reasonFor.id]: reasonFor.deletion_reason }}
          confirmLabel="Αποθήκευση"
          onConfirm={async (r) => {
            await update(reasonFor.id, { deletion_reason: r[reasonFor.id] })
          }}
          onClose={() => setReasonFor(null)}
        />
      )}
    </div>
  )
}
