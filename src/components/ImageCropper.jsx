import { useEffect, useRef, useState } from 'react'
import { Crop, Check, X } from 'lucide-react'

// Επιλογή 4 γωνιών πάνω στην εικόνα και perspective crop (σαν scanner): η επιλεγμένη
// τετράπλευρη περιοχή «ισιώνεται» σε ορθογώνιο, ώστε να μη φαίνονται δάχτυλα/γραφείο.
// props: { src (dataUrl), onCropped(dataUrl), onCancel() }

// Λύση 8x8 γραμμικού συστήματος (Gauss με μερική οδήγηση).
function solve8(A, b) {
  const n = 8
  const M = A.map((row, i) => row.concat(b[i]))
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    ;[M[col], M[piv]] = [M[piv], M[col]]
    const d = M[col][col] || 1e-9
    for (let c = col; c <= n; c++) M[col][c] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row) => row[n])
}

// Ομογραφία που απεικονίζει τα σημεία dst -> src (για inverse sampling).
function homography(dst, src) {
  const A = [], b = []
  for (let i = 0; i < 4; i++) {
    const { x: dx, y: dy } = dst[i]
    const { x: sx, y: sy } = src[i]
    A.push([dx, dy, 1, 0, 0, 0, -dx * sx, -dy * sx]); b.push(sx)
    A.push([0, 0, 0, dx, dy, 1, -dx * sy, -dy * sy]); b.push(sy)
  }
  return solve8(A, b) // [a,b,c,d,e,f,g,h]
}

export default function ImageCropper({ src, onCropped, onCancel }) {
  const imgRef = useRef(null)
  const dragging = useRef(-1)
  const [pts, setPts] = useState([
    { x: 0.08, y: 0.08 }, { x: 0.92, y: 0.08 }, { x: 0.92, y: 0.92 }, { x: 0.08, y: 0.92 },
  ]) // TL, TR, BR, BL (κλάσματα 0..1)
  const [size, setSize] = useState({ w: 0, h: 0 })

  function measure() {
    const el = imgRef.current
    if (el) setSize({ w: el.clientWidth, h: el.clientHeight })
  }
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    function move(e) {
      if (dragging.current < 0) return
      e.preventDefault()
      const el = imgRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const t = e.touches ? e.touches[0] : e
      let x = (t.clientX - r.left) / r.width
      let y = (t.clientY - r.top) / r.height
      x = Math.min(1, Math.max(0, x)); y = Math.min(1, Math.max(0, y))
      setPts((p) => p.map((q, i) => (i === dragging.current ? { x, y } : q)))
    }
    function up() { dragging.current = -1 }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
  }, [])

  function crop() {
    const img = imgRef.current
    const nW = img.naturalWidth, nH = img.naturalHeight
    const s = pts.map((p) => ({ x: p.x * nW, y: p.y * nH }))
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
    let outW = Math.round(Math.max(dist(s[0], s[1]), dist(s[3], s[2])))
    let outH = Math.round(Math.max(dist(s[0], s[3]), dist(s[1], s[2])))
    const cap = 1200
    const sc = Math.min(1, cap / Math.max(outW, outH, 1))
    outW = Math.max(1, Math.round(outW * sc)); outH = Math.max(1, Math.round(outH * sc))
    const dst = [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }]
    const H = homography(dst, s)

    const scv = document.createElement('canvas'); scv.width = nW; scv.height = nH
    const sctx = scv.getContext('2d'); sctx.drawImage(img, 0, 0, nW, nH)
    const sd = sctx.getImageData(0, 0, nW, nH).data
    const ocv = document.createElement('canvas'); ocv.width = outW; ocv.height = outH
    const octx = ocv.getContext('2d'); const out = octx.createImageData(outW, outH); const od = out.data
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const den = H[6] * x + H[7] * y + 1
        const sx = (H[0] * x + H[1] * y + H[2]) / den
        const sy = (H[3] * x + H[4] * y + H[5]) / den
        const o = (y * outW + x) * 4
        if (sx < 0 || sy < 0 || sx >= nW - 1 || sy >= nH - 1) { od[o] = od[o + 1] = od[o + 2] = 255; od[o + 3] = 255; continue }
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0
        const i00 = (y0 * nW + x0) * 4, i10 = i00 + 4, i01 = i00 + nW * 4, i11 = i01 + 4
        for (let c = 0; c < 3; c++) {
          od[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy
        }
        od[o + 3] = 255
      }
    }
    octx.putImageData(out, 0, 0)
    onCropped(ocv.toDataURL('image/jpeg', 0.92))
  }

  const down = (i) => (e) => { e.preventDefault(); dragging.current = i }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700">Επίλεξε τις 4 γωνίες της ταυτότητας</span>
      <div className="relative inline-block max-w-full">
        <img
          ref={imgRef}
          src={src}
          onLoad={measure}
          draggable={false}
          className="max-h-72 max-w-full select-none rounded-md border border-slate-200"
        />
        <svg className="pointer-events-none absolute left-0 top-0" width={size.w} height={size.h}>
          <polygon
            points={pts.map((p) => `${p.x * size.w},${p.y * size.h}`).join(' ')}
            fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="2"
          />
        </svg>
        {pts.map((p, i) => (
          <div
            key={i}
            onMouseDown={down(i)}
            onTouchStart={down(i)}
            className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-white bg-blue-600 shadow-md"
            style={{ left: p.x * size.w, top: p.y * size.h, touchAction: 'none' }}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400">Σύρε κάθε μπλε κουκκίδα στην αντίστοιχη γωνία. Η εικόνα θα «ισιώσει» στο ορθογώνιο.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={crop}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Crop size={15} /> Περικοπή
        </button>
        <button
          type="button"
          onClick={() => onCropped(src)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Check size={15} /> Χρήση ως έχει
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <X size={15} /> Ακύρωση
        </button>
      </div>
    </div>
  )
}
