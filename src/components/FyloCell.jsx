import { useState } from 'react'
import api from '../api'
import { ChevronDown } from 'lucide-react'

// Κλικαρόμενο κελί φύλου: dropdown με ΑΡΡΕΝ/ΘΗΛΥ (αντί για ελεύθερο κείμενο).
const OPTIONS = ['ΑΡΡΕΝ', 'ΘΗΛΥ']

export default function FyloCell({ student, onChanged }) {
  const [open, setOpen] = useState(false)

  async function pick(v) {
    setOpen(false)
    if (v !== student.fylo) {
      await api.updateStudent(student.id, { fylo: v })
      onChanged()
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        {student.fylo || '—'}
        <ChevronDown size={13} className="opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-28 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {OPTIONS.map((v) => (
              <button
                key={v}
                onClick={() => pick(v)}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 ${
                  v === student.fylo ? 'font-medium text-blue-600' : 'text-slate-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
