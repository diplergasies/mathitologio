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

  // Για λίστες που ήρθαν μέσω e-mail: ένδειξη ώρας άφιξης (ημερομηνία + ώρα) — ώστε δύο ομώνυμες
  // λίστες της ίδιας ημέρας να ξεχωρίζουν από τη στιγμή που έφτασαν.
  let arrived = ''
  if (last.email_date) {
    const d = new Date(last.email_date)
    if (!isNaN(d))
      arrived = d.toLocaleString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500"
      title={arrived ? `Έφτασε στο e-mail: ${arrived}` : 'Η πιο πρόσφατη λίστα που εισήχθη'}
    >
      <FileSpreadsheet size={13} className="text-slate-400" />
      Τελευταία λίστα: <span className="font-medium text-slate-700">{last.source_filename}</span>
      {arrived ? (
        <span className="text-slate-400">· έφτασε {arrived}</span>
      ) : (
        when && <span className="text-slate-400">· {when}</span>
      )}
    </span>
  )
}
