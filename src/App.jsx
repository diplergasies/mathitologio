import { useEffect, useRef, useState } from 'react'
import api from './api'
import Arrivals from './tabs/Arrivals'
import Students from './tabs/Students'
import Deletions from './tabs/Deletions'
import Settings from './tabs/Settings'
import Report from './tabs/Report'
import Observatory from './tabs/Observatory'
import Calendar from './tabs/Calendar'
import Contact from './tabs/Contact'
import HelpModal from './components/HelpModal'
import DepartureDetectionModal from './components/DepartureDetectionModal'
import RoomChangesModal from './components/RoomChangesModal'
import EmailPromptModal from './components/EmailPromptModal'
import EmailBulkPromptModal from './components/EmailBulkPromptModal'
import AnnouncementModal from './components/AnnouncementModal'
import UpdateBanner from './components/UpdateBanner'
import { useConfirm } from './components/ConfirmProvider'
import { Upload, FileText, Download, Database, PlaneLanding, Users, Trash2, Settings as SettingsIcon, BarChart3, ClipboardList, CalendarDays, BookOpen, HelpCircle, MessageSquare } from 'lucide-react'

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
  { id: 'contact', label: 'Επικοινωνία', icon: MessageSquare, Comp: Contact },
]

export default function App() {
  const confirm = useConfirm()
  const [tab, setTab] = useState('students') // αρχική καρτέλα· μετά από εισαγωγή λίστας → Αφίξεις (reportImport)
  const [version, setVersion] = useState(0)
  const [info, setInfo] = useState(null)
  const [toast, setToast] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [departures, setDepartures] = useState(null)
  const [roomChanges, setRoomChanges] = useState(null)
  const [emailPrompt, setEmailPrompt] = useState(null) // { uid, filename, date, subject }
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailBulk, setEmailBulk] = useState(null) // [{ mailbox, uid, filename, subject, date }] — πρώτη χρήση
  const [emailTick, setEmailTick] = useState(0) // αλλαγές ρυθμίσεων e-mail → επαναρύθμιση poller
  const emailTimerRef = useRef(null)
  const handledUidRef = useRef(null) // uid που ήδη εισήχθη ή απορρίφθηκε (να μη ξαναρωτά)
  const calFailRef = useRef(0) // συνεχόμενες αποτυχίες αυτόματου ελέγχου κανόνων ημερολογίου
  const mailFailRef = useRef(0) // συνεχόμενες αποτυχίες αυτόματου ελέγχου νέας λίστας
  const emailRetryRef = useRef(null) // γρήγορη επανάληψη μετά από αποτυχία (αντί αναμονής όλου του διαστήματος)
  const [updateState, setUpdateState] = useState(null) // { state, importance, version, percent }
  const updateDismissedRef = useRef(null) // έκδοση που ο χρήστης απέκρυψε (να μη ξαναενοχλεί)
  const [announcement, setAnnouncement] = useState(null) // { id, message } — μήνυμα προς χρήστες

  const [settingsSub, setSettingsSub] = useState(null) // αρχικό υπο-tab Ρυθμίσεων (π.χ. 1η εκκίνηση)
  const bump = () => setVersion((v) => v + 1)

  useEffect(() => {
    api.appInfo().then((i) => {
      setInfo(i)
      // Πρώτη εκκίνηση: άνοιγμα Ρυθμίσεων ώστε ο χρήστης να ορίσει στοιχεία & σχολεία.
      if (i && i.firstRun) {
        setSettingsSub('sep')
        setTab('settings')
      }
    })
  }, [])

  // Μήνυμα προς τους χρήστες: best-effort έλεγχος στην έναρξη (δεν μπλοκάρει τίποτα).
  useEffect(() => {
    api.getAnnouncement().then((a) => {
      if (a && a.html) setAnnouncement(a)
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
    // Η απόκρυψη του banner ισχύει μόνο για την τρέχουσα συνεδρία (δεν αποθηκεύεται).
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
    if (res.roomChanges && res.roomChanges.length)
      msg += ` ${res.roomChanges.length} άλλαξαν δωμάτιο (Μονάδα) — ενημερώθηκαν αυτόματα.`
    if (res.missingFields && res.missingFields.length)
      msg += ` Προσοχή: δεν εντοπίστηκαν στήλες: ${res.missingFields.join(', ')}.`
    showToast(msg, res.missingFields && res.missingFields.length ? 'warn' : 'ok')
    setTab('arrivals')
    bump()
    // Αλλαγές δωματίου (Μονάδα): ταυτοποιήθηκαν βάσει ΔΙΚΑ & ενημερώθηκαν ήδη — ενημερωτικό pop-up.
    if (res.roomChanges && res.roomChanges.length) setRoomChanges(res.roomChanges)
    // Ανίχνευση αποχωρήσεων: μαθητές που υπάρχουν ήδη αλλά λείπουν από τη νέα λίστα.
    if (res.departed && res.departed.length) setDepartures(res.departed)
  }

  // ---- Αυτόματη εισαγωγή λίστας από e-mail (πειραματικό) --------------------
  const FREQ_MS = {
    '15m': 15 * 60000, '30m': 30 * 60000, '1h': 3600000,
    '2h': 2 * 3600000, '3h': 3 * 3600000, '24h': 24 * 3600000,
  }

  // Έλεγχος για νέα λίστα. manual=true → εμφανίζει και μηνύματα «δεν βρέθηκε/ήδη εισαχθεί».
  // Επιστρέφει false αν ο έλεγχος απέτυχε (σφάλμα σύνδεσης/διακομιστή), αλλιώς true.
  async function checkEmail({ manual } = {}) {
    const res = await api.mailCheck({ manual: !!manual })
    if (!res) return true
    if (res.error) {
      // Στον αυτόματο έλεγχο ειδοποίηση μία φορά, μετά από 3 συνεχόμενες αποτυχίες.
      mailFailRef.current += 1
      if (manual) showToast(res.error, 'error')
      else if (mailFailRef.current === 3)
        showToast(`Ο αυτόματος έλεγχος για νέα λίστα αποτυγχάνει επανειλημμένα: ${res.error}`, 'warn')
      return false
    }
    mailFailRef.current = 0
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
    // Πρώτη χρήση (άδεια βάση) με πολλές λίστες → επιλογή «όλες / μόνο η πιο πρόσφατη».
    if (res.bulk) {
      const last = res.lists[res.lists.length - 1]
      const bulkKey = `bulk:${res.lists.length}:${last.mailbox}:${last.uid}`
      if (!manual && handledUidRef.current === bulkKey) return
      setEmailBulk(res.lists)
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

  async function importAllFromEmail() {
    setEmailBusy(true)
    const res = await api.mailImportAll()
    setEmailBusy(false)
    setEmailBulk(null)
    if (res && res.bulk && !res.error) {
      reportImport(res)
      let msg = `Εισήχθησαν ${res.lists} λίστες με χρονολογική σειρά: ${res.imported} μαθητές σχολικής ηλικίας στις Αφίξεις.`
      if (res.failed && res.failed.length) msg += ` Απέτυχαν: ${res.failed.join(', ')}.`
      showToast(msg, res.failed && res.failed.length ? 'warn' : 'ok')
    } else reportImport(res)
  }

  async function importLatestFromEmail(item) {
    await importFromEmail(item)
    setEmailBulk(null)
  }

  function dismissEmailBulk() {
    if (emailBulk) {
      const last = emailBulk[emailBulk.length - 1]
      handledUidRef.current = `bulk:${emailBulk.length}:${last.mailbox}:${last.uid}`
    }
    setEmailBulk(null)
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
      if (res.added > 0) {
        showToast(`Προστέθηκαν ${res.added} σημειώσεις ημερολογίου από e-mail.`)
        bump()
      }
      // Στον αυτόματο έλεγχο ειδοποίηση μία φορά, μετά από 2 συνεχόμενες αποτυχίες.
      calFailRef.current += 1
      if (manual) showToast(res.error, 'error')
      else if (calFailRef.current === 2)
        showToast(`Ο έλεγχος e-mail για το Ημερολόγιο απέτυχε: ${res.error}`, 'warn')
      return
    }
    calFailRef.current = 0
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
    const clearTimers = () => {
      if (emailTimerRef.current) {
        clearInterval(emailTimerRef.current)
        emailTimerRef.current = null
      }
      if (emailRetryRef.current) {
        clearTimeout(emailRetryRef.current)
        emailRetryRef.current = null
      }
    }
    clearTimers()
    api.mailGetConfig().then((cfg) => {
      if (cancelled || !cfg) return
      const configured = cfg.username && cfg.hasPassword
      if (!configured || cfg.autoFreq === 'off') return
      // Παροδική αποτυχία (αργό δίκτυο, ο sch.gr απορρίπτει στιγμιαία τη σύνδεση): νέα προσπάθεια
      // σε 2' (έως 3 φορές) αντί να χαθεί όλος ο κύκλος — αλλιώς μια λίστα μπορεί να αργήσει 15'+.
      const RETRY_MS = 2 * 60000
      const MAX_RETRIES = 3
      // Σειριακά (όχι ταυτόχρονες συνδέσεις IMAP): πρώτα λίστα, μετά κανόνες ημερολογίου.
      const tick = async (attempt = 0) => {
        if (emailRetryRef.current) {
          clearTimeout(emailRetryRef.current)
          emailRetryRef.current = null
        }
        let ok = true
        try { ok = (await checkEmail({ manual: false })) !== false } catch { ok = false }
        if (attempt === 0) {
          try { await runCalendarRules({ manual: false }) } catch {}
        }
        if (!ok && !cancelled && attempt < MAX_RETRIES)
          emailRetryRef.current = setTimeout(() => tick(attempt + 1), RETRY_MS)
      }
      tick()
      const ms = FREQ_MS[cfg.autoFreq]
      if (ms) emailTimerRef.current = setInterval(() => tick(), ms)
    })
    return () => {
      cancelled = true
      clearTimers()
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
    if (
      !(await confirm({
        message: 'Η επαναφορά θα αντικαταστήσει ΟΛΑ τα τρέχοντα δεδομένα. Συνέχεια;',
        confirmLabel: 'Επαναφορά',
      }))
    )
      return
    const res = await api.importBackup()
    if (res && res.ok) {
      showToast('Τα δεδομένα επαναφέρθηκαν.')
      bump()
    }
  }

  const Active = TABS.find((t) => t.id === tab)?.Comp

  return (
    <div className="flex h-full flex-col">
      {updateState && updateState.state === 'silent-ready' && (
        <UpdateBanner state={updateState} onDismiss={dismissUpdate} />
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
            showToast={showToast}
            emailCheck={() => checkEmail({ manual: true })}
            onEmailConfigChange={() => setEmailTick((t) => t + 1)}
            initialSubTab={settingsSub}
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

      {emailBulk && (
        <EmailBulkPromptModal
          lists={emailBulk}
          busy={emailBusy}
          onImportAll={importAllFromEmail}
          onImportLatest={importLatestFromEmail}
          onClose={dismissEmailBulk}
        />
      )}

      {roomChanges && <RoomChangesModal changes={roomChanges} onClose={() => setRoomChanges(null)} />}

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

      {announcement && (
        <AnnouncementModal
          html={announcement.html}
          onClose={() => {
            // Το μήνυμα δεν ξαναεμφανίζεται σε αυτόν τον υπολογιστή (μέχρι να αλλάξει το κείμενο).
            api.setSettings({ announcement_seen_id: announcement.id })
            setAnnouncement(null)
          }}
        />
      )}
    </div>
  )
}
