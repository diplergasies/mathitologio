import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

// Εφεδρική αντιγραφή (αν το navigator.clipboard απορριφθεί): κρυφό textarea + execCommand.
function legacyCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}

// Κουμπί αντιγραφής τιμής στο πρόχειρο (clipboard). Δουλεύει στο Electron renderer.
export default function CopyButton({ value, title = 'Αντιγραφή' }) {
  const [done, setDone] = useState(false)

  async function copy() {
    const text = String(value ?? '')
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      ok = legacyCopy(text)
    }
    if (ok) {
      setDone(true)
      setTimeout(() => setDone(false), 1200)
    }
  }

  return (
    <button
      onClick={copy}
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
        done
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? 'Αντιγράφηκε' : 'Αντιγραφή'}
    </button>
  )
}
