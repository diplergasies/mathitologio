import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

// Επιφάνεια σχεδίασης υπογραφής με το ποντίκι (ή αφή). Το φόντο μένει transparent ώστε
// η εξαγόμενη εικόνα (PNG) να κάθεται πάνω στο έγγραφο σαν πραγματική υπογραφή.
// onChange({ dataUrl, wPx, hPx }) σε κάθε ολοκλήρωση γραμμής· onChange(null) στον καθαρισμό.
// Οι διαστάσεις wPx/hPx είναι το ΜΕΓΕΘΟΣ ΕΚΤΥΠΩΣΗΣ (px @96dpi) — μικρότερο από τον καμβά.
const CW = 340
const CH = 130
const PRINT_W = 170 // ~1.77in πλάτος στο έγγραφο (διατηρεί αναλογία με το PRINT_H)
const PRINT_H = Math.round((PRINT_W * CH) / CW)

export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
  }, [])

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: ((t.clientX - r.left) * CW) / r.width, y: ((t.clientY - r.top) * CH) / r.height }
  }

  function start(e) {
    e.preventDefault()
    drawing.current = true
    last.current = pos(e)
  }

  function move(e) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (!hasInk) setHasInk(true)
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    emit()
  }

  function emit() {
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onChange && onChange({ dataUrl, wPx: PRINT_W, hPx: PRINT_H })
  }

  function clear() {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, CW, CH)
    setHasInk(false)
    onChange && onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Υπογραφή (σχεδιάστε με το ποντίκι)</span>
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <Eraser size={13} /> Καθαρισμός
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="w-full touch-none rounded-md border border-dashed border-slate-300 bg-slate-50"
        style={{ aspectRatio: `${CW} / ${CH}` }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      {!hasInk && <p className="text-xs text-slate-400">Προαιρετικό — αν μείνει κενό, τυπώνεται το όνομα του υπογράφοντα.</p>}
    </div>
  )
}
