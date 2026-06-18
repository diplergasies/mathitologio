import { useState } from 'react'
import api from '../api'
import { ChevronDown } from 'lucide-react'

// Κλικαρόμενο κελί τάξης: αυτόματη κατάταξη βάσει ηλικίας, αλλά αλλάζει inline
// (πολλοί μαθητές μπαίνουν στην Α′ ανεξαρτήτως ηλικίας λόγω γλώσσας).
export default function GradeCell({ student, onChanged }) {
  const [open, setOpen] = useState(false)
  const [grades, setGrades] = useState(null)

  async function openPicker() {
    setOpen(true)
    if (!grades) {
      const type = student.school_type || student.computed_type
      const g = await api.gradesForType(type)
      setGrades(g || [])
    }
  }

  async function pick(grade) {
    await api.updateStudent(student.id, { current_grade: grade })
    setOpen(false)
    onChanged()
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={openPicker}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        {student.current_grade || '—'}
        <ChevronDown size={13} className="opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-40 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {!grades ? (
              <div className="px-3 py-2 text-sm text-slate-400">Φόρτωση…</div>
            ) : grades.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">—</div>
            ) : (
              grades.map((g) => (
                <button
                  key={g}
                  onClick={() => pick(g)}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 ${
                    g === student.current_grade ? 'font-medium text-blue-600' : 'text-slate-700'
                  }`}
                >
                  {g}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
