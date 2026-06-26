import { useEffect, useState } from 'react'
import api from './api'
import Arrivals from './tabs/Arrivals'
import Students from './tabs/Students'
import Deletions from './tabs/Deletions'
import Settings from './tabs/Settings'
import Report from './tabs/Report'
import Observatory from './tabs/Observatory'
import HelpModal from './components/HelpModal'
import { Upload, Download, Database, PlaneLanding, Users, Trash2, Settings as SettingsIcon, BarChart3, ClipboardList, BookOpen, HelpCircle } from 'lucide-react'

const TABS = [
  { id: 'arrivals', label: 'Αφίξεις', icon: PlaneLanding, Comp: Arrivals },
  { id: 'students', label: 'Μαθητές', icon: Users, Comp: Students },
  { id: 'deletions', label: 'Διαγραφές', icon: Trash2, Comp: Deletions },
  { id: 'settings', label: 'Ρυθμίσεις', icon: SettingsIcon, Comp: Settings },
  { id: 'report', label: 'Αποτύπωση', icon: BarChart3, Comp: Report },
  { id: 'observatory', label: 'Παρατηρητήριο', icon: ClipboardList, Comp: Observatory },
]

export default function App() {
  const [tab, setTab] = useState('arrivals')
  const [version, setVersion] = useState(0)
  const [info, setInfo] = useState(null)
  const [toast, setToast] = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  const bump = () => setVersion((v) => v + 1)

  useEffect(() => {
    api.appInfo().then((i) => {
      setInfo(i)
      // Πρώτη εκκίνηση: άνοιγμα Ρυθμίσεων ώστε ο χρήστης να ορίσει στοιχεία & σχολεία.
      if (i && i.firstRun) setTab('settings')
    })
  }, [])

  // Ανανέωση πληροφοριών (π.χ. ετικέτα σχολικού έτους) μετά από αλλαγές (προβιβασμός κ.λπ.).
  useEffect(() => {
    api.appInfo().then(setInfo)
  }, [version])

  function showToast(text, type = 'ok') {
    setToast({ text, type })
    setTimeout(() => setToast(null), 6000)
  }

  async function doImport() {
    const res = await api.importXlsx()
    if (!res || res.canceled) return
    let msg = `Εισαγωγή: ${res.imported} μαθητές σχολικής ηλικίας προστέθηκαν στις Αφίξεις.`
    if (res.excluded) msg += ` ${res.excluded} εξαιρέθηκαν (εκτός σχολικής ηλικίας).`
    if (res.missingFields && res.missingFields.length)
      msg += ` Προσοχή: δεν εντοπίστηκαν στήλες: ${res.missingFields.join(', ')}.`
    showToast(msg, res.missingFields && res.missingFields.length ? 'warn' : 'ok')
    setTab('arrivals')
    bump()
  }

  async function doExport() {
    const res = await api.exportBackup()
    if (res && res.ok) showToast(`Αντίγραφο ασφαλείας αποθηκεύτηκε.`)
  }

  async function doImportBackup() {
    if (!confirm('Η επαναφορά θα αντικαταστήσει ΟΛΑ τα τρέχοντα δεδομένα. Συνέχεια;')) return
    const res = await api.importBackup()
    if (res && res.ok) {
      showToast('Τα δεδομένα επαναφέρθηκαν.')
      bump()
    }
  }

  const Active = TABS.find((t) => t.id === tab)?.Comp

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="text-blue-600" size={22} />
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-800">Μαθητολόγιο</h1>
            {info && (
              <p className="text-xs text-slate-400">
                Σχολικό έτος {info.schoolYearLabel} · έκδοση {info.version}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={doImport}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Upload size={16} /> Εισαγωγή XLSX
          </button>
          <button
            onClick={doExport}
            title="Εξαγωγή αντιγράφου ασφαλείας"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Download size={16} /> Backup
          </button>
          <button
            onClick={doImportBackup}
            title="Επαναφορά από αντίγραφο ασφαλείας"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Database size={16} /> Επαναφορά
          </button>
        </div>
      </header>

      <nav className="flex items-center gap-1 border-b border-slate-200 bg-white px-3">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.id === tab
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          )
        })}
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          <HelpCircle size={16} /> Βοήθεια
        </button>

        <div className="ml-auto pr-2 text-right text-xs leading-tight text-slate-400">
          Δημιουργήθηκε από τον Κατσιαντρίδη Χρήστο
          <br />
          e-mail:{' '}
          <a href="mailto:katsanx@sch.gr" className="text-slate-500 hover:text-blue-600">
            katsanx@sch.gr
          </a>
        </div>
      </nav>

      <main className="flex-1 overflow-auto p-5">{Active && <Active version={version} bump={bump} />}</main>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : toast.type === 'warn'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-800 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}
