import { useState } from 'react'
import api from '../api'
import { ChevronDown, AlertCircle } from 'lucide-react'

// Κλικαρόμενο κελί σχολείου: εμφανίζει το τρέχον σχολείο (ή «Επιλογή» αν κενό)
// και ανοίγει dropdown με τα σχολεία που ταιριάζουν στην ηλικία του μαθητή.
export default function SchoolCell({ student, onChanged }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState(null)

  async function openPicker() {
    setOpen(true)
    if (!opts) {
      const o = await api.enrollOptions(student.id)
      setOpts(o)
    }
  }

  async function pick(schoolId) {
    await api.setSchool(student.id, schoolId)
    setOpen(false)
    onChanged()
  }

  const hasSchool = !!student.school_name

  return (
    <div className="relative inline-block">
      <button
        onClick={openPicker}
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm ${
          hasSchool
            ? 'text-slate-700 hover:bg-slate-100'
            : 'bg-amber-100 font-medium text-amber-700 hover:bg-amber-200'
        }`}
      >
        {hasSchool ? student.school_name : '— Επιλογή σχολείου —'}
        <ChevronDown size={13} className="opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-64 w-60 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {!opts ? (
              <div className="px-3 py-2 text-sm text-slate-400">Φόρτωση…</div>
            ) : opts.error ? (
              <div className="px-3 py-2 text-sm text-red-600">{opts.error}</div>
            ) : opts.schools.length === 0 ? (
              <div className="flex items-start gap-1.5 px-3 py-2 text-sm text-amber-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                Δεν υπάρχει σχολείο τύπου {opts.eligibleTypes.join(' ή ')}. Πρόσθεσέ το από τις
                Ρυθμίσεις.
              </div>
            ) : (
              opts.schools.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => pick(sc.id)}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 ${
                    sc.id === student.school_id ? 'font-medium text-blue-600' : 'text-slate-700'
                  }`}
                >
                  {sc.name} <span className="text-slate-400">({sc.type})</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
