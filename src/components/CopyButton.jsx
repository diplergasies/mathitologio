import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

// Κουμπί αντιγραφής τιμής στο πρόχειρο (clipboard). Δουλεύει στο Electron renderer.
export default function CopyButton({ value, title = 'Αντιγραφή' }) {
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value ?? ''))
      setDone(true)
      setTimeout(() => setDone(false), 1200)
    } catch {
      // Σιωπηλή αποτυχία — αν δεν υπάρχει clipboard API, δεν κάνουμε τίποτα.
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
