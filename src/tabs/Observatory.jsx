import { useEffect, useRef, useState } from 'react'
import api from '../api'
import CopyButton from '../components/CopyButton'
import { ClipboardList, Layers, School, Accessibility, UserMinus, Activity, UserRound, GraduationCap, Handshake, Building2, Users, BookOpen, Megaphone, MessageSquareText, Timer } from 'lucide-react'
import { OBS_SECTIONS, periodKey } from '../lib/observatoryFields'

// Εικονίδιο ανά ενότητα επεξεργάσιμων πεδίων.
const SECTION_ICONS = {
  A2: Activity, A3: UserRound, B: GraduationCap, D1: Handshake, D2: Building2,
  E: Users, ST: BookOpen, Z: Megaphone, TH: MessageSquareText,
}
const SAVE_DELAY_MS = 600

const MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

// Βαθμίδα από τον τύπο σχολείου (frontend grouping).
function levelOfType(t) {
  if (t === 'Νηπιαγωγείο' || t === 'Δημοτικό') return 'Πρωτοβάθμια'
  if (t === 'Γυμνάσιο' || t === 'Λύκειο' || t === 'ΕΠΑΛ') return 'Δευτεροβάθμια'
  return 'Άλλο'
}

// Σύνθετο κείμενο για το πεδίο Α1 (λίστα ανά βαθμίδα + σχολεία με πλήθος + σύνολο).
function buildA1Text(data) {
  const lines = []
  for (const lvName of ['Πρωτοβάθμια', 'Δευτεροβάθμια']) {
    const total = data.byLevel.find((l) => l.level === lvName)?.total ?? 0
    lines.push(`${lvName}: ${total}`)
    const schools = data.bySchool.filter((s) => levelOfType(s.type) === lvName)
    lines.push(
      `Σχολεία εγγραφής: ${
        schools.length ? schools.map((s) => `${s.name} (${s.total})`).join(', ') : '—'
      }`
    )
  }
  lines.push(`Σύνολο νέων εγγραφών: ${data.total}`)

  // Διαγραφές της περιόδου — μόνο εγγεγραμμένοι μαθητές (όχι αφίξεις), ανά βαθμίδα &
  // σχολείο, με την ίδια μορφή όπως οι εγγραφές (χωρίς ονόματα/ΔΙΚΑ).
  const diagr = (n) => `${n} ${n === 1 ? 'διαγραφή' : 'διαγραφές'}`
  lines.push('')
  lines.push('Διαγραφές περιόδου:')
  for (const lvName of ['Πρωτοβάθμια', 'Δευτεροβάθμια']) {
    const total = (data.delByLevel || []).find((l) => l.level === lvName)?.total ?? 0
    lines.push(`${lvName}: ${total}`)
    const schools = (data.delBySchool || []).filter((s) => levelOfType(s.type) === lvName)
    lines.push(
      `Σχολεία: ${schools.length ? schools.map((s) => `${s.name} (${s.total})`).join(', ') : '—'}`
    )
  }
  lines.push(`Σύνολο: ${diagr(data.deletedTotal || 0)}`)

  // Στο τέλος, το σύνολο ΟΛΩΝ των τρέχοντων εγγεγραμμένων (παλιοί & νέοι — τρέχουσα εικόνα,
  // ανεξάρτητη από το 15νθήμερο).
  lines.push('')
  lines.push(`Σύνολο εγγεγραμμένων (παλιοί & νέοι): ${data.activeEnrolled}`)
  return lines.join('\n')
}

// Γ3 — λόγοι διακοπής φοίτησης, ομαδοποιημένοι με πλήθος (χωρίς προσωπικά στοιχεία).
// π.χ. «Αποχώρηση από την δομή (3 μαθητές) - Άτυπη φυγή (1 μαθητής)».
// «12,5 ημέρες» — ακέραιος χωρίς δεκαδικό, αλλιώς ένα δεκαδικό.
function fmtDays(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 10) / 10
  const text = rounded.toLocaleString('el-GR', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })
  return `${text} ${rounded === 1 ? 'ημέρα' : 'ημέρες'}`
}

