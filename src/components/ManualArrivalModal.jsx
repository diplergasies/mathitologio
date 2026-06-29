import { useState } from 'react'
import Modal from './Modal'
import api from '../api'
import { UserPlus } from 'lucide-react'

// Φόρμα χειροκίνητης καταχώρησης μαθητή στις Αφίξεις.
// Ίδιοι κανόνες με την εισαγωγή: απαιτείται σχολική ηλικία & μοναδικό ΔΙΚΑ (σε ενεργούς).
const EMPTY = {
  eponymo: '',
  onoma: '',
  patronymo: '',
  mitronymo: '',
  monada: '',
  dika: '',
  fylo: '',
  glossa: '',
  ithageneia: '',
  imerominia_gennisis: '',
  imerominia_afixis: '',
  epitropos: 'Όχι',
}

export default function ManualArrivalModal({ onClose, onAdded }) {
  const [f, setF] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k, v) => {
    setF((s) => ({ ...s, [k]: v }))
    setError(null)
  }

  async function submit() {
    setError(null)
    if (!f.eponymo.trim() && !f.onoma.trim() && !f.dika.trim()) {
      return setError('Συμπλήρωσε τουλάχιστον Επώνυμο, Όνομα ή ΔΙΚΑ.')
    }
    if (!f.imerominia_gennisis) {
      return setError('Συμπλήρωσε ημερομηνία γέννησης (καθορίζει την τάξη).')
    }
    setBusy(true)
    const res = await api.addManualStudent(f)
    setBusy(false)
    if (res && res.error) return setError(res.error)
    if (res && res.ok) {
      onAdded && onAdded(res)
      onClose()
    }
  }

  const text = (key, label, opts = {}) => (
    <div className={opts.span2 ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-sm text-slate-600">
        {label} {opts.required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={opts.type || 'text'}
        value={f[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={opts.placeholder || ''}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
      />
    </div>
  )

  const footer = (
    <>
      <button
        onClick={onClose}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Άκυρο
      </button>
      <button
        onClick={submit}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        <UserPlus size={15} /> {busy ? 'Γίνεται…' : 'Προσθήκη'}
      </button>
    </>
  )

  return (
    <Modal title="Χειροκίνητη καταχώρηση μαθητή" onClose={onClose} footer={footer}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {text('eponymo', 'Επώνυμο', { required: true })}
        {text('onoma', 'Όνομα', { required: true })}
        {text('patronymo', 'Πατρώνυμο')}
        {text('mitronymo', 'Μητρώνυμο')}
        {text('monada', 'Μονάδα')}
        {text('dika', 'ΔΙΚΑ')}
        <div>
          <label className="mb-1 block text-sm text-slate-600">Φύλο</label>
          <select
            value={f.fylo}
            onChange={(e) => set('fylo', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="ΑΡΡΕΝ">Άρρεν</option>
            <option value="ΘΗΛΥ">Θήλυ</option>
          </select>
        </div>
        {text('glossa', 'Γλώσσα')}
        {text('ithageneia', 'Ιθαγένεια')}
        {text('imerominia_gennisis', 'Ημ. γέννησης', { type: 'date', required: true })}
        {text('imerominia_afixis', 'Ημ. άφιξης', { type: 'date', placeholder: 'σήμερα αν κενό' })}
        <div>
          <label className="mb-1 block text-sm text-slate-600">Επίτροπος</label>
          <select
            value={f.epitropos}
            onChange={(e) => set('epitropos', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="Όχι">Όχι</option>
            <option value="Ναι">Ναι</option>
          </select>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Η προτεινόμενη τάξη υπολογίζεται αυτόματα από την ημερομηνία γέννησης και το τρέχον σχολικό
        έτος. Αν ο μαθητής είναι εκτός σχολικής ηλικίας, δεν προστίθεται.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
