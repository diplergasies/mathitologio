import api from '../api'
import { ChevronDown } from 'lucide-react'
import CellDropdown from './CellDropdown'

// Κλικαρόμενο κελί φύλου: dropdown με ΑΡΡΕΝ/ΘΗΛΥ (αντί για ελεύθερο κείμενο).
const OPTIONS = ['ΑΡΡΕΝ', 'ΘΗΛΥ']

export default function FyloCell({ student, onChanged, onError }) {
  async function pick(v, close) {
    if (v === student.fylo) return close()
    const res = await api.updateStudent(student.id, { fylo: v })
    if (res && res.error) {
      if (onError) onError(res.error)
      return
    }
    close()
    onChanged()
  }

  return (
    <CellDropdown
      menuWidth={112}
      buttonClassName="inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm text-slate-700 hover:bg-slate-100"
      trigger={
        <>
          {student.fylo || '—'}
          <ChevronDown size={13} className="opacity-60" />
        </>
      }
    >
      {(close) =>
        OPTIONS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => pick(v, close)}
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 ${
              v === student.fylo ? 'font-medium text-blue-600' : 'text-slate-700'
            }`}
          >
            {v}
          </button>
        ))
      }
    </CellDropdown>
  )
}
