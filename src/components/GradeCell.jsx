import { useState } from 'react'
import api from '../api'
import { ChevronDown } from 'lucide-react'
import CellDropdown from './CellDropdown'

// Κλικαρόμενο κελί τάξης: αυτόματη κατάταξη βάσει ηλικίας, αλλά αλλάζει inline
// (πολλοί μαθητές μπαίνουν στην Α′ ανεξαρτήτως ηλικίας λόγω γλώσσας).
// `fallbackGrade`: τιμή που εμφανίζεται όσο δεν έχει επιλεγεί τάξη (π.χ. η προτεινόμενη
// στις Αφίξεις)· η επιλογή γράφεται πάντα στο current_grade.
export default function GradeCell({ student, onChanged, onError, fallbackGrade }) {
  const [grades, setGrades] = useState(null)

  async function load() {
    if (grades) return
    const type = student.school_type || student.computed_type
    const g = await api.gradesForType(type)
    setGrades(g || [])
  }

  async function pick(grade, close) {
    const res = await api.updateStudent(student.id, { current_grade: grade })
    if (res && res.error) {
      if (onError) onError(res.error)
      return
    }
    close()
    onChanged()
  }

  return (
    <CellDropdown
      menuWidth={160}
      onOpen={load}
      buttonClassName="inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm text-slate-700 hover:bg-slate-100"
      trigger={
        <>
          {student.current_grade || fallbackGrade || '—'}
          <ChevronDown size={13} className="opacity-60" />
        </>
      }
    >
      {(close) =>
        !grades ? (
          <div className="px-3 py-2 text-sm text-slate-400">Φόρτωση…</div>
        ) : grades.length === 0 ? (
          <div className="px-3 py-2 text-sm text-slate-400">—</div>
        ) : (
          grades.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => pick(g, close)}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 ${
                g === (student.current_grade || fallbackGrade) ? 'font-medium text-blue-600' : 'text-slate-700'
              }`}
            >
              {g}
            </button>
          ))
        )
      }
    </CellDropdown>
  )
}
