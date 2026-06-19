import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from 'lucide-react'
import { batchColor } from '../colors'
import { fold, studentHaystack, matchSegments } from '../search'

// Γενικός πίνακας μαθητών με χρωματισμό ανά batch, ταξινόμηση, αναζήτηση & επιλογή (checkboxes).
// columns: [{ key, label, render?(student), sortable?, sortAccessor?(student) }]
//   sortable: η κεφαλίδα γίνεται κουμπί ταξινόμησης (κλικ: αύξουσα → φθίνουσα → καμία).
//   sortAccessor: τιμή ταξινόμησης (αλλιώς student[key]).
//   Στήλες χωρίς render χρωματίζουν αυτόματα το τμήμα που ταιριάζει με την αναζήτηση.
// searchable: εμφανίζει πεδίο εύρεσης (live, σε όλα τα στοιχεία του μαθητή).
// renderActions?(student) -> JSX για τη στήλη ενεργειών.
// selectable: εμφανίζει checkboxes. selectedIds: array. onToggle(id). onToggleAll(visibleIds, checked).
export default function StudentTable({
  students,
  columns,
  renderActions,
  emptyText,
  selectable,
  searchable,
  selectedIds = [],
  onToggle,
  onToggleAll,
}) {
  const [sort, setSort] = useState(null) // { key, dir: 'asc'|'desc' }
  const [q, setQ] = useState('')

  const term = q.trim()

  const processed = useMemo(() => {
    let list = students
    if (searchable && term) {
      const ft = fold(term)
      list = list.filter((s) => fold(studentHaystack(s)).includes(ft))
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col) {
        const acc = col.sortAccessor || ((s) => s[col.key])
        const dir = sort.dir === 'asc' ? 1 : -1
        list = [...list].sort((a, b) => {
          const va = acc(a)
          const vb = acc(b)
          const ea = va == null || va === ''
          const eb = vb == null || vb === ''
          if (ea && eb) return 0
          if (ea) return 1 // κενές τιμές πάντα στο τέλος
          if (eb) return -1
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
          return String(va).localeCompare(String(vb), 'el') * dir
        })
      }
    }
    return list
  }, [students, sort, columns, searchable, term])

  function clickSort(c) {
    if (!c.sortable) return
    setSort((prev) => {
      if (!prev || prev.key !== c.key) return { key: c.key, dir: 'asc' }
      if (prev.dir === 'asc') return { key: c.key, dir: 'desc' }
      return null // τρίτο κλικ: επαναφορά στην προεπιλεγμένη σειρά
    })
  }

  // Απόδοση κελιού: στήλες χωρίς render χρωματίζουν το τμήμα που ταιριάζει στην αναζήτηση.
  function cellContent(c, s) {
    if (c.render) return c.render(s)
    const val = s[c.key]
    if (val == null || val === '') return '—'
    if (!term) return val
    return matchSegments(String(val), term).map((seg, i) =>
      seg.hit ? (
        <mark key={i} className="rounded bg-amber-200 px-0.5 text-slate-900">
          {seg.text}
        </mark>
      ) : (
        <span key={i}>{seg.text}</span>
      )
    )
  }

  const searchBox = searchable ? (
    <div className="relative mb-3 max-w-sm">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Εύρεση μαθητή…"
        className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-8 text-sm focus:border-blue-400 focus:outline-none"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ('')}
          title="Καθαρισμός"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={15} />
        </button>
      )}
      {term && (
        <span className="ml-2 align-middle text-xs text-slate-500">{processed.length} αποτελέσματα</span>
      )}
    </div>
  ) : null

  if (!students.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
        {emptyText || 'Δεν υπάρχουν εγγραφές.'}
      </div>
    )
  }

  const selected = new Set(selectedIds)
  const visibleIds = processed.map((s) => s.id)
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))

  return (
    <div>
      {searchBox}

      {processed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
          Κανένας μαθητής δεν ταιριάζει με «{term}».
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                {selectable && (
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => onToggleAll(visibleIds, e.target.checked)}
                    />
                  </th>
                )}
                {columns.map((c) => {
                  const active = sort && sort.key === c.key
                  const Icon = !c.sortable
                    ? null
                    : active
                      ? sort.dir === 'asc'
                        ? ArrowUp
                        : ArrowDown
                      : ChevronsUpDown
                  return (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {c.sortable ? (
                        <button
                          type="button"
                          onClick={() => clickSort(c)}
                          title="Ταξινόμηση"
                          className={`-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-200/70 ${
                            active ? 'text-blue-600' : 'text-slate-600'
                          }`}
                        >
                          {c.label}
                          <Icon size={13} className={active ? '' : 'text-slate-400'} />
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  )
                })}
                {renderActions && <th className="px-3 py-2 text-right font-semibold">Ενέργειες</th>}
              </tr>
            </thead>
            <tbody>
              {processed.map((s) => {
                const color = batchColor(s.batch_color)
                const isSel = selected.has(s.id)
                return (
                  <tr
                    key={s.id}
                    className="border-t border-slate-100"
                    style={{ backgroundColor: isSel ? '#dbeafe' : color.bg }}
                  >
                    {selectable && (
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={isSel} onChange={() => onToggle(s.id)} />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2 text-slate-700" data-selectable>
                        {cellContent(c, s)}
                      </td>
                    ))}
                    {renderActions && (
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">{renderActions(s)}</div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
