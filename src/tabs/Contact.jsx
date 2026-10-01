import { useState } from 'react'
import api from '../api'
import { MessageSquare, Send, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

// Ίδια φόρμα με τη σελίδα /contact (Web3Forms): το μήνυμα φτάνει απευθείας στον δημιουργό.
// Τα τεχνικά στοιχεία του μηχανήματος προστίθενται αυτόματα από το main process.
const CATEGORIES = ['Πρόβλημα', 'Πρόταση', 'Ερώτηση']

export default function Contact() {
  const [category, setCategory] = useState('Πρόβλημα')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null) // { ok } | { error }

  async function send() {
    if (!message.trim()) {
      setStatus({ error: 'Γράψε πρώτα το μήνυμα.' })
      return
    }
    setBusy(true)
    setStatus(null)
    const res = await api.contactSend({ category, name, email, message })
    setBusy(false)
    if (res && res.ok) {
      setStatus({ ok: true })
      setMessage('')
    } else {
      setStatus({ error: (res && res.error) || 'Η αποστολή απέτυχε.' })
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
          <MessageSquare size={18} /> Επικοινωνία
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Στείλτε προτάσεις, σχόλια, ερωτήσεις ή προβλήματα που εντοπίσατε.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Κατηγορία</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Όνομα (προαιρετικό)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">E-mail (προαιρετικό)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="για να σας απαντήσω"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-sm text-slate-600">Μήνυμα</label>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              if (status) setStatus(null)
            }}
            rows={8}
            placeholder="Γράψτε εδώ την πρότασή σας, το σχόλιο ή το πρόβλημα που εντοπίσατε…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
          <Info size={14} className="mt-px shrink-0" />
          Μαζί με το μήνυμα στέλνονται αυτόματα τεχνικά στοιχεία του υπολογιστή (έκδοση εφαρμογής,
          Windows, μνήμη, δίσκος, οθόνη) για ευκολότερη διόρθωση προβλημάτων. Δεν στέλνεται κανένα
          στοιχείο μαθητών.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={send}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Send size={16} /> {busy ? 'Αποστολή…' : 'Αποστολή'}
          </button>
          {status && status.ok && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 size={16} /> Το μήνυμα στάλθηκε. Ευχαριστώ!
            </span>
          )}
          {status && status.error && (
            <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle size={16} /> {status.error}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
