import { useEffect, useState } from 'react'
import api from '../api'
import Schools from './Schools'
import PromotionModal from '../components/PromotionModal'
import { UserCog, Save, School, CalendarRange, GraduationCap } from 'lucide-react'

// Ζωντανός υπολογισμός εύρους ετών ανά τύπο, από το έτος προνηπίου P.
function tableFor(P) {
  const r = (a, b) => ({ from: Math.min(a, b), to: Math.max(a, b) })
  return [
    { type: 'Νηπιαγωγείο', ...r(P - 1, P), years: 2 },
    { type: 'Δημοτικό', ...r(P - 7, P - 2), years: 6 },
    { type: 'Γυμνάσιο', ...r(P - 10, P - 8), years: 3 },
    { type: 'Λύκειο / ΕΠΑΛ', ...r(P - 13, P - 11), years: 3 },
  ]
}

function SchoolYearSection({ bump }) {
  const [nip, setNip] = useState(null) // έτος προνηπίου (Νηπιαγωγείο, μικρότερη ηλικία)
  const [label, setLabel] = useState('')
  const [saved, setSaved] = useState(false)
  const [showPromote, setShowPromote] = useState(false)

  function reload() {
    api.getSchoolYear().then((d) => {
      if (d) {
        setNip(d.nipYear)
        setLabel(d.schoolYearLabel)
      }
    })
  }

  useEffect(reload, [])

  async function save() {
    const res = await api.setSchoolYear(Number(nip))
    if (res && res.ok) {
      setLabel(`${res.schoolYearStart}-${res.schoolYearStart + 1}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      bump && bump()
    }
  }

  if (nip == null) return null
  const rows = tableFor(Number(nip))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <CalendarRange size={18} /> Έτη γέννησης ανά τύπο σχολείου
      </h3>
      <p className="mb-3 text-xs text-slate-400">
        Συμπλήρωσε το έτος γέννησης του <strong>Προνηπίου</strong> (μικρότερη ηλικία Νηπιαγωγείου).
        Οι υπόλοιπες βαθμίδες υπολογίζονται αυτόματα (Νηπ. 2, Δημ. 6, Γυμν. 3, Λύκ./ΕΠΑΛ 3 έτη).
        Σχολικό έτος: <strong>{label}</strong>.
      </p>

      <div className="mb-3 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-sm text-slate-600">Έτος Προνηπίου (Νηπιαγωγείο)</label>
          <input
            type="number"
            value={nip}
            onChange={(e) => setNip(e.target.value)}
            className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Save size={16} /> Εφαρμογή
        </button>
        {saved && <span className="pb-2 text-sm text-green-600">Αποθηκεύτηκε ✓</span>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-2 font-semibold">Τύπος σχολείου</th>
              <th className="px-3 py-2 font-semibold">Έτη γέννησης</th>
              <th className="px-3 py-2 font-semibold">Διάρκεια</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">{row.type}</td>
                <td className="px-3 py-2 text-slate-700">
                  {row.from} – {row.to}
                </td>
                <td className="px-3 py-2 text-slate-500">{row.years} έτη</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
        <button
          onClick={() => setShowPromote(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <GraduationCap size={16} /> Προβιβασμός / Νέο σχολικό έτος
        </button>
        <span className="text-xs text-slate-400">
          Προβιβάζει τους εγγεγραμμένους στην επόμενη τάξη και προχωρά το σχολικό έτος κατά 1.
        </span>
      </div>

      {showPromote && (
        <PromotionModal
          onClose={() => setShowPromote(false)}
          onDone={() => {
            reload()
            bump && bump()
          }}
        />
      )}
    </div>
  )
}

export default function Settings({ version, bump }) {
  const [form, setForm] = useState({ sep: '', nomos: '', domi: '', perif: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s)
        setForm({
          sep: s.sep || '',
          nomos: s.nomos || '',
          domi: s.domi || '',
          perif: s.perif || '',
        })
    })
  }, [version])

  function update(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setSaved(false)
  }

  async function save() {
    await api.setSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const field = (key, label, placeholder) => (
    <div>
      <label className="mb-1 block text-sm text-slate-600">{label}</label>
      <input
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
          <UserCog size={18} /> Στοιχεία ΣΕΠ
        </h3>
        <p className="mb-3 text-xs text-slate-400">
          Συντονιστής Εκπαίδευσης Προσφύγων — τα στοιχεία αυτά συμπληρώνονται αυτόματα στα έγγραφα
          (tokens {'{{ΣΕΠ}}, {{Νομός}}, {{Δομή}}, {{PERIF}}'}).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field('sep', 'Ονοματεπώνυμο ΣΕΠ', 'π.χ. Ιωάννης Παπαδόπουλος')}
          {field('nomos', 'Νομός', 'π.χ. Αττικής')}
          <div className="sm:col-span-2">
            {field('perif', 'Περιφερειακή Διεύθυνση Εκπαίδευσης', 'Ανατολικής Μακεδονίας & Θράκης')}
          </div>
          <div className="sm:col-span-2">{field('domi', 'Δομή φιλοξενίας', 'π.χ. ΚΥΤ / Δομή ...')}</div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Save size={16} /> Αποθήκευση
          </button>
          {saved && <span className="text-sm text-green-600">Αποθηκεύτηκε ✓</span>}
        </div>
      </div>

      <SchoolYearSection bump={bump} />

      <div>
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <School size={18} /> Σχολεία ευθύνης
        </h3>
        <Schools version={version} bump={bump} />
      </div>
    </div>
  )
}