function buildAttendanceText(block, heading) {
  const schools = (block && block.bySchool) || []
  if (!schools.length) return 'Δεν υπάρχουν μαθητές με ημερομηνία εγγραφής.'
  const line = (name, row) =>
    `${name}: μέσος όρος ${fmtDays(row.meanDays)}, διάμεσος ${fmtDays(row.medianDays)}`
  const lines = [`${heading}`]
  for (const s of schools) lines.push(line(s.type ? `${s.name} (${s.type})` : s.name, s))
  if (block.overall && block.overall.count) lines.push(line('Σύνολο', block.overall))
  return lines.join('\n')
}

function AttendancePanel({ months, byPeriod }) {
  const [sel, setSel] = useState('all')
  const known = sel === 'all' || (months || []).some((m) => m.key === sel)
  const key = known ? sel : 'all'
  const block = (byPeriod && byPeriod[key]) || { bySchool: [], overall: null }
  const label = key === 'all' ? 'Συνολικά' : ((months || []).find((m) => m.key === key) || {}).label || key
  const schools = block.bySchool || []

  return (
    <Section icon={Timer} title="Χρόνος φοίτησης ανά σχολείο">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <select
          value={key}
          onChange={(e) => setSel(e.target.value)}
          aria-label="Μήνας χρόνου φοίτησης"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">Συνολικά</option>
          {(months || []).map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
        <CopyButton value={buildAttendanceText(block, label)} />
      </div>
      <p className="px-3 pt-2 text-xs text-slate-400">
        {key === 'all'
          ? 'Μέσος όρος και διάμεσος για όλους τους διαθέσιμους μήνες: από την εγγραφή έως τη διαγραφή, ή έως σήμερα για όσους είναι ακόμη εγγεγραμμένοι.'
          : `Μόνο οι ημέρες φοίτησης μέσα στον ${label}.`}
        {' '}Μαθητές που διαγράφηκαν από τις Αφίξεις χωρίς εγγραφή δεν μετράνε.
      </p>
      {schools.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-400">Δεν υπάρχουν μαθητές με ημερομηνία εγγραφής.</p>
      ) : (
        <div className="overflow-x-auto px-3 py-3">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">Σχολείο</th>
                <th className="py-1.5 pr-3 text-right font-medium">Μέσος όρος</th>
                <th className="py-1.5 text-right font-medium">Διάμεσος</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={`${s.type}:${s.name}`} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-700">
                    {s.name}
                    {s.type ? <span className="mt-0.5 block text-xs font-normal text-slate-400">{s.type}</span> : null}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">{fmtDays(s.meanDays)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-700">{fmtDays(s.medianDays)}</td>
                </tr>
              ))}
              {block.overall && block.overall.count > 0 && (
                <tr className="font-medium text-slate-800">
                  <td className="py-1.5 pr-3">Σύνολο</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmtDays(block.overall.meanDays)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtDays(block.overall.medianDays)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function buildDropoutText(data) {
  const reasons = data.dropoutReasons || []
  if (!reasons.length) return 'Λόγος διακοπής: —'
  const parts = reasons.map(
    (r) => `${r.reason} (${r.count} ${r.count === 1 ? 'μαθητής' : 'μαθητές'})`
  )
  return `Λόγος διακοπής: ${parts.join(' - ')}`
}

// Επεξεργάσιμο πεδίο με έτοιμο κείμενο + κουμπί αντιγραφής ολόκληρου του κειμένου.
function FieldText({ label, value, onChange, rows = 1 }) {
  return (
    <div className="border-t border-slate-100 px-3 py-2 first:border-t-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <CopyButton value={value} />
      </div>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full whitespace-pre rounded-md border border-slate-300 px-2 py-1 font-mono text-sm"
      />
    </div>
  )
}

// Επεξεργάσιμο πεδίο που ΑΠΟΘΗΚΕΥΕΤΑΙ (ανά 15νθήμερο). Μεγαλώνει με το περιεχόμενο.
function SavedField({ field, value, onChange }) {
  const lines = (value || '').split('\n').length
  return (
    <div className="border-t border-slate-100 px-3 py-2 first:border-t-0">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">
          {field.code} — {field.label}
        </span>
        <CopyButton value={value} />
      </div>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(Math.max(2, lines + 1), 14)}
        placeholder="Γράψτε εδώ ή στείλτε σημειώσεις από το Ημερολόγιο…"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
      />
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700">
        <Icon size={16} /> {title}
      </div>
      <div>{children}</div>
    </div>
  )
}

export default function Observatory({ version }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [half, setHalf] = useState(now.getDate() <= 15 ? 1 : 2)
  const [data, setData] = useState(null)
  const [vals, setVals] = useState({}) // επεξεργάσιμα κείμενα ανά πεδίο φόρμας
  const [saved, setSaved] = useState({}) // αποθηκευμένα κείμενα (μη υπολογιζόμενα πεδία) του 15νθημέρου
  const pending = useRef(new Map()) // `${period}|${field}` → { period, field, value, timer }
  const period = periodKey(year, month, half)

  useEffect(() => {
    api.observatoryStats({ year, month, half }).then(setData)
  }, [year, month, half, version])

  useEffect(() => {
    let cancelled = false
    api.observatoryGetValues(period).then((v) => {
      if (!cancelled) setSaved(v || {})
    })
    return () => {
      cancelled = true
    }
  }, [period, version])

  // Αποθήκευση με μικρή καθυστέρηση· το period «κλειδώνει» τη στιγμή της αλλαγής, ώστε αλλαγή
  // 15νθημέρου πριν την αποθήκευση να μη γράψει σε λάθος περίοδο.
  function flush(key) {
    const p = pending.current.get(key)
    if (!p) return
    clearTimeout(p.timer)
    pending.current.delete(key)
    api.observatorySetValue({ period: p.period, field: p.field, value: p.value })
  }

  function setSavedField(field) {
    return (value) => {
      setSaved((prev) => ({ ...prev, [field]: value }))
      const key = `${period}|${field}`
      const prev = pending.current.get(key)
      if (prev) clearTimeout(prev.timer)
      const timer = setTimeout(() => flush(key), SAVE_DELAY_MS)
      pending.current.set(key, { period, field, value, timer })
    }
  }

  // Κατά την έξοδο από την καρτέλα: αποθήκευση ό,τι εκκρεμεί.
  useEffect(() => {
    const map = pending.current
    return () => {
      for (const key of [...map.keys()]) flush(key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Αρχικοποίηση των επεξεργάσιμων κειμένων από τα υπολογισμένα δεδομένα.
  useEffect(() => {
    if (!data) return
    setVals({
      a1: buildA1Text(data),
      dyep: `ΔΥΕΠ: ${data.dyep}`,
      ty: `Με Τμήμα Υποδοχής: ${data.withTY}`,
      noty: `Χωρίς Τμήμα Υποδοχής: ${data.withoutTY}`,
      eidiki: `Ειδική αγωγή/αναπηρία: ${data.eidiki}`,
      asyn: `Ασυνόδευτοι: ${data.asynodeftoi}`,
      gamma1: `Μαθητές που διέκοψαν τη φοίτηση: ${data.dropoutTotal}`,
      gamma3: buildDropoutText(data),
    })
  }, [data])

  if (!data) return null

  const set = (key) => (val) => setVals((p) => ({ ...p, [key]: val }))
  const years = []
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) years.push(y)

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,48rem)_minmax(18rem,32rem)]">
    <div className="min-w-0 space-y-5">
      {/* Επιλογή περιόδου */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Παρατηρητήριο</h3>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Μήνας</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Έτος</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">15νθήμερο</label>
            <select
              value={half}
              onChange={(e) => setHalf(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value={1}>1ο (1–15)</option>
              <option value={2}>2ο (16–τέλος)</option>
            </select>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Νέες εγγραφές περιόδου <span className="font-medium text-slate-700">{data.period}</span> —
        σύνολο <span className="font-medium text-slate-700">{data.total}</span>. Κάθε πεδίο είναι
        επεξεργάσιμο· το κουμπί αντιγράφει ολόκληρο το κείμενο για επικόλληση στη φόρμα του Παρατηρητηρίου.
        Τα αριθμητικά πεδία υπολογίζονται αυτόματα· τα υπόλοιπα αποθηκεύονται για το επιλεγμένο
        15νθήμερο και δέχονται σημειώσεις από το Ημερολόγιο.
      </p>

      {/* Α1 — εγγραφές + διαγραφές + τελικό σύνολο (ένα ενιαίο μπλοκ) */}
      <Section icon={Layers} title="Α1 — Εγγραφές & Διαγραφές">
        <FieldText
          label="Α1 — Εγγραφές ανά βαθμίδα & σχολείο, διαγραφές περιόδου & τελικό σύνολο"
          value={vals.a1}
          onChange={set('a1')}
          rows={Math.min(9 + (data.deletedTotal || 0), 22)}
        />
      </Section>

      {/* Α1.2–1.4 — τύπος προγράμματος (τρέχουσα εικόνα: ενεργοί μαθητές) */}
      <Section icon={School} title={`Α1.2–1.4 — Τύπος προγράμματος (ενεργοί: ${data.activeEnrolled})`}>
        <p className="px-3 pt-2 text-xs text-slate-400">
          Τρέχουσα εικόνα — υπολογίζονται από τους ενεργούς (εγγεγραμμένους) μαθητές, ανεξάρτητα περιόδου.
        </p>
        <FieldText label="Α1.2 — ΔΥΕΠ" value={vals.dyep} onChange={set('dyep')} />
        <FieldText label="Α1.3 — με Τμήμα Υποδοχής" value={vals.ty} onChange={set('ty')} />
        <FieldText label="Α1.4 — χωρίς Τμήμα Υποδοχής" value={vals.noty} onChange={set('noty')} />
      </Section>

      {/* Α1.5 & Α3.1 (τρέχουσα εικόνα: ενεργοί μαθητές) */}
      <Section icon={Accessibility} title="Α1.5 / Α3.1 — Ειδικές κατηγορίες (ενεργοί)">
        <FieldText label="Α1.5 — Ειδική αγωγή / αναπηρία" value={vals.eidiki} onChange={set('eidiki')} />
        <FieldText label="Α3.1 — Ασυνόδευτοι" value={vals.asyn} onChange={set('asyn')} />
      </Section>

      {renderSection('A2')}
      {renderSection('A3')}
      {renderSection('B')}

      {/* Γ — Ζητήματα σχολικής διαρροής (διακοπές φοίτησης της περιόδου) */}
      <Section icon={UserMinus} title="Γ — Ζητήματα σχολικής διαρροής">
        <p className="px-3 pt-2 text-xs text-slate-400">
          Μαθητές που διέκοψαν τη φοίτηση μέσα στην περίοδο <span className="font-medium text-slate-500">{data.period}</span>
          {' '}(εξαιρούνται οι απόφοιτοι).
        </p>
        <FieldText label="Γ1 — Μαθητές που διέκοψαν τη φοίτηση" value={vals.gamma1} onChange={set('gamma1')} />
        <FieldText
          label="Γ3 — Λόγος διακοπής (χωρίς προσωπικά στοιχεία)"
          value={vals.gamma3}
          onChange={set('gamma3')}
          rows={Math.min(2 + (data.dropoutReasons?.length || 0), 8)}
        />
        {renderFields('G')}
      </Section>

      {['D1', 'D2', 'E', 'ST', 'Z', 'TH'].map((id) => renderSection(id))}
    </div>

    <aside className="sticky top-0 min-w-0 xl:max-h-[calc(100vh-7.5rem)] xl:overflow-auto">
      <AttendancePanel months={data.attendanceMonths} byPeriod={data.attendanceByPeriod} />
    </aside>
    </div>
  )

  function renderFields(id) {
    const sec = OBS_SECTIONS.find((s) => s.id === id)
    return sec.fields.map((f) => (
      <SavedField key={f.key} field={f} value={saved[f.key] || ''} onChange={setSavedField(f.key)} />
    ))
  }

  function renderSection(id) {
    const sec = OBS_SECTIONS.find((s) => s.id === id)
    return (
      <Section key={id} icon={SECTION_ICONS[id] || ClipboardList} title={sec.title}>
        {renderFields(id)}
      </Section>
    )
  }
}
