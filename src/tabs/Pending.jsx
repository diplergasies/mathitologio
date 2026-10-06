import { useEffect, useState } from 'react'
import api from '../api'
import RegistrationPackageModal from '../components/RegistrationPackageModal'
import { Inbox, PlaneLanding, School, Mail, FileText, ArrowRight } from 'lucide-react'

function studentLine(s) {
  const name = `${s.eponymo || ''} ${s.onoma || ''}`.trim() || '—'
  return `${name} (${s.dika || 'χωρίς ΔΙΚΑ'})`
}

export default function Pending({ version, bump, showToast, onOpenTab }) {
  const [data, setData] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [pkg, setPkg] = useState(null) // { actionId, students, index }

  function load() {
    api.pendingSummary().then((r) => setData(r || { arrivals: 0, noSchool: 0, actions: [], count: 0 }))
  }
  useEffect(load, [version])

  const actions = (data && data.actions) || []
  const arrivals = (data && data.arrivals) || 0
  const noSchool = (data && data.noSchool) || 0
  const empty = data && arrivals === 0 && noSchool === 0 && actions.length === 0

  async function send(action) {
    setBusyId(action.id)
    const res = await api.pendingSend(action.id)
    setBusyId(null)
    if (res && res.error) {
      if (showToast) showToast(res.error, 'error')
      load()
      return
    }
    if (showToast) showToast('Το e-mail στάλθηκε.')
    bump()
  }

  async function dismiss(id) {
    await api.pendingDismiss(id)
    bump()
  }

  async function startPackage(action) {
    const enrolled = (await api.listStudents('enrolled')) || []
    const byId = new Map(enrolled.map((s) => [s.id, s]))
    const students = action.students.map((s) => byId.get(s.id)).filter(Boolean)
    if (!students.length) {
      if (showToast) showToast('Δεν απομένουν εγγεγραμμένοι μαθητές για έγγραφα.', 'error')
      bump()
      return
    }
    setPkg({ actionId: action.id, students, index: 0 })
  }

  const current = pkg && pkg.students[pkg.index]

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
        <Inbox size={20} /> Εκκρεμότητες
      </h2>

      {!data ? (
        <p className="text-sm text-slate-400">Φόρτωση…</p>
      ) : empty ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Καμία εκκρεμότητα.</p>
      ) : null}

      {arrivals > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            <PlaneLanding size={16} className="text-blue-600" />
            {arrivals === 1 ? '1 μαθητής αναμένει εγγραφή στις Αφίξεις' : `${arrivals} μαθητές αναμένουν εγγραφή στις Αφίξεις`}
          </p>
          <button
            onClick={() => onOpenTab && onOpenTab('arrivals')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Μετάβαση στις Αφίξεις <ArrowRight size={14} />
          </button>
        </div>
      )}

      {noSchool > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            <School size={16} className="text-amber-600" />
            {noSchool === 1 ? '1 εγγεγραμμένος χωρίς σχολείο' : `${noSchool} εγγεγραμμένοι χωρίς σχολείο`}
          </p>
          <button
            onClick={() => onOpenTab && onOpenTab('students')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Μετάβαση στους Μαθητές <ArrowRight size={14} />
          </button>
        </div>
      )}

      {actions.map((a) =>
        a.kind === 'email_deletion' ? (
          <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-2 font-medium text-slate-800">
              <Mail size={16} className="text-blue-600" />
              Αποστολή e-mail διαγραφής{a.schoolName ? ` στο ${a.schoolName}` : ''}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              {(a.students || []).map((s) => (
                <li key={s.id}>{studentLine(s)}</li>
              ))}
            </ul>
            {a.cc ? <p className="mt-2 text-xs text-slate-400">Κοινοποίηση: {a.cc}</p> : null}
            {!a.schoolEmail && (
              <p className="mt-2 text-sm text-amber-700">
                {a.schoolId
                  ? 'Το σχολείο δεν έχει e-mail. Συμπλήρωσέ το στα σχολεία ευθύνης και ξαναπροσπάθησε.'
                  : 'Οι μαθητές δεν είχαν σχολείο, οπότε δεν υπάρχει παραλήπτης.'}
              </p>
            )}
            {a.lastError && <p className="mt-2 text-sm text-red-600">{a.lastError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => send(a)}
                disabled={busyId === a.id || !a.schoolEmail}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                <Mail size={14} /> {busyId === a.id ? 'Αποστολή…' : 'Αποστολή e-mail'}
              </button>
              <button
                onClick={() => dismiss(a.id)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Παράλειψη
              </button>
            </div>
          </div>
        ) : (
          <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-2 font-medium text-slate-800">
              <FileText size={16} className="text-blue-600" />
              Δημιουργία εγγράφων για τους παρακάτω μαθητές
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              {(a.students || []).map((s) => (
                <li key={s.id}>{studentLine(s)}</li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => startPackage(a)}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FileText size={14} /> Δημιουργία
              </button>
              <button
                onClick={() => dismiss(a.id)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Παράλειψη
              </button>
            </div>
          </div>
        )
      )}

      {current && (
        <RegistrationPackageModal
          key={current.id}
          student={current}
          onGenerated={async () => {
            await api.pendingPackageDone({ id: pkg.actionId, studentId: current.id })
          }}
          onClose={() => {
            if (pkg.index + 1 < pkg.students.length) setPkg({ ...pkg, index: pkg.index + 1 })
            else {
              setPkg(null)
              bump()
            }
          }}
        />
      )}
    </div>
  )
}
