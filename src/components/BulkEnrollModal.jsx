import { useEffect, useState } from 'react'
import Modal from './Modal'
import api from '../api'

export default function BulkEnrollModal({ ids, onClose, onDone }) {
  const [schools, setSchools] = useState([])
  const [mode, setMode] = useState('auto')
  const [schoolId, setSchoolId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.listSchools().then((r) => {
      setSchools(r || [])
      if (r && r.length) setSchoolId(r[0].id)
    })
  }, [])

  async function confirm() {
    setBusy(true)
    const res = await api.bulkEnroll(ids, mode, mode === 'school' ? schoolId : null)
    setBusy(false)
    setResult(res)
  }

  function close() {
    if (result) onDone(result)
    onClose()
  }

  const footer = result ? (
    <button
      onClick={close}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      Κλείσιμο
    </button>
  ) : (
    <>
      <button
        onClick={onClose}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Άκυρο
      </button>
      <button
        onClick={confirm}
        disabled={busy || (mode === 'school' && !schoolId)}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {busy ? 'Γίνεται…' : `Εγγραφή ${ids.length}`}
      </button>
    </>
  )

  return (
    <Modal title={`Μαζική εγγραφή (${ids.length} μαθητές)`} onClose={onClose} footer={footer}>
      {!result ? (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-sm">
            <input type="radio" checked={mode === 'auto'} onChange={() => setMode('auto')} className="mt-0.5" />
            <span>
              <strong>Αυτόματη ανάθεση</strong>
              <br />
              <span className="text-slate-500">
                Κάθε μαθητής εγγράφεται στο μοναδικό σχολείο του τύπου του (Νηπιαγωγείο/Δημοτικό…).
                Όσοι έχουν &gt;1 πιθανά σχολεία ή κανένα, παραλείπονται.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-sm">
            <input type="radio" checked={mode === 'school'} onChange={() => setMode('school')} className="mt-0.5" />
            <span className="w-full">
              <strong>Σε συγκεκριμένο σχολείο</strong>
              <br />
              <span className="text-slate-500">Εγγράφονται μόνο όσοι ταιριάζουν στον τύπο του.</span>
              {mode === 'school' && (
                <select
                  value={schoolId || ''}
                  onChange={(e) => setSchoolId(Number(e.target.value))}
                  className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {schools.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name} ({sc.type})
                    </option>
                  ))}
                </select>
              )}
            </span>
          </label>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="rounded-md bg-green-50 p-2 text-green-700">
            Εγγράφηκαν με σχολείο: <strong>{result.enrolled}</strong> μαθητές.
          </p>
          {result.needSchool > 0 && (
            <p className="rounded-md bg-blue-50 p-2 text-blue-700">
              Εγγράφηκαν χωρίς σχολείο (επιλογή από την καρτέλα Μαθητές):{' '}
              <strong>{result.needSchool}</strong>.
            </p>
          )}
          {result.skipped && result.skipped.length > 0 && (
            <div className="rounded-md bg-amber-50 p-2 text-amber-700">
              <p className="font-medium">Παραλείφθηκαν ({result.skipped.length}):</p>
              <ul className="mt-1 max-h-48 list-disc overflow-auto pl-5">
                {result.skipped.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
