import { useEffect, useState } from 'react'
import api from '../api'
import Schools from './Schools'
import PromotionModal from '../components/PromotionModal'
import ResetDataModal from '../components/ResetDataModal'
import { UserCog, Save, School, CalendarRange, GraduationCap, DatabaseBackup, FolderOpen, Play, FileText, FilePlus2, Trash2, AlertTriangle, Mail, RefreshCw, KeyRound, Search, HelpCircle } from 'lucide-react'

// Βαθμίδες με σταθερό κλειδί `type` (ίδιο με το backend) και ετικέτα εμφάνισης.
const BAND_DEFS = [
  { type: 'Νηπιαγωγείο', label: 'Νηπιαγωγείο' },
  { type: 'Δημοτικό', label: 'Δημοτικό' },
  { type: 'Γυμνάσιο', label: 'Γυμνάσιο' },
  { type: 'Λύκειο/ΕΠΑΛ', label: 'Λύκειο / ΕΠΑΛ' },
]

// Default εύρη ετών γέννησης ανά βαθμίδα, από το έτος προνηπίου P (= έτος έναρξης − 4).
function defaultRowsFor(P) {
  P = Number(P)
  const spans = {
    'Νηπιαγωγείο': [P - 1, P],
    'Δημοτικό': [P - 7, P - 2],
    'Γυμνάσιο': [P - 10, P - 8],
    'Λύκειο/ΕΠΑΛ': [P - 13, P - 11],
  }
  return BAND_DEFS.map((b) => ({ ...b, from: spans[b.type][0], to: spans[b.type][1] }))
}

// Συγχώνευση των αποθηκευμένων ευρών (από το backend) με τις ετικέτες εμφάνισης.
function rowsFromRanges(ranges, P) {
  const defs = defaultRowsFor(P)
  if (!Array.isArray(ranges)) return defs
  return defs.map((d) => {
    const r = ranges.find((x) => x.type === d.type)
    return r ? { ...d, from: r.fromYear, to: r.toYear } : d
  })
}

function SchoolYearSection({ bump }) {
  const [nip, setNip] = useState(null) // έτος προνηπίου (Νηπιαγωγείο, μικρότερη ηλικία)
  const [label, setLabel] = useState('')
  const [rows, setRows] = useState([]) // [{ type, label, from, to }]
  const [saved, setSaved] = useState(false)
  const [showPromote, setShowPromote] = useState(false)

  function reload() {
    api.getSchoolYear().then((d) => {
      if (d) {
        setNip(d.nipYear)
        setLabel(d.schoolYearLabel)
        setRows(rowsFromRanges(d.ranges, d.nipYear))
      }
    })
  }

  useEffect(reload, [])

  // Αλλαγή Προνηπίου → επαναϋπολογισμός όλων των βαθμίδων.
  function onNipChange(v) {
    setNip(v)
    setSaved(false)
    const n = Number(v)
    if (v !== '' && Number.isFinite(n)) setRows(defaultRowsFor(n))
  }

  function setCell(idx, key, val) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [key]: val } : r)))
    setSaved(false)
  }

  async function save() {
    const ranges = rows.map((r) => ({ type: r.type, fromYear: Number(r.from), toYear: Number(r.to) }))
    const res = await api.setSchoolYear({ nipYear: Number(nip), ranges })
    if (res && res.ok) {
      setLabel(`${res.schoolYearStart}-${res.schoolYearStart + 1}`)
      if (Array.isArray(res.ranges)) setRows(rowsFromRanges(res.ranges, nip))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      bump && bump()
    }
  }

  if (nip == null) return null

  const yearInput =
    'w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-center'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <CalendarRange size={18} /> Έτη γέννησης ανά τύπο σχολείου
      </h3>
      <p className="mb-3 text-xs text-slate-400">
        Συμπλήρωσε το έτος γέννησης του <strong>Προνηπίου</strong> (μικρότερη ηλικία Νηπιαγωγείου)·
        οι υπόλοιπες βαθμίδες συμπληρώνονται αυτόματα. Μπορείς να <strong>επεξεργαστείς</strong> τις
        χρονολογίες κάθε βαθμίδας — η διαλογή του μαθητικού πληθυσμού γίνεται βάσει αυτών.
        Σχολικό έτος: <strong>{label}</strong>.
      </p>

      <div className="mb-3 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-sm text-slate-600">Έτος Προνηπίου (Νηπιαγωγείο)</label>
          <input
            type="number"
            value={nip}
            onChange={(e) => onNipChange(e.target.value)}
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
            {rows.map((row, idx) => {
              const span = Number(row.to) - Number(row.from) + 1
              return (
                <tr key={row.type} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">{row.label}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={row.from}
                        onChange={(e) => setCell(idx, 'from', e.target.value)}
                        className={yearInput}
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="number"
                        value={row.to}
                        onChange={(e) => setCell(idx, 'to', e.target.value)}
                        className={yearInput}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {Number.isFinite(span) && span > 0 ? `${span} έτη` : '—'}
                  </td>
                </tr>
              )
            })}
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

