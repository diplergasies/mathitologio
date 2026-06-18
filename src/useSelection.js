import { useState } from 'react'

// Απλό hook διαχείρισης επιλεγμένων γραμμών (ids).
export function useSelection() {
  const [ids, setIds] = useState([])

  const toggle = (id) =>
    setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const toggleAll = (visible, checked) =>
    setIds((s) => {
      const set = new Set(s)
      if (checked) visible.forEach((i) => set.add(i))
      else visible.forEach((i) => set.delete(i))
      return [...set]
    })

  const clear = () => setIds([])

  return { ids, toggle, toggleAll, clear }
}
