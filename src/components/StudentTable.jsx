import { useMemo, useRef, useState } from 'react'
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
// onCellSave(id, key, value): αποθήκευση inline επεξεργασίας κελιού (για στήλες με editable: true).
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
  onCellSave,
}) {
  const [sort, setSort] = useState(null) // { key, dir: 'asc'|'desc' }
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // { id, key } του κελιού σε επεξεργασία
  const [draft, setDraft] = useState('')
  const cancelRef = useRef(false) // αποτρέπει αποθήκευση όταν το blur ακολουθεί Escape
  const [anchorId, setAnchorId] = useState(null) // άγκυρα για επιλογή εύρους με shift+κλικ

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

  function beginEdit(s, c) {
    // editAccessor: τιμή για το input όταν το αποθηκευμένο s[key] δεν είναι κατάλληλο για
    // επεξεργασία (π.χ. ISO ημερομηνία που εμφανίζεται μέσω render ως DD/MM/YYYY).
    const raw = c.editAccessor ? c.editAccessor(s) : s[c.key]
    setDraft(raw == null ? '' : String(raw))
    setEditing({ id: s.id, key: c.key })
  }

  async function commitEdit(s, c) {
    if (cancelRef.current) {
      cancelRef.current = false
      setEditing(null)
      return
    }
    const value = draft.trim()
    const origRaw = c.editAccessor ? c.editAccessor(s) : s[c.key]
    const orig = origRaw == null ? '' : String(origRaw).trim()
    setEditing(null)
    if (value !== orig && onCellSave) await onCellSave(s.id, c.key, value)
  }

  // Απόδοση κελιού: input σε επεξεργασία, αλλιώς (για editable στήλες) κλικαρόμενη τιμή.
  function renderCell(c, s) {
    const isEditing = c.editable && editing && editing.id === s.id && editing.key === c.key
    if (isEditing) {
      return (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitEdit(s, c)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancelRef.current = true
              e.currentTarget.blur()
            }
          }}
          className="w-full min-w-[6rem] rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm text-slate-800 focus:outline-none"
        />
      )
    }
    if (c.editable && onCellSave) {
      return (
        <button
          type="button"
          onClick={() => beginEdit(s, c)}
          title="Κλικ για επεξεργασία"
          className="w-full cursor-text rounded px-1 text-left hover:bg-blue-50/70 hover:ring-1 hover:ring-blue-200"
        >
          {cellContent(c, s)}
        </button>
      )
    }
    return cellContent(c, s)
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

  // Επιλογή γραμμής: με shift+κλικ επιλέγεται όλο το εύρος από την άγκυρα ως την τρέχουσα
  // γραμμή (κατά την ΕΜΦΑΝΙΖΟΜΕΝΗ σειρά· επαναχρησιμοποιεί το onToggleAll). Αλλιώς απλή εναλλαγή.
  const handleSelectClick = (id, e) => {
    if (e.shiftKey && anchorId != null) {
      const a = visibleIds.indexOf(anchorId)
      const b = visibleIds.indexOf(id)
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        onToggleAll(visibleIds.slice(lo, hi + 1), true)
        setAnchorId(id)
        return
      }
    }
    onToggle(id)
    setAnchorId(id)
  }

  return (
    <div>
      {searchBox}

      {processed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
          Κανένας μαθητής δεν ταιριάζει με «{term}».
        </div>
      ) : (
        // overflow-auto + φραγμένο ύψος: η οριζόντια μπάρα κύλισης μένει στο κάτω
        // μέρος του ορατού πλαισίου (όχι στο τέλος ενός ψηλού πίνακα), ώστε να είναι
        // πάντα προσβάσιμη όταν δεν φαίνονται όλες οι στήλες του μαθητή. Η κεφαλίδα
        // γίνεται sticky για να μη χάνεται κατά την κάθετη κύλιση μέσα στο πλαίσιο.
        <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50">
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
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => {}}
                          onClick={(e) => handleSelectClick(s.id, e)}
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2 text-slate-700" data-selectable>
                        {renderCell(c, s)}
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
