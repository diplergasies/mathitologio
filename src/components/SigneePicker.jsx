// Επιλογή υπογράφοντα για έγγραφα που έχουν token {{signee}}.
// value: { type:'father'|'mother'|'sep'|'guardian'|'self'|'other', name?, prop? }
export function signeeValid(choice) {
  if (!choice || !choice.type) return false
  if (choice.type === 'other')
    return !!(choice.name && choice.name.trim() && choice.prop && choice.prop.trim())
  if (choice.type === 'guardian') return !!(choice.name && choice.name.trim())
  return true
}

const LABELS = {
  father: 'Πατέρας',
  mother: 'Μητέρα',
  sep: 'ΣΕΠ',
  guardian: 'Επίτροπος',
  self: 'Ο ίδιος / Η ίδια',
  other: 'Άλλος',
}

// options: λίστα τύπων που εμφανίζονται (προεπιλογή: γονείς/ΣΕΠ/άλλο). allowOther: back-compat.
export default function SigneePicker({ value, onChange, allowOther = true, hints, options }) {
  const types = options || ['father', 'mother', 'sep', ...(allowOther ? ['other'] : [])]
  const choice = value || { type: types[0] }
  const set = (patch) => onChange({ ...choice, ...patch })

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Ποιος υπογράφει;</p>
      {types.map((t) => (
        <label
          key={t}
          className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
            choice.type === t ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
          }`}
        >
          <input type="radio" checked={choice.type === t} onChange={() => set({ type: t })} />
          <span>
            {LABELS[t] || t}
            {hints?.[t] ? <span className="ml-1 text-slate-400">({hints[t]})</span> : null}
          </span>
        </label>
      ))}

      {(choice.type === 'other' || choice.type === 'guardian') && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <input
            value={choice.name || ''}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ονοματεπώνυμο υπογράφοντα"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          {choice.type === 'other' && (
            <input
              value={choice.prop || ''}
              onChange={(e) => set({ prop: e.target.value })}
              placeholder="Ιδιότητα (π.χ. θείος, αδερφός, επίτροπος)"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          )}
        </div>
      )}
    </div>
  )
}
