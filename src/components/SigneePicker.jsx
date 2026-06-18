// Επιλογή υπογράφοντα για έγγραφα που έχουν token {{signee}}.
// value: { type:'father'|'mother'|'sep'|'other', name?, prop? }
export function signeeValid(choice) {
  if (!choice || !choice.type) return false
  if (choice.type === 'other') return !!(choice.name && choice.name.trim() && choice.prop && choice.prop.trim())
  return true
}

export default function SigneePicker({ value, onChange, allowOther = true, hints }) {
  const choice = value || { type: 'father' }
  const set = (patch) => onChange({ ...choice, ...patch })

  const Option = ({ type, label, hint }) => (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
        choice.type === type ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
      }`}
    >
      <input type="radio" checked={choice.type === type} onChange={() => set({ type })} />
      <span>
        {label}
        {hint ? <span className="ml-1 text-slate-400">({hint})</span> : null}
      </span>
    </label>
  )

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Ποιος υπογράφει;</p>
      <Option type="father" label="Πατέρας" hint={hints?.father} />
      <Option type="mother" label="Μητέρα" hint={hints?.mother} />
      <Option type="sep" label="ΣΕΠ" hint={hints?.sep} />
      {allowOther && <Option type="other" label="Άλλο" />}

      {choice.type === 'other' && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <input
            value={choice.name || ''}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ονοματεπώνυμο υπογράφοντα"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            value={choice.prop || ''}
            onChange={(e) => set({ prop: e.target.value })}
            placeholder="Ιδιότητα (π.χ. αδερφός, επίτροπος)"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      )}
    </div>
  )
}
