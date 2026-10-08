import { useEffect, useState } from 'react'
import api from '../api'
import StudentTable from '../components/StudentTable'
import DocumentModal from '../components/DocumentModal'
import RegistrationPackageModal from '../components/RegistrationPackageModal'
import BulkDocumentModal from '../components/BulkDocumentModal'
import BulkDeleteByDikaModal from '../components/BulkDeleteByDikaModal'
import DeleteReasonModal from '../components/DeleteReasonModal'
import ExportStudentsModal from '../components/ExportStudentsModal'
import StudentNoteModal from '../components/StudentNoteModal'
import SchoolCell from '../components/SchoolCell'
import GradeCell from '../components/GradeCell'
import FyloCell from '../components/FyloCell'
import LastImportBadge from '../components/LastImportBadge'
import { useSelection } from '../useSelection'
import { birthSortValue } from '../sort'
import { isoToDMY } from '../calendarUtils'
import { FileText, Trash2, Users, Hash, FileSpreadsheet, FolderArchive } from 'lucide-react'

export default function Students({ version, bump, showToast }) {
  const [students, setStudents] = useState([])
  const [docFor, setDocFor] = useState(null)
  const [pkgFor, setPkgFor] = useState(null)
  const [bulkDoc, setBulkDoc] = useState(false)
  const [dikaDelete, setDikaDelete] = useState(false)
  const [delFor, setDelFor] = useState(null) // μαθητής προς διαγραφή (single)
  const [bulkDel, setBulkDel] = useState(false) // μαζική διαγραφή επιλεγμένων
  const [exportOpen, setExportOpen] = useState(false)
  const [noteFor, setNoteFor] = useState(null)
  const sel = useSelection()

  function load() {
    api.listStudents('enrolled').then((r) => setStudents(r || []))
  }
  useEffect(load, [version])

  const notifyError = (m) => showToast && showToast(m, 'error')

  // Κοινή ενημέρωση μαθητή: εμφανίζει μήνυμα σε αποτυχία αποθήκευσης (π.χ. κλειδωμένο
  // αρχείο DB) αντί να αποτυγχάνει σιωπηλά, και ανανεώνει ώστε το κελί να μη δείχνει
  // ψευδώς την αλλαγή.
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

  async function toggleAsyn(s) {
    await update(s.id, { asynodeftos: s.asynodeftos === 'Ναι' ? 'Όχι' : 'Ναι' })
  }

  async function toggleEidiki(s) {
    await update(s.id, { eidiki_agogi: s.eidiki_agogi === 'Ναι' ? 'Όχι' : 'Ναι' })
  }

  async function toggleEnilikas(s) {
    await update(s.id, { enilikas: s.enilikas === 'Ναι' ? 'Όχι' : 'Ναι' })
  }

  async function saveCell(id, key, value) {
    await update(id, { [key]: value })
  }

  async function applyColor(ids, color) {
    await api.setStudentColor(ids, color)
    sel.clear()
    bump()
  }

  const columns = [
    { key: 'eponymo', label: 'Επώνυμο', editable: true },
    { key: 'onoma', label: 'Όνομα', editable: true },
    { key: 'patronymo', label: 'Πατρώνυμο', editable: true },
    { key: 'monada', label: 'Μονάδα', editable: true },
    { key: 'dika', label: 'ΔΙΚΑ', editable: true },
    { key: 'fylo', label: 'Φύλο', render: (s) => <FyloCell student={s} onChanged={bump} onError={notifyError} /> },
    { key: 'ithageneia', label: 'Ιθαγένεια', editable: true },
    { key: 'imerominia_gennisis', label: 'Ημ. γέννησης', sortable: true, sortAccessor: birthSortValue, editable: true },
    {
      key: 'school_name',
      label: 'Σχολείο',
      sortable: true,
      sortAccessor: (s) => s.school_name || '',
      render: (s) => <SchoolCell student={s} onChanged={bump} onError={notifyError} />,
    },
    { key: 'school_type', label: 'Τύπος', render: (s) => s.school_type || '—' },
    {
      key: 'current_grade',
      label: 'Τάξη',
      render: (s) => <GradeCell student={s} onChanged={bump} onError={notifyError} />,
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
    {
      key: 'enilikas',
      label: 'Ενήλικας',
      render: (s) => (
        <button
          onClick={() => toggleEnilikas(s)}
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            s.enilikas === 'Ναι' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {s.enilikas || 'Όχι'}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <FileSpreadsheet size={15} /> Εξαγωγή σε Excel
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
        tableId="students"
        emptyText="Κανένας εγγεγραμμένος μαθητής."
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
              onClick={() => setPkgFor(s)}
              title="Πακέτο εγγραφής"
              className="rounded-md border border-indigo-200 p-1 text-indigo-600 hover:bg-indigo-50"
            >
              <FolderArchive size={14} />
            </button>
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

      {noteFor && (
        <StudentNoteModal
          student={noteFor}
          onClose={() => setNoteFor(null)}
          onSave={async (text) => { await update(noteFor.id, { note: text }); setNoteFor(null) }}
        />
      )}

      {pkgFor && <RegistrationPackageModal student={pkgFor} onClose={() => setPkgFor(null)} />}
      {docFor && <DocumentModal student={docFor} onClose={() => setDocFor(null)} />}
      {bulkDoc && (
        <BulkDocumentModal
          students={students.filter((s) => sel.ids.includes(s.id))}
          onClose={() => setBulkDoc(false)}
        />
      )}

      {delFor && (
        <DeleteReasonModal
          title="Διαγραφή μαθητή"
          message="Ο μαθητής θα μεταφερθεί στις Διαγραφές → Μαθητές. Διάλεξε τον λόγο διαγραφής:"
          students={[delFor]}
          onConfirm={async (reasons) => {
            await api.bulkDelete([delFor.id], null, reasons)
            bump()
          }}
          onClose={() => setDelFor(null)}
        />
      )}

      {bulkDel && (
        <DeleteReasonModal
          title="Μαζική διαγραφή"
          message={`Οι ${sel.ids.length} μαθητές θα μεταφερθούν στις Διαγραφές → Μαθητές. Διάλεξε λόγο για τον καθένα:`}
          students={students.filter((s) => sel.ids.includes(s.id))}
          onConfirm={async (reasons) => {
            await api.bulkDelete(sel.ids, null, reasons)
            sel.clear()
            bump()
          }}
          onClose={() => setBulkDel(false)}
        />
      )}

      {exportOpen && (
        <ExportStudentsModal
          students={sel.ids.length > 0 ? students.filter((s) => sel.ids.includes(s.id)) : students}
          onClose={() => setExportOpen(false)}
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
