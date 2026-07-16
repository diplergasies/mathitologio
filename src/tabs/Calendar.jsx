import { useEffect, useMemo, useState } from 'react'
import api from '../api'
import Modal from '../components/Modal'
import {
  MONTHS, DOW_SHORT, DOW_FULL, toKey, keyToDMY, monthGrid, weekDays,
  addDays, addMonths, sameDay,
} from '../calendarUtils'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check, X, CalendarDays, Download } from 'lucide-react'
import { exportCalendarDocx } from '../calendarExport'

// Ρυθμίσεις εμφάνισης ανά είδος γεγονότος. Τα γεγονότα μαθητών (arrival/enrollment/deletion)
// έχουν `field`: την πραγματική στήλη που αλλάζει η επεξεργασία ημερομηνίας.
const KIND = {
  arrival: { label: 'Άφιξη', chip: 'bg-blue-100 text-blue-700 ring-blue-200', field: 'imerominia_afixis' },
  enrollment: { label: 'Εγγραφή', chip: 'bg-green-100 text-green-700 ring-green-200', field: 'enrolled_at' },
  deletion: { label: 'Διαγραφή', chip: 'bg-red-100 text-red-700 ring-red-200', field: 'deleted_at' },
  note: { label: 'Σημείωση', chip: 'bg-amber-100 text-amber-800 ring-amber-200' },
}

const VIEWS = [
  { id: 'month', label: 'Μήνας' },
  { id: 'week', label: 'Εβδομάδα' },
  { id: 'day', label: 'Ημέρα' },
]

// Είδη αυτόματων γεγονότων μαθητών (ομαδοποιούνται· οι σημειώσεις μένουν χωριστά).
const AUTO_KINDS = ['arrival', 'enrollment', 'deletion']

function pluralMathites(n) {
  return `${n} ${n === 1 ? 'μαθητής' : 'μαθητές'}`
}

// Διαχωρισμός των γεγονότων μιας ημέρας: σημειώσεις χωριστά, γεγονότα μαθητών ανά είδος.
function groupDay(events) {
  const notes = []
  const groups = {}
  for (const e of events) {
    if (e.kind === 'note') notes.push(e)
    else (groups[e.kind] = groups[e.kind] || []).push(e)
  }
  return { notes, groups }
}

// Συνοπτικά «chips» μιας ημέρας: μία σύνοψη ανά ομάδα μαθητών (π.χ. «Άφιξη 30») + οι σημειώσεις.
function daySummary(events) {
  const { notes, groups } = groupDay(events)
  const items = []
  for (const k of AUTO_KINDS) {
    if (groups[k]) items.push({ kind: k, label: `${KIND[k].label} ${groups[k].length}` })
  }
  for (const n of notes) items.push({ kind: 'note', label: n.title || 'Σημείωση' })
  return items
}

