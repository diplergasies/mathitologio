import { useEffect, useState } from 'react'
import api from '../api'
import CopyButton from '../components/CopyButton'
import { ClipboardList, Layers, School, Accessibility } from 'lucide-react'

const MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

// Επεξεργάσιμο πεδίο με κουμπί αντιγραφής.
function Field({ label, value, onChange, hint }) {
  return (
    <div className="flex items-center gap-3 border-t border-slate-100 px-3 py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
      />
      <CopyButton value={value} />
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
  const [vals, setVals] = useState({}) // επεξεργάσιμες τιμές πεδίων

  useEffect(() => {
    api.observatoryStats({ year, month, half }).then(setData)
  }, [year, month, half, version])

  // Αρχικοποίηση των επεξεργάσιμων τιμών από τα υπολογισμένα δεδομένα.
  useEffect(() => {
    if (!data) return
    const v = {
      total: data.total,
      'level:Πρωτοβάθμια': data.byLevel.find((l) => l.level === 'Πρωτοβάθμια')?.total ?? 0,
      'level:Δευτεροβάθμια': data.byLevel.find((l) => l.level === 'Δευτεροβάθμια')?.total ?? 0,
      dyep: data.dyep,
      withTY: data.withTY,
      withoutTY: data.withoutTY,
      eidiki: data.eidiki,
      asynodeftoi: data.asynodeftoi,
    }
    data.bySchool.forEach((s, i) => (v[`school:${i}`] = s.total))
    setVals(v)
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
        σύνολο <span className="font-medium text-slate-700">{data.total}</span>. Οι τιμές είναι
        επεξεργάσιμες πριν την αντιγραφή στη φόρμα του Παρατηρητηρίου.
      </p>

      {/* Α1 — ανά βαθμίδα */}
      <Section icon={Layers} title="Α1 — Εγγραφές ανά βαθμίδα">
        <Field label="Πρωτοβάθμια" value={vals['level:Πρωτοβάθμια']} onChange={set('level:Πρωτοβάθμια')} />
        <Field label="Δευτεροβάθμια" value={vals['level:Δευτεροβάθμια']} onChange={set('level:Δευτεροβάθμια')} />
        <Field label="Σύνολο" value={vals.total} onChange={set('total')} />
      </Section>

      {/* Α1 — ανά σχολείο */}
      <Section icon={School} title="Α1 — Εγγραφές ανά σχολείο">
        {data.bySchool.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-slate-400">Καμία εγγραφή σε αυτό το 15νθήμερο.</div>
        ) : (
          data.bySchool.map((s, i) => (
            <Field
              key={i}
              label={s.name}
              hint={s.type || undefined}
              value={vals[`school:${i}`]}
              onChange={set(`school:${i}`)}
            />
          ))
        )}
      </Section>

      {/* Α1.2–1.4 — τύπος προγράμματος */}
      <Section icon={School} title="Α1.2–1.4 — Τύπος προγράμματος">
        <Field label="Α1.2 — ΔΥΕΠ" value={vals.dyep} onChange={set('dyep')} />
        <Field label="Α1.3 — με Τμήμα Υποδοχής" value={vals.withTY} onChange={set('withTY')} />
        <Field label="Α1.4 — χωρίς Τμήμα Υποδοχής" value={vals.withoutTY} onChange={set('withoutTY')} />
      </Section>

      {/* Α1.5 & Α3.1 */}
      <Section icon={Accessibility} title="Α1.5 / Α3.1 — Ειδικές κατηγορίες">
        <Field label="Α1.5 — Ειδική αγωγή / αναπηρία" value={vals.eidiki} onChange={set('eidiki')} />
        <Field label="Α3.1 — Ασυνόδευτοι" value={vals.asynodeftoi} onChange={set('asynodeftoi')} />
      </Section>
    </div>
  )
}
