import { useEffect, useRef, useState } from 'react'
import api from './api'
import Arrivals from './tabs/Arrivals'
import Students from './tabs/Students'
import Deletions from './tabs/Deletions'
import Settings from './tabs/Settings'
import Report from './tabs/Report'
import Observatory from './tabs/Observatory'
import Calendar from './tabs/Calendar'
import HelpModal from './components/HelpModal'
import DepartureDetectionModal from './components/DepartureDetectionModal'
import EmailPromptModal from './components/EmailPromptModal'
import UpdateBanner from './components/UpdateBanner'
import { Upload, FileText, Download, Database, PlaneLanding, Users, Trash2, Settings as SettingsIcon, BarChart3, ClipboardList, CalendarDays, BookOpen, HelpCircle } from 'lucide-react'

// Ορατή στον χρήστη έκδοση = μόνο major.minor (π.χ. «1.6»). Οι σιωπηλές ενημερώσεις αυξάνουν
// μόνο το 3ο ψηφίο, ώστε ο χρήστης να ΜΗ βλέπει αλλαγή· η πλήρης έκδοση μένει στις Ρυθμίσεις.
const shortVer = (v) => (v ? String(v).split('.').slice(0, 2).join('.') : '')

const TABS = [
  { id: 'arrivals', label: 'Αφίξεις', icon: PlaneLanding, Comp: Arrivals },
  { id: 'students', label: 'Μαθητές', icon: Users, Comp: Students },
  { id: 'deletions', label: 'Διαγραφές', icon: Trash2, Comp: Deletions },
  { id: 'calendar', label: 'Ημερολόγιο', icon: CalendarDays, Comp: Calendar },
  { id: 'settings', label: 'Ρυθμίσεις', icon: SettingsIcon, Comp: Settings },
  { id: 'report', label: 'Αποτύπωση', icon: BarChart3, Comp: Report },
  { id: 'observatory', label: 'Παρατηρητήριο', icon: ClipboardList, Comp: Observatory },
]