export default function Calendar({ version, bump }) {
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [events, setEvents] = useState([])
  const [panelKey, setPanelKey] = useState(null) // 'YYYY-MM-DD' → άνοιγμα πλαισίου ημέρας
  const [noteEdit, setNoteEdit] = useState(null) // { id?, date, title, note } για το modal σημείωσης
  const [exporting, setExporting] = useState(false)

  function reload() {
    api.calendarEvents().then((r) => setEvents(r || []))
  }
  useEffect(reload, [version])

  // Ομαδοποίηση γεγονότων ανά ημέρα (κλειδί 'YYYY-MM-DD').
  const byDay = useMemo(() => {
    const m = {}
    for (const e of events) (m[e.date] = m[e.date] || []).push(e)
    return m
  }, [events])

  const today = new Date()

  function shift(dir) {
    if (view === 'month') setCursor((c) => addMonths(c, dir))
    else if (view === 'week') setCursor((c) => addDays(c, dir * 7))
    else setCursor((c) => addDays(c, dir))
  }

  const title = useMemo(() => {
    if (view === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    if (view === 'week') {
      const w = weekDays(cursor)
      const a = w[0]
      const b = w[6]
      return `${a.getDate()}/${a.getMonth() + 1} – ${b.getDate()}/${b.getMonth() + 1}/${b.getFullYear()}`
    }
    const di = (cursor.getDay() + 6) % 7
    return `${DOW_FULL[di]}, ${keyToDMY(toKey(cursor))}`
  }, [view, cursor])

  // ---- Ενέργειες σημειώσεων / γεγονότων μαθητών ----------------------------
  async function saveNote(payload) {
    if (payload.id) await api.updateCalendarNote(payload)
    else await api.addCalendarNote(payload)
    setNoteEdit(null)
    reload()
    bump()
  }

  async function deleteNote(id) {
    if (!confirm('Διαγραφή σημείωσης;')) return
    await api.deleteCalendarNote(id)
    setNoteEdit(null)
    reload()
    bump()
  }

  // Αλλαγή ημερομηνίας αυτόματου γεγονότος → ενημέρωση της πραγματικής στήλης του μαθητή.
  async function saveAutoDate(ev, newKey) {
    await api.updateStudent(ev.studentId, { [KIND[ev.kind].field]: keyToDMY(newKey) })
    reload()
    bump()
  }

  // Εξαγωγή ολόκληρου του σχολικού έτους (1 Σεπ – 31 Αυγ) σε .docx.
  async function exportDocx() {
    setExporting(true)
    try {
      const info = await api.appInfo()
      const syStart = info && info.schoolYearStart ? Number(info.schoolYearStart) : new Date().getFullYear()
      const syLabel = (info && info.schoolYearLabel) || `${syStart}-${syStart + 1}`
      const res = await exportCalendarDocx({ syStart, syLabel })
      if (res && res.error) alert(res.error)
    } catch (err) {
      alert(`Αποτυχία εξαγωγής: ${err && err.message ? err.message : err}`)
    } finally {
      setExporting(false)
    }
  }

  const panelEvents = panelKey ? byDay[panelKey] || [] : []

  return (
    <div>
      {/* Γραμμή εργαλείων */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-3 py-1.5 text-sm font-medium ${
                view === v.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} title="Προηγούμενο" className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date())} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Σήμερα
          </button>
          <button onClick={() => shift(1)} title="Επόμενο" className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="text-base font-semibold text-slate-800">{title}</div>

        <button
          onClick={exportDocx}
          disabled={exporting}
          title="Εξαγωγή όλου του σχολικού έτους (1 Σεπ – 31 Αυγ) σε Word"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <Download size={15} /> {exporting ? 'Εξαγωγή…' : 'Εξαγωγή σε Word'}
        </button>
        <button
          onClick={() => setNoteEdit({ date: toKey(cursor), title: '', note: '' })}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
        >
          <Plus size={15} /> Νέα σημείωση
        </button>
      </div>

      {view === 'month' && (
        <MonthView cursor={cursor} today={today} byDay={byDay} onDayClick={setPanelKey} />
      )}
      {view === 'week' && (
        <WeekView cursor={cursor} today={today} byDay={byDay} onDayClick={setPanelKey} />
      )}
      {view === 'day' && (
        <DayView dayKey={toKey(cursor)} events={byDay[toKey(cursor)] || []} onOpen={() => setPanelKey(toKey(cursor))} />
      )}

      {panelKey && (
        <DayPanel
          dayKey={panelKey}
          events={panelEvents}
          onClose={() => setPanelKey(null)}
          onAddNote={() => setNoteEdit({ date: panelKey, title: '', note: '' })}
          onEditNote={(e) => setNoteEdit({ id: e.noteId, date: e.date, title: e.title, note: e.note || '' })}
          onSaveAutoDate={saveAutoDate}
        />
      )}

      {noteEdit && (
        <NoteModal
          initial={noteEdit}
          onSave={saveNote}
          onDelete={noteEdit.id ? () => deleteNote(noteEdit.id) : null}
          onClose={() => setNoteEdit(null)}
        />
      )}
    </div>
  )
}

// Χρωματιστό chip σύνοψης ημέρας (ομάδα μαθητών «Άφιξη 30» ή τίτλος σημείωσης).
function SummaryChip({ item }) {
  const k = KIND[item.kind]
  return (
    <div className={`truncate rounded px-1.5 py-0.5 text-xs ring-1 ${k.chip}`} title={item.label}>
      {item.label}
    </div>
  )
}

