import { useEffect, useState } from 'react'
import api from '../api'
import { Plus, Trash2, School, Pencil, Check, X } from 'lucide-react'

const TYPES = ['Νηπιαγωγείο', 'Δημοτικό', 'Γυμνάσιο', 'Λύκειο', 'ΕΠΑΛ']

export default function Schools({ version, bump }) {
  const [schools, setSchools] = useState([])
  const [name, setName] = useState('')
  const [type, setType] = useState('Δημοτικό')
  const [error, setError] = useState(null)

  // Κατάσταση επεξεργασίας γραμμής
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')

  function load() {
    api.listSchools().then((r) => setSchools(r || []))
  }
  useEffect(load, [version])

  async function add() {
    setError(null)
    if (!name.trim()) return
    const res = await api.addSchool(name.trim(), type)
    if (res && res.error) return setError(res.error)
    setName('')
    bump()
  }

  function startEdit(s) {
    setEditId(s.id)
    setEditName(s.name)
    setEditType(s.type)
    setError(null)
  }

  async function saveEdit() {
    setError(null)
    if (!editName.trim()) return
    const res = await api.updateSchool(editId, editName.trim(), editType)
    if (res && res.error) return setError(res.error)
    setEditId(null)
    bump()
  }

  async function remove(s) {
    setError(null)
    if (!confirm(`Διαγραφή του σχολείου «${s.name}»;`)) return
    const res = await api.deleteSchool(s.id)
    if (res && res.error) return setError(res.error)
    bump()
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
          <School size={18} /> Προσθήκη σχολείου
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm text-slate-600">Όνομα</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="π.χ. 1ο Δημοτικό Σχολείο"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Τύπος</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={add}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} /> Προσθήκη
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-2 font-semibold">Όνομα</th>
              <th className="px-3 py-2 font-semibold">Τύπος</th>
              <th className="px-3 py-2 text-right font-semibold">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {schools.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                  Δεν υπάρχουν σχολεία.
                </td>
              </tr>
            ) : (
              schools.map((s) =>
                editId === s.id ? (
                  <tr key={s.id} className="border-t border-slate-100 bg-blue-50/40">
                    <td className="px-3 py-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={saveEdit}
                          title="Αποθήκευση"
                          className="rounded-md border border-green-200 p-1 text-green-700 hover:bg-green-50"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          title="Άκυρο"
                          className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700" data-selectable>
                      {s.name}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{s.type}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => startEdit(s)}
                          title="Επεξεργασία"
                          className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => remove(s)}
                          title="Διαγραφή"
                          className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