export default function App() {
  const [tab, setTab] = useState('students') // αρχική καρτέλα· μετά από εισαγωγή λίστας → Αφίξεις (reportImport)
  const [version, setVersion] = useState(0)
  const [info, setInfo] = useState(null)
  const [toast, setToast] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [departures, setDepartures] = useState(null)
  const [emailPrompt, setEmailPrompt] = useState(null) // { uid, filename, date, subject }
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailTick, setEmailTick] = useState(0) // αλλαγές ρυθμίσεων e-mail → επαναρύθμιση poller
  const emailTimerRef = useRef(null)
  const handledUidRef = useRef(null) // uid που ήδη εισήχθη ή απορρίφθηκε (να μη ξαναρωτά)
  const [updateState, setUpdateState] = useState(null) // { state, importance, version, percent }
  const updateDismissedRef = useRef(null) // έκδοση που ο χρήστης απέκρυψε (να μη ξαναενοχλεί)

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

  // ---- Αυτόματες ενημερώσεις ------------------------------------------------
  // Οι «σημαντικές» εμφανίζουν banner (Λήψη → Επανεκκίνηση). Οι σιωπηλές κατεβαίνουν αόρατα και,
  // μόλις είναι έτοιμες, στέλνουν 'silent-ready' → διακριτική ενημέρωση (θα εφαρμοστεί & θα
  // ανοίξει ξανά μόνη της στο κλείσιμο).
  function applyUpdate(st) {
    if (!st) return
    if (st.state === 'available' && st.version && st.version === updateDismissedRef.current) return
    setUpdateState(st)
  }
  useEffect(() => {
    // Η απόκρυψη του banner είναι πλέον ΜΟΝΟ για την τρέχουσα συνεδρία (δεν διαβάζουμε
    // αποθηκευμένη έκδοση): στο επόμενο άνοιγμα το startup check ξαναβρίσκει τη σημαντική
    // ενημέρωση και το banner επανεμφανίζεται μέχρι ο χρήστης να πατήσει «Λήψη».
    api.updateGetState().then((st) => {
      if (st && st.state !== 'idle') applyUpdate(st)
    })
    const unsub = api.onUpdateStatus(applyUpdate)
    return () => {
      if (typeof unsub === 'function') unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Απόκρυψη μόνο για την τρέχουσα συνεδρία (in-memory): εμποδίζει επανεμφάνιση από τον
  // περιοδικό έλεγχο εντός της ίδιας εκτέλεσης, αλλά χάνεται στην επανεκκίνηση.
  function dismissUpdate(v) {
    updateDismissedRef.current = v
    setUpdateState(null)
  }

  function showToast(text, type = 'ok') {
    setToast({ text, type })
    setTimeout(() => setToast(null), 6000)
  }

  function reportImport(res) {
    if (!res || res.canceled) return
    if (res.error) {
      showToast(res.error, 'warn')
      return
    }
    let msg = `Εισαγωγή: ${res.imported} μαθητές σχολικής ηλικίας προστέθηκαν στις Αφίξεις.`
    if (res.excluded) msg += ` ${res.excluded} εξαιρέθηκαν (εκτός σχολικής ηλικίας).`
    if (res.duplicates) msg += ` ${res.duplicates} παραλείφθηκαν ως διπλά (ίδιο ΔΙΚΑ).`
    if (res.missingFields && res.missingFields.length)
      msg += ` Προσοχή: δεν εντοπίστηκαν στήλες: ${res.missingFields.join(', ')}.`
    showToast(msg, res.missingFields && res.missingFields.length ? 'warn' : 'ok')
    setTab('arrivals')
    bump()
    // Ανίχνευση αποχωρήσεων: μαθητές που υπάρχουν ήδη αλλά λείπουν από τη νέα λίστα.
    if (res.departed && res.departed.length) setDepartures(res.departed)
  }

  // ---- Αυτόματη εισαγωγή λίστας από e-mail (πειραματικό) --------------------
  const FREQ_MS = {
    '15m': 15 * 60000, '30m': 30 * 60000, '1h': 3600000,
    '2h': 2 * 3600000, '3h': 3 * 3600000, '24h': 24 * 3600000,
  }

  // Έλεγχος για νέα λίστα. manual=true → εμφανίζει και μηνύματα «δεν βρέθηκε/ήδη εισαχθεί».
  async function checkEmail({ manual } = {}) {
    const res = await api.mailCheck()
    if (!res) return
    if (res.error) {
      if (manual) showToast(res.error, 'error')
      return
    }
    if (!res.configured) {
      if (manual) showToast('Δεν έχουν οριστεί στοιχεία e-mail στις Ρυθμίσεις.', 'warn')
      return
    }
    if (!res.found) {
      if (manual)
        showToast(
          res.noAttachment
            ? 'Βρέθηκε e-mail λίστας αλλά χωρίς συνημμένο PDF.'
            : 'Δεν βρέθηκε e-mail που να ταιριάζει με τα κριτήρια που όρισες.',
          'warn'
        )
      return
    }
    const msgKey = `${res.mailbox}:${res.uid}`
    if (res.alreadyImported) {
      handledUidRef.current = msgKey
      if (manual) showToast(`Η πιο πρόσφατη λίστα («${res.filename}») έχει ήδη εισαχθεί.`)
      return
    }
    // Νέα λίστα: στον αυτόματο έλεγχο ρωτάμε μία φορά ανά μήνυμα.
    if (!manual && handledUidRef.current === msgKey) return
    setEmailPrompt({ mailbox: res.mailbox, uid: res.uid, filename: res.filename, date: res.date, subject: res.subject })
  }

  async function importFromEmail(prompt) {
    setEmailBusy(true)
    const res = await api.mailImportMessage({ mailbox: prompt.mailbox, uid: prompt.uid })
    setEmailBusy(false)
    handledUidRef.current = `${prompt.mailbox}:${prompt.uid}`
    setEmailPrompt(null)
    reportImport(res)
  }

  function dismissEmailPrompt() {
    if (emailPrompt) handledUidRef.current = `${emailPrompt.mailbox}:${emailPrompt.uid}`
    setEmailPrompt(null)
  }

  // Κανόνες e-mail → Ημερολόγιο: εισάγει αυτόματα σημειώσεις από μηνύματα που ταιριάζουν.
  async function runCalendarRules({ manual } = {}) {
    const res = await api.mailRunCalendarRules()
    if (!res) return
    if (res.error) {
      if (manual) showToast(res.error, 'error')
      return
    }
    if (res.added > 0) {
      showToast(`Προστέθηκαν ${res.added} σημειώσεις ημερολογίου από e-mail.`)
      bump() // ανανέωση ανοιχτού Ημερολογίου
    } else if (manual) {
      showToast('Καμία νέα σημείωση από τους κανόνες e-mail.')
    }
  }

  // Poller: έλεγχος στην εκκίνηση + περιοδικά, βάσει ρυθμίσεων. Επαναρυθμίζεται όταν αλλάξουν
  // οι ρυθμίσεις e-mail (emailTick).
  useEffect(() => {
    let cancelled = false
    if (emailTimerRef.current) {
      clearInterval(emailTimerRef.current)
      emailTimerRef.current = null
    }
    api.mailGetConfig().then((cfg) => {
      if (cancelled || !cfg) return
      const configured = cfg.username && cfg.hasPassword
      if (!configured || cfg.autoFreq === 'off') return
      checkEmail({ manual: false })
      runCalendarRules({ manual: false })
      const ms = FREQ_MS[cfg.autoFreq]
      if (ms)
        emailTimerRef.current = setInterval(() => {
          checkEmail({ manual: false })
          runCalendarRules({ manual: false })
        }, ms)
    })
    return () => {
      cancelled = true
      if (emailTimerRef.current) {
        clearInterval(emailTimerRef.current)
        emailTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailTick])

  async function doImport() {
    reportImport(await api.importXlsx())
  }

  async function doImportPdf() {
    reportImport(await api.importPdf())
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
      {updateState && (updateState.importance === 'major' || updateState.state === 'silent-ready') && (
        <UpdateBanner
          state={updateState}
          onDownload={() => api.updateDownload()}
          onInstall={() => api.updateInstall()}
          onDismiss={dismissUpdate}
        />
      )}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="text-blue-600" size={22} />
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-800">Μαθητολόγιο ΣΕΠ</h1>
            {info && (
              <p className="text-xs text-slate-400">
                Σχολικό έτος {info.schoolYearLabel} · έκδοση {shortVer(info.version)}
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
            onClick={doImportPdf}
            title="Εισαγωγή λίστας από PDF (π.χ. ΣΕΠ)"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <FileText size={16} /> Εισαγωγή από PDF
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
      </nav>

      <main className="flex-1 overflow-auto p-5">
        {Active && (
          <Active
            version={version}
            bump={bump}
            emailCheck={() => checkEmail({ manual: true })}
            onEmailConfigChange={() => setEmailTick((t) => t + 1)}
          />
        )}
      </main>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {emailPrompt && (
        <EmailPromptModal
          prompt={emailPrompt}
          busy={emailBusy}
          onImport={importFromEmail}
          onClose={dismissEmailPrompt}
        />
      )}

      {departures && (
        <DepartureDetectionModal
          departed={departures}
          onClose={() => setDepartures(null)}
          onDone={bump}
        />
      )}

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
