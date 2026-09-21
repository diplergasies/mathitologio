import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Κοινό κλικαρόμενο dropdown για κελιά πίνακα (Τάξη/Σχολείο/Φύλο). Το μενού ανοίγει
// σε portal στο <body> με position:fixed, τοποθετημένο από το rect του κουμπιού, ώστε
// να ΜΗΝ κόβεται από το overflow-auto του πίνακα (π.χ. όταν υπάρχει μόνο ένας μαθητής).
// `children` είναι render-prop που δέχεται `close` για να κλείνει μετά την επιλογή.
export default function CellDropdown({ trigger, buttonClassName, menuWidth = 176, onOpen, children }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)

  function place() {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < 240 && r.top > spaceBelow
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - menuWidth - 8)),
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.max(openUp ? r.top : spaceBelow, 120) - 12,
    })
  }

  function toggle() {
    if (open) return setOpen(false)
    place()
    setOpen(true)
    if (onOpen) onOpen()
  }

  const close = () => setOpen(false)

  // Κλείσιμο σε scroll/resize: η θέση fixed θα «ξεκολλούσε» από το κελί, οπότε απλά κλείνουμε.
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className="relative inline-block">
      <button ref={btnRef} type="button" onClick={toggle} className={buttonClassName}>
        {trigger}
      </button>

      {open && pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={close} />
            <div
              className="fixed z-[61] overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
              style={{
                left: pos.left,
                top: pos.top,
                bottom: pos.bottom,
                width: menuWidth,
                maxHeight: pos.maxHeight,
              }}
            >
              {typeof children === 'function' ? children(close) : children}
            </div>
          </>,
          document.body
        )}
    </div>
  )
}
