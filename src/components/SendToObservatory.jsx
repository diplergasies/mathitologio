import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../api'
import { ClipboardList, Check } from 'lucide-react'
import { OBS_SECTIONS, periodOfDate, periodLabel } from '../lib/observatoryFields'

const MENU_WIDTH = 340
const MENU_MAX_HEIGHT = 360

// Εικονίδιο σε κάθε σημείωση ημερολογίου: ανοίγει λίστα με τα επεξεργάσιμα πεδία του
// Παρατηρητηρίου· η επιλογή αντιγράφει τίτλο + σημείωση στο πεδίο του 15νθημέρου της ημερομηνίας
// της σημείωσης. Το μενού ανοίγει σε portal (position: fixed) ώστε να μην κόβεται μέσα σε modal.
export default function SendToObservatory({ note, onSent }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [done, setDone] = useState(null) // μήνυμα επιβεβαίωσης δίπλα στο εικονίδιο
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (menuRef.current && menuRef.current.contains(e.target)) return
      if (btnRef.current && btnRef.current.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function close() {
    setOpen(false)
  }

  function toggle(e) {
    e.stopPropagation()
    if (open) return setOpen(false)
    const r = btnRef.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const top = below >= MENU_MAX_HEIGHT + 8 ? r.bottom + 4 : Math.max(8, r.top - MENU_MAX_HEIGHT - 4)
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
    setPos({ top, left })
    setOpen(true)
  }

  async function send(field) {
    setOpen(false)
    const res = await api.observatoryAppendNote({ field: field.key, date: note.date, title: note.title, note: note.note })
    const p = periodOfDate(note.date)
    if (res && res.ok) {
      setDone(res.already ? `Υπάρχει ήδη στο ${field.code}` : `Στάλθηκε στο ${field.code} (${periodLabel(p)})`)
      if (onSent && !res.already) onSent()
    } else {
      setDone((res && res.error) || 'Η αποστολή απέτυχε')
    }
    setTimeout(() => setDone(null), 4000)
  }

  const p = periodOfDate(note.date)

  return (
    <>
      {done && <span className="max-w-[14rem] truncate text-xs text-green-700" title={done}>{done}</span>}
      <button
        ref={btnRef}
        onClick={toggle}
        title="Αποστολή σε Παρατηρητήριο"
        className={`rounded p-1 hover:bg-slate-100 ${open ? 'text-blue-600' : done ? 'text-green-600' : 'text-slate-400 hover:text-blue-600'}`}
      >
        {done ? <Check size={14} /> : <ClipboardList size={14} />}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH, maxHeight: MENU_MAX_HEIGHT }}
            className="z-[60] overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
          >
            <div className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500">
              Αποστολή σε πεδίο Παρατηρητηρίου{p ? ` — ${periodLabel(p)}` : ''}
            </div>
            {OBS_SECTIONS.map((sec) => (
              <div key={sec.id} className="py-1">
                <div className="px-3 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {sec.title}
                </div>
                {sec.fields.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => send(f)}
                    className="flex w-full items-start gap-2 px-3 py-1 text-left hover:bg-blue-50"
                  >
                    <span className="w-10 shrink-0 font-medium text-slate-700">{f.code}</span>
                    <span className="line-clamp-2 text-slate-600">{f.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
