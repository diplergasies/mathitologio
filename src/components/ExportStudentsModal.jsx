import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'
import Modal from './Modal'
import api from '../api'
import { isoToDMY } from '../calendarUtils'

// Όλα τα διαθέσιμα πεδία προς εξαγωγή. Τα `default: true` είναι τσεκαρισμένα εξ αρχής
// (ίδια με όσα φαίνονται στην καρτέλα Μαθητές). Τα υπόλοιπα διαθέσιμα αλλά ξετσεκαρισμένα.
const FIELDS = [
  { key: 'eponymo', label: 'Επώνυμο', accessor: (s) => s.eponymo, default: true },
  { key: 'onoma', label: 'Όνομα', accessor: (s) => s.onoma, default: true },
  { key: 'patronymo', label: 'Πατρώνυμο', accessor: (s) => s.patronymo, default: true },
  { key: 'monada', label: 'Μονάδα', accessor: (s) => s.monada, default: true },
  { key: 'dika', label: 'ΔΙΚΑ', accessor: (s) => s.dika, default: true },
  { key: 'fylo', label: 'Φύλο', accessor: (s) => s.fylo, default: true },
  { key: 'ithageneia', label: 'Ιθαγένεια', accessor: (s) => s.ithageneia, default: true },
  { key: 'imerominia_gennisis', label: 'Ημ. γέννησης', accessor: (s) => s.imerominia_gennisis, default: true },
  { key: 'school_name', label: 'Σχολείο', accessor: (s) => s.school_name, default: true },
  { key: 'school_type', label: 'Τύπος', accessor: (s) => s.school_type, default: true },
  { key: 'current_grade', label: 'Τάξη', accessor: (s) => s.current_grade, default: true },
  { key: 'imerominia_afixis', label: 'Ημ. άφιξης', accessor: (s) => s.imerominia_afixis, default: true },
  { key: 'enrolled_at', label: 'Ημ. εγγραφής', accessor: (s) => isoToDMY(s.enrolled_at), default: true },
  { key: 'epitropos', label: 'Επίτροπος', accessor: (s) => s.epitropos, default: true },
  { key: 'asynodeftos', label: 'Ασυνόδευτος', accessor: (s) => s.asynodeftos, default: true },
  { key: 'eidiki_agogi', label: 'Ειδ. αγωγή', accessor: (s) => s.eidiki_agogi, default: true },
  { key: 'mitronymo', label: 'Μητρώνυμο', accessor: (s) => s.mitronymo, default: false },
  { key: 'glossa', label: 'Γλώσσα', accessor: (s) => s.glossa, default: false },
  { key: 'birth_year', label: 'Έτος γέννησης', accessor: (s) => s.birth_year, default: false },
  { key: 'batch_year', label: 'Σχολικό έτος', accessor: (s) => s.batch_year, default: false },
]

export default function ExportStudentsModal({ students, onClose }) {
  const [checked, setChecked] = useState(() => new Set(FIELDS.filter((f) => f.default).map((f) => f.key)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggle(key) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function doExport() {
    setBusy(true)
    setError('')
    try {
      const cols = FIELDS.filter((f) => checked.has(f.key))
      const aoa = [
        cols.map((c) => c.label),
        ...students.map((s) => cols.map((c) => c.accessor(s) ?? '')),
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
        disabled={busy || checked.size === 0}
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        <Download size={15} /> {busy ? 'Εξαγωγή…' : 'Εξαγωγή'}
      </button>
    </>
  )

  return (
    <Modal title="Εξαγωγή μαθητών σε Excel" onClose={onClose} footer={footer}>
      <p className="mb-3 text-sm text-slate-500">
        Θα εξαχθούν <span className="font-semibold text-slate-700">{students.length}</span> μαθητές.
        Επιλέξτε τα πεδία που θέλετε να συμπεριληφθούν:
      </p>
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