// Διαχείριση των θυμημένων τιμών των πεδίων «?» (σταθερά στοιχεία χρήστη, tokens {{?...}}).
// Αντλεί ετικέτες από τα πρότυπα + όσες έχουν ήδη αποθηκευμένη τιμή (κλειδιά settings `ask:*`).
function RememberedFieldsSection({ templates }) {
  const [values, setValues] = useState({}) // { label: value }
  const [saved, setSaved] = useState(false)

  function reload() {
    api.getSettings().then((s) => {
      const v = {}
      Object.keys(s || {}).forEach((k) => {
        if (k.startsWith('ask:')) v[k.slice(4)] = s[k]
      })
      setValues(v)
    })
  }
  useEffect(reload, [])

  const labels = [
    ...new Set([
      ...templates.flatMap((t) => (t.askFields || []).map((a) => a.label)),
      ...Object.keys(values),
    ]),
  ].sort((a, b) => a.localeCompare(b, 'el'))

  if (labels.length === 0) return null

  function set(label, val) {
    setValues((v) => ({ ...v, [label]: val }))
    setSaved(false)
  }
  async function save() {
    const obj = {}
    labels.forEach((l) => (obj['ask:' + l] = values[l] || ''))
    await api.setSettings(obj)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }
  async function clearOne(label) {
    await api.setSettings({ ['ask:' + label]: '' })
    set(label, '')
  }

  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
      <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <HelpCircle size={16} /> Αποθηκευμένα στοιχεία (πεδία «?»)
      </h4>
      <p className="mb-3 text-xs text-slate-500">
        Σταθερά στοιχεία που ζητούνται κατά την έκδοση (tokens {'{{?...}}'}) και θυμούνται. Μπορείς να τα
        προ-συμπληρώσεις ή να τα καθαρίσεις εδώ.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {labels.map((label) => (
          <div key={label}>
            <label className="mb-1 block text-xs text-slate-600">{label}</label>
            <div className="flex items-center gap-1">
              <input
                value={values[label] || ''}
                onChange={(e) => set(label, e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button
                onClick={() => clearOne(label)}
                title="Καθαρισμός"
                className="rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Save size={15} /> Αποθήκευση
        </button>
        {saved && <span className="text-sm text-green-600">Αποθηκεύτηκε ✓</span>}
      </div>
    </div>
  )
}

function TemplatesSection() {
  const [templates, setTemplates] = useState([])
  const [msg, setMsg] = useState(null) // { text, type }
  const [busy, setBusy] = useState(false)
  const [promptEnabled, setPromptEnabled] = useState(true) // ερώτηση έκδοσης μετά την εγγραφή

  function reload() {
    api.listTemplates().then((r) => setTemplates(Array.isArray(r) ? r : []))
  }
  useEffect(reload, [])

  useEffect(() => {
    api.getSettings().then((s) => setPromptEnabled(!s || s.enrollDocsPrompt !== '0'))
  }, [])

  async function togglePrompt(e) {
    const v = e.target.checked
    setPromptEnabled(v)
    await api.setSettings({ enrollDocsPrompt: v ? '1' : '0' })
  }

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

  async function openFolder() {
    setMsg(null)
    const res = await api.openTemplatesFolder()
    if (res && res.error) return setMsg({ text: res.error, type: 'error' })
    if (res && res.seeded) {
      setMsg({ text: `Αντιγράφηκαν ${res.seeded} ενσωματωμένα πρότυπα στον φάκελο για επεξεργασία.`, type: 'ok' })
    }
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
        Με το «Άνοιγμα φακέλου προτύπων» μπορείς να <strong>επεξεργαστείς</strong> απευθείας τα αρχεία
        (τα ενσωματωμένα αντιγράφονται εκεί για επεξεργασία· οι αλλαγές υπερισχύουν).
      </p>

      <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600">
        <input type="checkbox" checked={promptEnabled} onChange={togglePrompt} />
        Ερώτηση έκδοσης εγγράφων μετά την εγγραφή μαθητή/μαθητών
      </label>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={add}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <FilePlus2 size={16} /> {busy ? 'Γίνεται…' : 'Προσθήκη προτύπου'}
        </button>
        <button
          onClick={openFolder}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <FolderOpen size={16} /> Άνοιγμα φακέλου προτύπων
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
                              tok.startsWith('?')
                                ? 'bg-emerald-100 text-emerald-700'
                                : (t.unknownTokens || []).includes(tok)
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tok}
                          </span>
                        ))
                      )}
                    </div>
                    {(t.askFields || []).length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                        <HelpCircle size={12} /> Πεδία «?» — ζητιούνται κατά την έκδοση &amp; θυμούνται.
                      </p>
                    )}
                    {(t.unknownTokens || []).length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle size={12} /> Άγνωστα tokens — ζητιούνται ανά έγγραφο (κενά στη μαζική).
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

      <RememberedFieldsSection templates={templates} />
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

const MAIL_FREQ = [
  { value: 'off', label: 'Ανενεργό' },
  { value: '15m', label: 'Κάθε 15 λεπτά' },
  { value: '30m', label: 'Κάθε 30 λεπτά' },
  { value: '1h', label: 'Κάθε 1 ώρα' },
  { value: '2h', label: 'Κάθε 2 ώρες' },
  { value: '3h', label: 'Κάθε 3 ώρες' },
  { value: '24h', label: 'Κάθε 24 ώρες' },
]

// Πειραματικό: αυτόματη εισαγωγή λίστας πληθυσμού (ΣΕΠ) από το γραμματοκιβώτιο sch.gr.
function EmailImportSection({ emailCheck, onEmailConfigChange }) {
  const [host, setHost] = useState('mail.sch.gr')
  const [port, setPort] = useState('993')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [autoFreq, setAutoFreq] = useState('off')
  const [encAvailable, setEncAvailable] = useState(true)
  // Επεξεργάσιμα κριτήρια ταυτοποίησης του e-mail (≥2 πρέπει να είναι συμπληρωμένα).
  const [subjectMatch, setSubjectMatch] = useState('')
  const [senderMatch, setSenderMatch] = useState('')
  const [filenameMatch, setFilenameMatch] = useState('')
  const [searchDays, setSearchDays] = useState('50')
  const [msg, setMsg] = useState(null) // { text, type }
  const [busy, setBusy] = useState('') // '' | 'save' | 'test' | 'check' | 'clear'

  // Πλήθος συμπληρωμένων κριτηρίων — χρειάζονται ≥2 για ασφαλή ταυτοποίηση.
  const criteriaCount = [subjectMatch, senderMatch, filenameMatch].filter((v) => v.trim()).length

  function reload() {
    api.mailGetConfig().then((c) => {
      if (!c) return
      setHost(c.host || 'mail.sch.gr')
      setPort(String(c.port || 993))
      setUsername(c.username || '')
      setHasPassword(!!c.hasPassword)
      setAutoFreq(c.autoFreq || 'off')
      setEncAvailable(c.encAvailable !== false)
      setSubjectMatch(c.subjectMatch || '')
      setSenderMatch(c.senderMatch || '')
      setFilenameMatch(c.filenameMatch || '')
      setSearchDays(String(c.searchDays || 50))
      setPassword('')
    })
  }
  useEffect(reload, [])

  // Κοινό payload ρυθμίσεων (στοιχεία σύνδεσης + κριτήρια ταυτοποίησης).
  function configPayload() {
    return { host, port, username, password, autoFreq, subjectMatch, senderMatch, filenameMatch, searchDays }
  }

  async function save() {
    if (criteriaCount < 2)
      return setMsg({
        text: 'Συμπλήρωσε τουλάχιστον 2 κριτήρια ταυτοποίησης (Θέμα / Αποστολέας / Όνομα PDF).',
        type: 'error',
      })
    setBusy('save')
    setMsg(null)
    const res = await api.mailSetConfig(configPayload())
    setBusy('')
    if (res && res.error) return setMsg({ text: res.error, type: 'error' })
    setPassword('')
    setMsg({ text: 'Οι ρυθμίσεις e-mail αποθηκεύτηκαν.', type: 'ok' })
    reload()
    onEmailConfigChange && onEmailConfigChange()
  }

  async function test() {
    setBusy('test')
    setMsg(null)
    // Αποθήκευση πρώτα ώστε ο έλεγχος να χρησιμοποιεί τα τρέχοντα στοιχεία.
    await api.mailSetConfig(configPayload())
    setPassword('')
    const res = await api.mailTestConnection()
    setBusy('')
    reload()
    if (res && res.ok) setMsg({ text: 'Επιτυχής σύνδεση στο γραμματοκιβώτιο ✓', type: 'ok' })
    else setMsg({ text: (res && res.error) || 'Αποτυχία σύνδεσης.', type: 'error' })
  }

  async function checkNow() {
    if (criteriaCount < 2)
      return setMsg({
        text: 'Συμπλήρωσε τουλάχιστον 2 κριτήρια ταυτοποίησης πρώτα.',
        type: 'error',
      })
    setBusy('check')
    setMsg(null)
    await api.mailSetConfig(configPayload())
    setPassword('')
    reload()
    onEmailConfigChange && onEmailConfigChange()
    if (emailCheck) await emailCheck()
    setBusy('')
  }

  async function clearCreds() {
    if (!confirm('Σβήσιμο αποθηκευμένων συνθηματικών και απενεργοποίηση αυτόματης εισαγωγής;')) return
    setBusy('clear')
    setMsg(null)
    await api.mailClearCredentials()
    setBusy('')
    setMsg({ text: 'Τα συνθηματικά σβήστηκαν και η αυτόματη εισαγωγή απενεργοποιήθηκε.', type: 'ok' })
    reload()
    onEmailConfigChange && onEmailConfigChange()
  }

  const inputCls = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <Mail size={18} /> Αυτόματη εισαγωγή λίστας από e-mail (sch.gr)
      </h3>
      <p className="mb-3 text-xs text-slate-400">
        Ελέγχει το γραμματοκιβώτιο (IMAP) για το πιο πρόσφατο e-mail που ταιριάζει με τα{' '}
        <strong>κριτήρια ταυτοποίησης</strong> που ορίζεις πιο κάτω και προτείνει την εισαγωγή του
        συνημμένου PDF. Ο κωδικός αποθηκεύεται <strong>κρυπτογραφημένος</strong> τοπικά. Ο έλεγχος
        γίνεται στην εκκίνηση και με τη συχνότητα που ορίζεις.
      </p>

      {!encAvailable && (
        <p className="mb-3 flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
          <AlertTriangle size={13} /> Η κρυπτογράφηση κωδικού δεν είναι διαθέσιμη σε αυτό το σύστημα —
          η αποθήκευση κωδικού θα αποτύχει.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">Όνομα χρήστη (e-mail sch.gr)</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="π.χ. onoma@sch.gr" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">
            Κωδικός {hasPassword && <span className="text-xs text-green-600">(αποθηκευμένος — άφησέ το κενό για να μη γίνει αλλαγή)</span>}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={hasPassword ? '●●●●●●●● (αποθηκευμένος)' : 'Κωδικός λογαριασμού'}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Διακομιστής IMAP</label>
          <input value={host} onChange={(e) => setHost(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Θύρα (SSL/TLS)</label>
          <input value={port} onChange={(e) => setPort(e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">Συχνότητα αυτόματου ελέγχου</label>
          <select value={autoFreq} onChange={(e) => setAutoFreq(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {MAIL_FREQ.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <h4 className="mt-4 mb-1 text-sm font-semibold text-slate-700">Κριτήρια ταυτοποίησης του e-mail</h4>
      <div className="mb-3 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          Βάλε μόνο το <strong>σταθερό μέρος</strong> κάθε κριτηρίου. Π.χ. αν η λίστα έρχεται με θέμα
          «Λίστα πληθυσμού 15/09/2026», γράψε μόνο <strong>«Λίστα πληθυσμού»</strong>. Η αντιστοίχιση
          αγνοεί πεζά/κεφαλαία και τόνους. Συμπλήρωσε <strong>τουλάχιστον 2 από τα 3</strong> κριτήρια
          (Θέμα / Αποστολέας / Όνομα PDF) — το e-mail ταυτοποιείται όταν ταιριάξουν ≥ 2 από όσα όρισες.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">Θέμα e-mail (σταθερό μέρος)</label>
          <input value={subjectMatch} onChange={(e) => setSubjectMatch(e.target.value)} placeholder="π.χ. Λίστα πληθυσμού" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">Αποστολέας (e-mail ή όνομα)</label>
          <input value={senderMatch} onChange={(e) => setSenderMatch(e.target.value)} placeholder="π.χ. @sch.gr ή τμήμα@…" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">Όνομα αρχείου PDF (σταθερό μέρος)</label>
          <input value={filenameMatch} onChange={(e) => setFilenameMatch(e.target.value)} placeholder="π.χ. ΣΕΠ" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Αναζήτηση τελευταίων ημερών</label>
          <input type="number" min="1" value={searchDays} onChange={(e) => setSearchDays(e.target.value)} placeholder="50" className={inputCls} />
        </div>
        <div className="flex items-end">
          <p className={`text-xs ${criteriaCount < 2 ? 'text-red-600' : 'text-green-600'}`}>
            {criteriaCount < 2
              ? `Ορισμένα κριτήρια: ${criteriaCount}/3 — χρειάζονται τουλάχιστον 2.`
              : `Ορισμένα κριτήρια: ${criteriaCount}/3 ✓`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
          <Save size={16} /> {busy === 'save' ? 'Γίνεται…' : 'Αποθήκευση'}
        </button>
        <button onClick={test} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          <RefreshCw size={16} /> {busy === 'test' ? 'Έλεγχος…' : 'Έλεγχος σύνδεσης'}
        </button>
        <button onClick={checkNow} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          <Search size={16} /> {busy === 'check' ? 'Αναζήτηση…' : 'Έλεγχος για νέα λίστα τώρα'}
        </button>
        <button onClick={clearCreds} disabled={!!busy} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
          <KeyRound size={16} /> Σβήσιμο συνθηματικών
        </button>
      </div>

      {msg && (
        <p className={`mt-2 text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{msg.text}</p>
      )}
    </div>
  )
}

// Ενότητα ενημερώσεων (πειραματικό): τρέχουσα έκδοση, διακόπτης αυτόματου ελέγχου, «Έλεγχος τώρα».
function UpdateSection() {
  const [auto, setAuto] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.getSettings().then((s) => setAuto(!s || s.update_auto !== 'off'))
  }, [])

  async function toggleAuto(v) {
    setAuto(v)
    await api.setSettings({ update_auto: v ? 'on' : 'off' })
  }

  async function checkNow() {
    setMsg('Έλεγχος…')
    await api.updateCheck()
    setMsg('Έγινε έλεγχος. Αν υπάρχει σημαντική ενημέρωση θα εμφανιστεί ειδοποίηση.')
    setTimeout(() => setMsg(''), 6000)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
        <RefreshCw size={18} /> Ενημερώσεις
      </h3>
      <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} />
        Ειδοποίηση για σημαντικές ενημερώσεις
      </label>
      <div className="flex items-center gap-3">
        <button
          onClick={checkNow}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={16} /> Έλεγχος τώρα
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  )
}

export default function Settings({ version, bump, emailCheck, onEmailConfigChange }) {
  const [form, setForm] = useState({ sep: '', nomos: '', nomos_gen: '', domi: '', perif: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s)
        setForm({
          sep: s.sep || '',
          nomos: s.nomos || '',
          nomos_gen: s.nomos_gen || '',
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
          {field('nomos_gen', 'Νομός (γενική)', 'π.χ. Δράμας — για την παρένθεση επιτρόπου')}
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

      <div>
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <School size={18} /> Σχολεία ευθύνης
        </h3>
        <Schools version={version} bump={bump} />
      </div>

      <SchoolYearSection bump={bump} />

      <EmailImportSection emailCheck={emailCheck} onEmailConfigChange={onEmailConfigChange} />

      <BackupSection />

      <UpdateSection />

      <TemplatesSection />

      <ResetSection bump={bump} />
    </div>
  )
}
