import { useEffect, useState } from 'react'
import api from '../api'
import { FileSpreadsheet } from 'lucide-react'

// Μικρή ένδειξη με το όνομα της τελευταίας λίστας που εισήχθη (και πότε).
// Ανανεώνεται όποτε αλλάζει το `version` (π.χ. μετά από νέα εισαγωγή).
export default function LastImportBadge({ version }) {
  const [last, setLast] = useState(null)

  useEffect(() => {
    api.lastImport().then(setLast)
  }, [version])

  if (!last || !last.source_filename) return null

  let when = ''
  if (last.imported_at) {
    const d = new Date(last.imported_at)
    if (!isNaN(d)) when = d.toLocaleDateString('el-GR')
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500"
      title="Η πιο πρόσφατη λίστα που εισήχθη"
    >
      <FileSpreadsheet size={13} className="text-slate-400" />
      Τελευταία λίστα: <span className="font-medium text-slate-700">{last.source_filename}</span>
      {when && <span className="text-slate-400">· {when}</span>}
    </span>
  )
}
