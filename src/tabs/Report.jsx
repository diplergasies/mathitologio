import { useEffect, useState } from 'react'
import api from '../api'
import { BarChart3, Layers, School } from 'lucide-react'

const MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

// Κύτταρο αριθμού (δεξιά στοίχιση, μηδέν με αχνό χρώμα).
function Num({ n }) {
  return <span className={n ? 'text-slate-700' : 'text-slate-300'}>{n}</span>
}

export default function Report({ version }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState(null)

  useEffect(() => {
    api.monthlyStats({ year, month }).then(setData)
  }, [year, month, version])

  if (!data) return null

  const t = data.totals
  const years = []
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) years.push(y)

  return (
    <div className="max-w-4xl space-y-6">
      {/* Επιλογή περιόδου */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Αποτύπωση μήνα</h3>
        </div>
        <div className="ml-auto flex items-end gap-2">
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
        </div>
      </div>

      {/* Σύνολα */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Σύνολο μαθητών', n: t.total, accent: 'text-blue-600' },
          { label: 'Άρρενες', n: t.male, accent: 'text-slate-700' },
          { label: 'Θήλεις', n: t.female, accent: 'text-slate-700' },
          { label: 'Λοιπά', n: t.other, accent: 'text-slate-500' },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className={`text-2xl font-bold ${c.accent}`}>{c.n}</div>
            <div className="text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Ανά βαθμίδα */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <Layers size={18} /> Μαθητές ανά βαθμίδα — {data.period}
        </h3>
        {data.byLevel.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-400">
            Καμία εγγραφή για αυτόν τον μήνα.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2 font-semibold">Βαθμίδα</th>
                  <th className="px-3 py-2 font-semibold">Τύπος</th>
                  <th className="px-3 py-2 text-right font-semibold">Άρρενες</th>
                  <th className="px-3 py-2 text-right font-semibold">Θήλεις</th>
                  <th className="px-3 py-2 text-right font-semibold">Σύνολο</th>
                </tr>
              </thead>
              <tbody>
                {data.byLevel.map((lv) => (
                  <FragmentLevel key={lv.level} lv={lv} />
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-700">
                  <td className="px-3 py-2" colSpan={2}>Γενικό σύνολο</td>
                  <td className="px-3 py-2 text-right">{t.male}</td>
                  <td className="px-3 py-2 text-right">{t.female}</td>
                  <td className="px-3 py-2 text-right">{t.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ανά σχολείο & φύλο */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <School size={18} /> Μαθητές ανά σχολείο & φύλο — {data.period}
        </h3>
        {data.bySchool.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-400">
            Κανένας εγγεγραμμένος μαθητής για αυτόν τον μήνα.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2 font-semibold">Σχολείο</th>
                  <th className="px-3 py-2 font-semibold">Τύπος</th>
                  <th className="px-3 py-2 text-right font-semibold">Άρρενες</th>
                  <th className="px-3 py-2 text-right font-semibold">Θήλεις</th>
                  <th className="px-3 py-2 text-right font-semibold">Σύνολο</th>
                </tr>
              </thead>
              <tbody>
                {data.bySchool.map((s, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{s.name}</td>
                    <td className="px-3 py-2 text-slate-500">{s.type || '—'}</td>
                    <td className="px-3 py-2 text-right"><Num n={s.male} /></td>
                    <td className="px-3 py-2 text-right"><Num n={s.female} /></td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Γραμμές μιας βαθμίδας: κεφαλίδα ομάδας + ανάλυση ανά κατηγορία.
function FragmentLevel({ lv }) {
  return (
    <>
      <tr className="border-t border-slate-200 bg-blue-50/40">
        <td className="px-3 py-2 font-semibold text-blue-700" rowSpan={lv.categories.length + 1}>
          {lv.level}
        </td>
        <td className="px-3 py-2 text-slate-600">{lv.categories[0].category}</td>
        <td className="px-3 py-2 text-right"><Num n={lv.categories[0].male} /></td>
        <td className="px-3 py-2 text-right"><Num n={lv.categories[0].female} /></td>
        <td className="px-3 py-2 text-right font-medium text-slate-700">{lv.categories[0].total}</td>
      </tr>
      {lv.categories.slice(1).map((c) => (
        <tr key={c.category} className="border-t border-slate-100">
          <td className="px-3 py-2 text-slate-600">{c.category}</td>
          <td className="px-3 py-2 text-right"><Num n={c.male} /></td>
          <td className="px-3 py-2 text-right"><Num n={c.female} /></td>
          <td className="px-3 py-2 text-right font-medium text-slate-700">{c.total}</td>
        </tr>
      ))}
      <tr className="border-t border-slate-200 bg-slate-50/60 text-slate-700">
        <td className="px-3 py-2 text-sm font-medium">Υποσύνολο {lv.level}</td>
        <td className="px-3 py-2 text-right text-sm font-medium">{lv.male}</td>
        <td className="px-3 py-2 text-right text-sm font-medium">{lv.female}</td>
        <td className="px-3 py-2 text-right text-sm font-semibold">{lv.total}</td>
      </tr>
    </>
  )
}
