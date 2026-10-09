import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { ChevronDown, Download } from 'lucide-react'
import Modal from './Modal'
import api from '../api'
import { isoToDMY } from '../calendarUtils'

// Όλα τα διαθέσιμα πεδία προς εξαγωγή. Τα `default: true` είναι τσεκαρισμένα εξ αρχής.
// Η σειρά του πίνακα είναι και η σειρά στηλών στο Excel.
const FIELDS = [
  { key: 'onoma', label: 'Όνομα', accessor: (s) => s.onoma, default: true },
  { key: 'eponymo', label: 'Επώνυμο', accessor: (s) => s.eponymo, default: true },
  { key: 'patronymo', label: 'Πατρώνυμο', accessor: (s) => s.patronymo, default: true },
  { key: 'dika', label: 'ΔΙΚΑ', accessor: (s) => s.dika, default: true },
  { key: 'imerominia_gennisis', label: 'Ημ. γέννησης', accessor: (s) => s.imerominia_gennisis, default: true },
  { key: 'monada', label: 'Μονάδα', accessor: (s) => s.monada, default: false },
  { key: 'fylo', label: 'Φύλο', accessor: (s) => s.fylo, default: false },
  { key: 'ithageneia', label: 'Ιθαγένεια', accessor: (s) => s.ithageneia, default: false },
  { key: 'school_name', label: 'Σχολείο', accessor: (s) => s.school_name, default: false },
  { key: 'school_type', label: 'Τύπος', accessor: (s) => s.school_type, default: false },
  { key: 'current_grade', label: 'Τάξη', accessor: (s) => s.current_grade, default: false },
  { key: 'imerominia_afixis', label: 'Ημ. άφιξης', accessor: (s) => s.imerominia_afixis, default: false },
  { key: 'enrolled_at', label: 'Ημ. εγγραφής', accessor: (s) => isoToDMY(s.enrolled_at), default: false },
  { key: 'epitropos', label: 'Επίτροπος', accessor: (s) => s.epitropos, default: false },
  { key: 'asynodeftos', label: 'Ασυνόδευτος', accessor: (s) => s.asynodeftos, default: false },
  { key: 'eidiki_agogi', label: 'Ειδ. αγωγή', accessor: (s) => s.eidiki_agogi, default: false },
  { key: 'mitronymo', label: 'Μητρώνυμο', accessor: (s) => s.mitronymo, default: false },
  { key: 'glossa', label: 'Γλώσσα', accessor: (s) => s.glossa, default: false },
  { key: 'birth_year', label: 'Έτος γέννησης', accessor: (s) => s.birth_year, default: false },
  { key: 'batch_year', label: 'Σχολικό έτος', accessor: (s) => s.batch_year, default: false },
]

const NO_SCHOOL = 'none'

function schoolKey(s) {
  return s.school_id != null && s.school_id !== '' ? `id:${s.school_id}` : NO_SCHOOL
}

// Σχολεία με τουλάχιστον έναν μαθητή στη λίστα εξαγωγής. «Χωρίς σχολείο» μόνο αν υπάρχει τέτοιος.
function schoolOptions(students) {
  const map = new Map()
  for (const s of students) {
    const key = schoolKey(s)
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: key === NO_SCHOOL ? 'Χωρίς σχολείο' : s.school_name || 'Χωρίς σχολείο',
      })
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === NO_SCHOOL) return 1
    if (b.key === NO_SCHOOL) return -1
    return a.label.localeCompare(b.label, 'el')
  })
}

export default function ExportStudentsModal({ students, onClose }) {
  const options = useMemo(() => schoolOptions(students), [students])
  const [checked, setChecked] = useState(() => new Set(FIELDS.filter((f) => f.default).map((f) => f.key)))
  const [schools, setSchools] = useState(() => new Set(schoolOptions(students).map((o) => o.key)))
  const [schoolsOpen, setSchoolsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const allSchools = options.length > 0 && options.every((o) => schools.has(o.key))
  const exported = students.filter((s) => schools.has(schoolKey(s)))

  function toggle(key) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSchool(key) {
    setSchools((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAllSchools() {
    setSchools(allSchools ? new Set() : new Set(options.map((o) => o.key)))
  }

  const schoolButtonLabel = allSchools
    ? 'Όλα τα σχολεία'
    : exported.length === 0
      ? 'Κανένα σχολείο'
      : options.filter((o) => schools.has(o.key)).map((o) => o.label).join(', ')

  async function doExport() {
    setBusy(true)
    setError('')
    try {
      const cols = FIELDS.filter((f) => checked.has(f.key))
      const aoa = [
        cols.map((c) => c.label),
        ...exported.map((s) => cols.map((c) => c.accessor(s) ?? '')),
      ]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Μαθητές')
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      const r = await api.saveStudentsXlsx(buf, 'Μαθητές.xlsx')
      if (r?.ok) onClose()
      else if (r?.error) setError(r.error)
      // r?.canceled → ο χρήστης έκλεισε τον διάλογο αποθήκευσης, μένουμε στο modal
    } catch (err) {
      setError(`Αποτυχία εξαγωγής: ${err && err.message ? err.message : err}`)
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <>
      <button
        onClick={() => setChecked(new Set(FIELDS.map((f) => f.key)))}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Επιλογή όλων
      </button>
      <button
        onClick={() => setChecked(new Set())}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Αποεπιλογή όλων
      </button>
      <button
        onClick={onClose}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Ακύρωση
      </button>
      <button
        onClick={doExport}
        disabled={busy || checked.size === 0 || exported.length === 0}
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        <Download size={15} /> {busy ? 'Εξαγωγή…' : 'Εξαγωγή'}
      </button>
    </>
  )

  return (
    <Modal title="Εξαγωγή μαθητών σε Excel" onClose={onClose} footer={footer}>
      <p className="mb-3 text-sm text-slate-500">
        Θα εξαχθούν <span className="font-semibold text-slate-700">{exported.length}</span> μαθητές.
        Επιλέξτε σχολεία και πεδία:
      </p>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setSchoolsOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          <span className="min-w-0 flex-1 truncate">{schoolButtonLabel}</span>
          <ChevronDown size={16} className={`shrink-0 text-slate-400 ${schoolsOpen ? 'rotate-180' : ''}`} />
        </button>
        {schoolsOpen && (
          <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white py-1">
            <button
              type="button"
              onClick={toggleAllSchools}
              disabled={options.length === 0}
              className="w-full px-3 py-1.5 text-left text-sm font-medium text-blue-700 hover:bg-slate-50 disabled:text-slate-300"
            >
              {allSchools ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
            </button>
            {options.map((o) => (
              <label key={o.key} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={schools.has(o.key)}
                  onChange={() => toggleSchool(o.key)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {o.label}
              </label>
            ))}
            {options.length === 0 && (
              <p className="px-3 py-1.5 text-sm text-slate-400">Δεν υπάρχουν μαθητές προς εξαγωγή.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={checked.has(f.key)}
              onChange={() => toggle(f.key)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            {f.label}
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </Modal>
  )
}
