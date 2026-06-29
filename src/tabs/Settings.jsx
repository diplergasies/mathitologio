import { useEffect, useState } from 'react'
import api from '../api'
import Schools from './Schools'
import PromotionModal from '../components/PromotionModal'
import ResetDataModal from '../components/ResetDataModal'
import { UserCog, Save, School, CalendarRange, GraduationCap, DatabaseBackup, FolderOpen, Play, FileText, FilePlus2, Trash2, AlertTriangle } from 'lucide-react'

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

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const FREQ_OPTIONS = [
  { value: 'off', label: 'Ανενεργό' },
  { value: 'daily', label: 'Καθημερινά' },
  { value: 'weekly', label: 'Εβδομαδιαία' },
  { value: 'monthly', label: 'Μηνιαία' },
]

function BackupSection() {
  const [freq, setFreq] = useState('off')
  const [folder, setFolder] = useState('')
  const [keep, setKeep] = useState('10')
  const [lastAt, setLastAt] = useState('')
  const [count, setCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState(null) // { text, type }
  const [busy, setBusy] = useState(false)

  function reload() {
    api.getSettings().then((s) => {
      if (!s) return
      setFreq(s.backupFrequency || 'off')
      setFolder(s.backupFolder || '')
      setKeep(s.backupKeep || '10')
      setLastAt(s.backupLastAt || '')
    })
    api.listBackups().then((list) => setCount(Array.isArray(list) ? list.length : 0))
  }
  useEffect(reload, [])

  async function chooseFolder() {
    const res = await api.chooseBackupFolder()
    if (res && res.path) {
      setFolder(res.path)
      await api.setSettings({ backupFolder: res.path })
      reload()
    }
  }

  async function save() {
    const k = String(Math.max(1, parseInt(keep, 10) || 10))
    setKeep(k)
    await api.setSettings({ backupFrequency: freq, backupKeep: k })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function backupNow() {
    setBusy(true)
    setMsg(null)
    const res = await api.backupNow()
    setBusy(false)
    if (res && res.ok) {
      setMsg({ text: 'Το αντίγραφο δημιουργήθηκε.', type: 'ok' })
      reload()
    } else {
      setMsg({ text: (res && res.error) || 'Αποτυχία δημιουργίας αντιγράφου.', type: 'error' })
    }
  }

  const needsFolder = freq !== 'off' && !folder

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <DatabaseBackup size={18} /> Αυτόματα αντίγραφα ασφαλείας
      </h3>
      <p className="mb-3 text-xs text-slate-400">
        Αντίγραφο όλων των δεδομένων αποθηκεύεται τοπικά στον φάκελο που θα ορίσεις, με τη συχνότητα
        που επιλέγεις. Ο έλεγχος γίνεται κάθε φορά που ανοίγει η εφαρμογή.
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-600">Συχνότητα</label>
          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {FREQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Κράτα τα τελευταία</label>
          <input
            type="number"
            min={1}
            value={keep}
            onChange={(e) => setKeep(e.target.value)}
            className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Save size={16} /> Αποθήκευση
        </button>
        {saved && <span className="pb-2 text-sm text-green-600">Αποθηκεύτηκε ✓</span>}
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-sm text-slate-600">Φάκελος αποθήκευσης</label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {folder || 'Δεν έχει οριστεί φάκελος'}
          </span>
          <button
            onClick={chooseFolder}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <FolderOpen size={16} /> Επιλογή φακέλου
          </button>
        </div>
        {needsFolder && (
          <p className="mt-1 text-sm text-amber-600">
            Διάλεξε φάκελο για να ενεργοποιηθούν τα αυτόματα αντίγραφα.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <button
          onClick={backupNow}
          disabled={busy || !folder}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          <Play size={16} /> {busy ? 'Γίνεται…' : 'Backup τώρα'}
        </button>
        <span className="text-xs text-slate-500">
          Τελευταίο: <strong>{fmtDateTime(lastAt)}</strong> · Αρχεία στον φάκελο: <strong>{count}</strong>
        </span>
        {msg && (
          <span className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  )
}

function TemplatesSection() {
  const [templates, setTemplates] = useState([])
  const [msg, setMsg] = useState(null) // { text, type }
  const [busy, setBusy] = useState(false)

  function reload() {
    api.listTemplates().then((r) => setTemplates(Array.isArray(r) ? r : []))
  }
  useEffect(reload, [])

  async function add() {
    setBusy(true)
    setMsg(null)
    const res = await api.addTemplate()
    setBusy(false)
    if (res && res.canceled) return
    if (res && res.ok) {
      const n = (res.added || []).length
      setMsg({ text: n ? `Προστέθηκαν ${n} πρότυπα.` : 'Δεν προστέθηκε κάτι.', type: 'ok' })
      reload()
    } else {
      setMsg({ text: (res && res.error) || 'Αποτυχία προσθήκης.', type: 'error' })
    }
  }

  async function remove(t) {
    if (!confirm(`Διαγραφή του προτύπου «${t.label}»;`)) return
    const res = await api.deleteTemplate(t.file)
    if (res && res.error) return setMsg({ text: res.error, type: 'error' })
    setMsg({ text: 'Το πρότυπο διαγράφηκε.', type: 'ok' })
    reload()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <FileText size={18} /> Πρότυπα εγγράφων
      </h3>
      <p className="mb-3 text-xs text-slate-400">
        Πρόσθεσε δικά σου πρότυπα <strong>.docx</strong> / <strong>.pptx</strong> με tokens της μορφής{' '}
        {'{{Όνομα}}'} (δες τη Βοήθεια για τη λίστα). Αποθηκεύονται τοπικά και διατηρούνται στις ενημερώσεις.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={add}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <FilePlus2 size={16} /> {busy ? 'Γίνεται…' : 'Προσθήκη προτύπου'}
        </button>
        {msg && (
          <span className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {msg.text}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-2 font-semibold">Πρότυπο</th>
              <th className="px-3 py-2 font-semibold">Tokens</th>
              <th className="px-3 py-2 text-right font-semibold">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                  Δεν υπάρχουν πρότυπα.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.file} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-700">{t.label}</div>
                    <span
                      className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                        t.builtin ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t.builtin ? 'Ενσωματωμένο' : 'Δικό μου'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(t.tokens || []).length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        t.tokens.map((tok) => (
                          <span
                            key={tok}
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              (t.unknownTokens || []).includes(tok)
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tok}
                          </span>
                        ))
                      )}
                    </div>
                    {(t.unknownTokens || []).length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle size={12} /> Άγνωστα tokens — δεν συμπληρώνονται.
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {t.builtin ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      <button
                        onClick={() => remove(t)}
                        title="Διαγραφή"
                        className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResetSection({ bump }) {
  const [show, setShow] = useState(false)
  const [done, setDone] = useState(false)

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/40 p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-red-700">
        <AlertTriangle size={18} /> Επικίνδυνη ζώνη — Reset δεδομένων
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        Διαγράφει <strong>όλους τους μαθητές</strong> από Αφίξεις, Μαθητές και Διαγραφές (και
        συνεπώς Παρατηρητήριο & Αποτύπωση). Διατηρεί σχολεία, ρυθμίσεις και πρότυπα. Μη αναστρέψιμο.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setDone(false)
            setShow(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <Trash2 size={16} /> Reset όλων των δεδομένων
        </button>
        {done && <span className="text-sm text-green-600">Όλα τα δεδομένα διαγράφηκαν ✓</span>}
      </div>

      {show && (
        <ResetDataModal
          onClose={() => setShow(false)}
          onDone={() => {
            setDone(true)
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

      <BackupSection />

      <TemplatesSection />

      <div>
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <School size={18} /> Σχολεία ευθύνης
        </h3>
        <Schools version={version} bump={bump} />
      </div>

      <ResetSection bump={bump} />
    </div>
  )
}
