import { batchColor } from '../colors'

// Γενικός πίνακας μαθητών με χρωματισμό ανά batch και προαιρετική επιλογή (checkboxes).
// columns: [{ key, label, render?(student) }]
// renderActions?(student) -> JSX για τη στήλη ενεργειών.
// selectable: εμφανίζει checkboxes. selectedIds: array. onToggle(id). onToggleAll(visibleIds, checked).
export default function StudentTable({
  students,
  columns,
  renderActions,
  emptyText,
  selectable,
  selectedIds = [],
  onToggle,
  onToggleAll,
}) {
  if (!students.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
        {emptyText || 'Δεν υπάρχουν εγγραφές.'}
      </div>
    )
  }

  const selected = new Set(selectedIds)
  const visibleIds = students.map((s) => s.id)
  const allChecked = visibleIds.every((id) => selected.has(id))

  return (
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
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                {c.label}
              </th>
            ))}
            {renderActions && <th className="px-3 py-2 text-right font-semibold">Ενέργειες</th>}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
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
                    {c.render ? c.render(s) : s[c.key] || '—'}
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
  )
}
