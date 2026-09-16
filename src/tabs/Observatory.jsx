import { useEffect, useState } from 'react'
import api from '../api'
import CopyButton from '../components/CopyButton'
import { ClipboardList, Layers, School, Accessibility, UserMinus } from 'lucide-react'

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

  // Στο ΙΔΙΟ μπλοκ: οι διαγραφές της περιόδου — ΜΟΝΟ ανά σχολείο & σύνολο (χωρίς ονόματα/ΔΙΚΑ).
  const diagr = (n) => `${n} ${n === 1 ? 'διαγραφή' : 'διαγραφές'}`
  const bySchoolDel = new Map()
  for (const d of data.deleted || []) {
    const key = d.school || 'Χωρίς σχολείο'
    bySchoolDel.set(key, (bySchoolDel.get(key) || 0) + 1)
  }
  lines.push('')
  lines.push('Διαγραφές περιόδου:')
  ;[...bySchoolDel.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'el'))
    .forEach(([school, n]) => lines.push(`${school}: ${diagr(n)}`))
  lines.push(`Σύνολο: ${diagr(data.deletedTotal)}`)

  // Και στο τέλος το τελικό σύνολο (ενεργοί = εγγραφές − διαγραφές) + το σύνολο ΟΛΩΝ των
  // τρέχοντων εγγεγραμμένων (παλιοί & νέοι — τρέχουσα εικόνα, ανεξάρτητη από το 15νθήμερο).
  lines.push('')
  lines.push(`Τελικό σύνολο (ενεργοί): ${data.activeTotal}`)
  lines.push(`Σύνολο εγγεγραμμένων (παλιοί & νέοι): ${data.activeEnrolled}`)
  return lines.join('\n')
}

// Γ3 — λόγοι διακοπής φοίτησης, ομαδοποιημένοι με πλήθος (χωρίς προσωπικά στοιχεία).
// π.χ. «Αποχώρηση από την δομή (3 μαθητές) - Άτυπη φυγή (1 μαθητής)».
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

  useEffect(() => {
    api.observatoryStats({ year, month, half }).then(setData)
  }, [year, month, half, version])

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
    <div className="max-w-3xl space-y-5">
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
      </Section>
    </div>
  )
}
