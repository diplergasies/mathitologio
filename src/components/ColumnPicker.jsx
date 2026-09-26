import { useEffect, useRef, useState } from 'react'
import { Columns3, RotateCcw } from 'lucide-react'

// Μενού «Προβολή στηλών»: checkbox ανά στήλη για εμφάνιση/απόκρυψη. Τουλάχιστον μία στήλη
// μένει πάντα ορατή. hidden = Set με τα keys των κρυφών στηλών· onChange(νέο Set).
export default function ColumnPicker({ columns, hidden, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Κλείσιμο με κλικ έξω από το μενού ή με Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visibleCount = columns.filter((c) => !hidden.has(c.key)).length

  function toggle(key) {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else if (visibleCount > 1) next.add(key)
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
          hidden.size ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-600'
        } hover:bg-slate-50`}
      >
        <Columns3 size={15} /> Προβολή στηλών
        {hidden.size > 0 && (
          <span className="text-xs font-normal">
            ({visibleCount}/{columns.length})
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-60 rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg">
          <div className="max-h-[70vh] overflow-y-auto">
            {columns.map((c) => {
              const checked = !hidden.has(c.key)
              const locked = checked && visibleCount === 1
              return (
                <label
                  key={c.key}
                  title={locked ? 'Πρέπει να μένει ορατή τουλάχιστον μία στήλη' : undefined}
                  className={`flex items-center gap-2 px-3 py-1 text-sm ${
                    locked ? 'text-slate-400' : 'cursor-pointer text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggle(c.key)} />
                  {c.label}
                </label>
              )
            })}
          </div>
          <div className="mt-1 border-t border-slate-100 px-3 pt-1.5">
            <button
              type="button"
              onClick={() => onChange(new Set())}
              disabled={!hidden.size}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline"
            >
              <RotateCcw size={12} /> Εμφάνιση όλων
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
