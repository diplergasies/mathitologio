import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import FyloCell from '../components/FyloCell'
import GradeCell from '../components/GradeCell'
import BulkEnrollModal from '../components/BulkEnrollModal'
import BulkDeleteByDikaModal from '../components/BulkDeleteByDikaModal'
import ManualArrivalModal from '../components/ManualArrivalModal'
import RegistrationPackageModal from '../components/RegistrationPackageModal'
import StudentNoteModal from '../components/StudentNoteModal'
import DeleteReasonModal from '../components/DeleteReasonModal'
import LastImportBadge from '../components/LastImportBadge'
import { useSelection } from '../useSelection'
import { birthSortValue, proposedSortValue } from '../sort'
import { notifyOutbound } from '../lib/outboundNotice'
import { GraduationCap, Trash2, Users, Hash, UserPlus } from 'lucide-react'

export default function Arrivals({ version, bump, showToast }) {
  const [students, setStudents] = useState([])
  const [bulkEnroll, setBulkEnroll] = useState(false)
  const [dikaDelete, setDikaDelete] = useState(false)
  const [manual, setManual] = useState(false)
  const [pkgQueue, setPkgQueue] = useState([]) // ουρά μαθητών για έκδοση πακέτου εγγραφής (κανόνας «αυτόματα»)
  const [pkgIndex, setPkgIndex] = useState(0) // τρέχων μαθητής στην ουρά
  const [noteFor, setNoteFor] = useState(null)
  const [delList, setDelList] = useState(null) // μαθητές προς διαγραφή (pop-up λόγου)
  const sel = useSelection()

  function load() {
    api.listStudents('arrival').then((r) => setStudents(r || []))
  }
  useEffect(load, [version])

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

  async function toggleEpitropos(s) {
    await update(s.id, { epitropos: s.epitropos === 'Ναι' ? 'Όχι' : 'Ναι' })
  }

  const columns = [
    { key: 'eponymo', label: 'Επώνυμο', editable: true },
    { key: 'onoma', label: 'Όνομα', editable: true },
    { key: 'patronymo', label: 'Πατρώνυμο', editable: true },
    { key: 'monada', label: 'Μονάδα', editable: true },
    { key: 'dika', label: 'ΔΙΚΑ', editable: true },
    { key: 'fylo', label: 'Φύλο', render: (s) => <FyloCell student={s} onChanged={bump} onError={notifyError} /> },
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
      // Επιλογή τάξης εγγραφής: dropdown όπως στους Μαθητές. Δείχνει την προτεινόμενη
      // τάξη ως προεπιλογή· η επιλογή γράφεται στο current_grade και περνά στην εγγραφή.
      key: 'proposed',
      label: 'Προτεινόμενη τάξη',
      sortable: true,
      sortAccessor: proposedSortValue,
      render: (s) => (
        <GradeCell
          student={s}
          fallbackGrade={s.computed_grade}
          onChanged={bump}
          onError={notifyError}
        />
      ),
    },
  ]

  async function enrollOne(s) {
    const res = await api.enroll(s.id)
    if (res && res.error) {
      notifyError(res.error)
      bump()
      return
    }
    bump()
    if (res && res.packageMode === 'auto') {
      setPkgQueue([s])
      setPkgIndex(0)
    }
  }

  // Διαγραφή (μία ή μαζική): ανοίγει το pop-up λόγου διαγραφής ανά μαθητή.
  function del(s) {
    setDelList([s])
  }

  function bulkDelete() {
    setDelList(students.filter((s) => sel.ids.includes(s.id)))
  }

  async function saveCell(id, key, value) {
    await update(id, { [key]: value })
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
        tableId="arrivals"
        emptyText="Καμία άφιξη. Κάνε εισαγωγή αρχείου XLSX."
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

      {delList && (
        <DeleteReasonModal
          title={delList.length > 1 ? 'Μαζική διαγραφή' : 'Διαγραφή μαθητή'}
          message={
            delList.length > 1
              ? `Οι ${delList.length} αφίξεις θα μεταφερθούν στις Διαγραφές. Διάλεξε λόγο για τον καθένα:`
              : 'Η άφιξη θα μεταφερθεί στις Διαγραφές. Διάλεξε τον λόγο διαγραφής:'
          }
          students={delList}
          onConfirm={async (reasons) => {
            const res = await api.bulkDelete(delList.map((s) => s.id), null, reasons)
            notifyOutbound(res, showToast)
            if (delList.length > 1) sel.clear()
            bump()
          }}
          onClose={() => setDelList(null)}
        />
      )}

      {noteFor && (
        <StudentNoteModal
          student={noteFor}
          onClose={() => setNoteFor(null)}
          onSave={async (text) => { await update(noteFor.id, { note: text }); setNoteFor(null) }}
        />
      )}

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
            if (res && res.packageMode === 'auto' && objs.length) {
              setPkgQueue(objs)
              setPkgIndex(0)
            }
          }}
        />
      )}

      {dikaDelete && (
        <BulkDeleteByDikaModal
          showToast={showToast}
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

      {/* Έκδοση πακέτου εγγραφής ανά μαθητή, όταν ο κανόνας είναι «αυτόματα». */}
      {pkgQueue[pkgIndex] && (
        <RegistrationPackageModal
          key={pkgQueue[pkgIndex].id}
          student={pkgQueue[pkgIndex]}
          onClose={() => {
            if (pkgIndex + 1 < pkgQueue.length) {
              setPkgIndex(pkgIndex + 1)
            } else {
              setPkgQueue([])
              setPkgIndex(0)
            }
          }}
        />
      )}
    </div>
  )
}