// Κόκκινη βούλα ένδειξης «υπάρχει γεγονός».
function RedDot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" title="Υπάρχουν γεγονότα" />
}

function MonthView({ cursor, today, byDay, onDayClick }) {
  const grid = monthGrid(cursor)
  const month = cursor.getMonth()
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
        {DOW_SHORT.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d, i) => {
          const key = toKey(d)
          const evs = byDay[key] || []
          const summary = daySummary(evs)
          const inMonth = d.getMonth() === month
          const isToday = sameDay(d, today)
          return (
            <button
              key={i}
              onClick={() => onDayClick(key)}
              className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 text-left align-top hover:bg-blue-50/50 ${
                inMonth ? 'bg-white' : 'bg-slate-50/60'
              }`}
            >
              <div className="mb-1 flex items-center gap-1">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? 'bg-blue-600 font-semibold text-white' : inMonth ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {d.getDate()}
                </span>
                {evs.length > 0 && <RedDot />}
              </div>
              <div className="space-y-0.5">
                {summary.slice(0, 3).map((it, j) => (
                  <SummaryChip key={j} item={it} />
                ))}
                {summary.length > 3 && (
                  <div className="px-1 text-xs text-slate-400">+{summary.length - 3} ακόμη</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ cursor, today, byDay, onDayClick }) {
  const days = weekDays(cursor)
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d, i) => {
        const key = toKey(d)
        const evs = byDay[key] || []
        const summary = daySummary(evs)
        const isToday = sameDay(d, today)
        return (
          <button
            key={i}
            onClick={() => onDayClick(key)}
            className="min-h-[220px] rounded-lg border border-slate-200 bg-white p-2 text-left hover:bg-blue-50/40"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{DOW_SHORT[i]}</span>
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? 'bg-blue-600 font-semibold text-white' : 'text-slate-700'
                }`}
              >
                {d.getDate()}
              </span>
            </div>
            <div className="space-y-1">
              {summary.length === 0 && <div className="text-xs text-slate-300">—</div>}
              {summary.map((it, j) => (
                <SummaryChip key={j} item={it} />
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function DayView({ dayKey, events, onOpen }) {
  const { notes, groups } = groupDay(events)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      {events.length === 0 ? (
        <div className="py-10 text-center text-slate-400">Κανένα γεγονός αυτή την ημέρα.</div>
      ) : (
        <ul className="space-y-2">
          {AUTO_KINDS.filter((k) => groups[k]).map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${KIND[k].chip}`}>{KIND[k].label}</span>
              <span className="text-sm text-slate-700">{pluralMathites(groups[k].length)}</span>
            </li>
          ))}
          {notes.map((e, i) => (
            <li key={`n${i}`} className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${KIND.note.chip}`}>{KIND.note.label}</span>
              <span className="text-sm text-slate-700">{e.title}</span>
              {e.note ? <span className="text-xs text-slate-400">— {e.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <button onClick={onOpen} className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
        <CalendarDays size={15} /> Άνοιγμα ημέρας για επεξεργασία
      </button>
    </div>
  )
}

// Πλαίσιο ημέρας: σημειώσεις (επεξεργάσιμες) + ομαδοποιημένα γεγονότα μαθητών με ανάπτυξη
// (drill-down σε ονόματα & ΔΙΚΑ, με δυνατότητα αλλαγής ημερομηνίας ανά μαθητή).
function DayPanel({ dayKey, events, onClose, onAddNote, onEditNote, onSaveAutoDate }) {
  const [editId, setEditId] = useState(null) // studentId+kind key του γεγονότος υπό επεξεργασία
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState({}) // kind -> αν είναι ανοιχτή η ομάδα

  const { notes, groups } = groupDay(events)

  function beginAuto(ev) {
    setEditId(`${ev.kind}:${ev.studentId}`)
    setDraft(ev.date)
  }
  async function commitAuto(ev) {
    setEditId(null)
    if (draft && draft !== ev.date) await onSaveAutoDate(ev, draft)
  }
  function toggleGroup(k) {
    setOpen((p) => ({ ...p, [k]: !p[k] }))
  }

  const footer = (
    <button onClick={onAddNote} className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600">
      <Plus size={15} /> Προσθήκη σημείωσης
    </button>
  )

  return (
    <Modal title={keyToDMY(dayKey)} onClose={onClose} footer={footer}>
      {events.length === 0 ? (
        <div className="py-6 text-center text-slate-400">Κανένα γεγονός. Πρόσθεσε μια σημείωση.</div>
      ) : (
        <ul className="space-y-2">
          {/* Ομάδες μαθητών (άφιξη/εγγραφή/διαγραφή) — αναπτυσσόμενες */}
          {AUTO_KINDS.filter((k) => groups[k]).map((k) => (
            <li key={k} className="overflow-hidden rounded-md border border-slate-100">
              <button
                onClick={() => toggleGroup(k)}
                className="flex w-full items-center gap-2 bg-slate-50 px-2 py-1.5 text-left hover:bg-slate-100"
              >
                {open[k] ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ring-1 ${KIND[k].chip}`}>{KIND[k].label}</span>
                <span className="text-sm font-medium text-slate-700">{pluralMathites(groups[k].length)}</span>
              </button>

              {open[k] && (
                <ul className="divide-y divide-slate-100">
                  {groups[k].map((e) => {
                    const isEditing = editId === `${e.kind}:${e.studentId}`
                    return (
                      <li key={e.studentId} className="flex items-center gap-2 px-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-slate-700">{e.title}</div>
                          <div className="truncate text-xs text-slate-400">
                            ΔΙΚΑ: {e.dika || '—'}{e.school ? ` · ${e.school}` : ''}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={draft}
                              onChange={(ev) => setDraft(ev.target.value)}
                              autoFocus
                              className="rounded border border-blue-400 px-1.5 py-0.5 text-sm"
                            />
                            <button onClick={() => commitAuto(e)} title="Αποθήκευση" className="rounded border border-green-200 p-1 text-green-700 hover:bg-green-50">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditId(null)} title="Άκυρο" className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => beginAuto(e)} title="Αλλαγή ημερομηνίας" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600">
                            <Pencil size={14} />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          ))}

          {/* Χειροκίνητες σημειώσεις — ατομικά (επεξεργασία/μετακίνηση/διαγραφή στο modal) */}
          {notes.map((e, i) => (
            <li key={`n${i}`} className="flex items-center gap-2 rounded-md border border-slate-100 px-2 py-1.5">
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ring-1 ${KIND.note.chip}`}>{KIND.note.label}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-700">{e.title}</div>
                {e.note ? <div className="truncate text-xs text-slate-400">{e.note}</div> : null}
              </div>
              <button onClick={() => onEditNote(e)} title="Επεξεργασία σημείωσης" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600">
                <Pencil size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

// Modal προσθήκης/επεξεργασίας χειροκίνητης σημείωσης.
function NoteModal({ initial, onSave, onDelete, onClose }) {
  const [date, setDate] = useState(initial.date || '')
  const [title, setTitle] = useState(initial.title || '')
  const [note, setNote] = useState(initial.note || '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!title.trim() || !date) return
    setBusy(true)
    await onSave({ id: initial.id, date, title: title.trim(), note: note.trim() })
    setBusy(false)
  }

  const footer = (
    <>
      {onDelete && (
        <button onClick={onDelete} className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
          <Trash2 size={15} /> Διαγραφή
        </button>
      )}
      <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
        Άκυρο
      </button>
      <button onClick={save} disabled={busy || !title.trim() || !date} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
        {busy ? 'Γίνεται…' : 'Αποθήκευση'}
      </button>
    </>
  )

  return (
    <Modal title={initial.id ? 'Επεξεργασία σημείωσης' : 'Νέα σημείωση'} onClose={onClose} footer={footer}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-slate-600">Ημερομηνία</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Τίτλος</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="π.χ. Συνάντηση γονέων" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Σημείωση (προαιρετικό)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
        </div>
      </div>
    </Modal>
  )
}
