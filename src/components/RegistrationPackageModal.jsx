import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import api from '../api'
import SigneePicker, { signeeValid } from './SigneePicker'
import SignaturePad from './SignaturePad'
import CameraCapture from './CameraCapture'
import { FolderCog, Loader2, FileText, AlertTriangle } from 'lucide-react'

// Ονόματα προτύπων ανά κατηγορία (ίδια με τα αρχεία στο resources/templates).
const T = {
  aitisi: 'Αίτηση εγγραφής.docx',
  aitisiEnilikon: 'Αίτηση εγγραφής ενηλίκων.docx',
  yd: 'ΥΔ-ΖΕΠ.docx',
  ydEnilikon: 'ΥΔ-ΖΕΠ ενηλίκων.docx',
  adym: 'ΑΔΥΜ.pptx',
}

const CATEGORIES = [
  { key: 'minor_family', label: 'Ανήλικος με οικογένεια (γονείς/συγγενής)', signer: 'family', docs: [T.aitisi, T.yd, T.adym] },
  { key: 'unaccompanied_no_guardian', label: 'Ασυνόδευτος ανήλικος', signer: 'unaccompanied', docs: [T.aitisi, T.yd, T.adym] },
  { key: 'adult', label: 'Ενήλικας (υπογράφει ο ίδιος)', signer: 'self', docs: [T.aitisiEnilikon, T.ydEnilikon, T.adym] },
]

// Αρχική επιλογή υπογράφοντα ανά κατηγορία.
function defaultChoice(signer) {
  if (signer === 'unaccompanied') return { type: 'sep' }
  return { type: 'father' } // family
}

function suggestCategory(s) {
  if (s.enilikas === 'Ναι') return 'adult'
  if (s.asynodeftos === 'Ναι') return 'unaccompanied_no_guardian'
  return 'minor_family'
}

export default function RegistrationPackageModal({ student, onClose }) {
  const [templates, setTemplates] = useState([])
  const [schools, setSchools] = useState([])
  const [settings, setSettings] = useState({})
  const [category, setCategory] = useState(suggestCategory(student))
  const [choice, setChoice] = useState(() => defaultChoice(CATEGORIES.find((c) => c.key === suggestCategory(student)).signer))
  const [signature, setSignature] = useState(null) // { dataUrl, wPx, hPx } | null
  const [identity, setIdentity] = useState(null) // ταυτοποιητικό μαθητή (dataUrl | null)
  const [identitySigner, setIdentitySigner] = useState(null) // ταυτοποιητικό υπογράφοντα (οικογένεια)
  const [extras, setExtras] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.listTemplates().then((t) => setTemplates(t || []))
    api.listSchools().then((s) => setSchools(s || []))
    api.getSettings().then((s) => setSettings(s || {}))
  }, [])

  const cat = CATEGORIES.find((c) => c.key === category)

  // Ανάλυση των προτύπων της κατηγορίας -> meta (ή null αν λείπει).
  const docMetas = useMemo(
    () => cat.docs.map((file) => ({ file, meta: templates.find((t) => t.file === file) || null })),
    [cat, templates]
  )
  const missing = docMetas.filter((d) => !d.meta).map((d) => d.file)
  const signeeDocs = docMetas.filter((d) => d.meta && d.meta.needsSignee)

  // Ελεύθερα πεδία (ask/unknown tokens) των εγγράφων που έχουν signee.
  const fields = useMemo(() => {
    const map = new Map()
    for (const d of signeeDocs) {
      ;(d.meta.askFields || []).forEach((a) => map.set(a.token, { token: a.token, label: a.label, value: a.value || '', useSchoolList: false }))
      ;(d.meta.unknownTokens || []).forEach((tok) => {
        if (!map.has(tok)) map.set(tok, { token: tok, label: tok, value: '', useSchoolList: true })
      })
    }
    return [...map.values()]
  }, [signeeDocs])

  // Seed θυμημένων τιμών στα ask-πεδία όταν αλλάζει το σύνολο πεδίων.
  useEffect(() => {
    setExtras((prev) => {
      const next = { ...prev }
      for (const f of fields) if (next[f.token] === undefined) next[f.token] = f.value
      return next
    })
  }, [fields])

  // Επαναφορά υπογράφοντα όταν αλλάζει η κατηγορία.
  useEffect(() => {
    setChoice(defaultChoice(cat.signer))
  }, [category]) // eslint-disable-line react-hooks/exhaustive-deps

  // Χτίσιμο του signer choice ανά κατηγορία.
  const builtChoice = useMemo(() => {
    if (cat.signer === 'family' || cat.signer === 'unaccompanied') return choice
    if (cat.signer === 'self') return { type: 'self' }
    return null
  }, [cat, choice])

  const hints = {
    father: `${student.patronymo || ''} ${student.eponymo || ''}`.trim(),
    mother: `${student.mitronymo || ''} ${student.eponymo || ''}`.trim(),
    sep: settings.sep || '',
  }

  const extrasValid = fields.every((f) => (extras[f.token] || '').trim())
  const signerValid = signeeDocs.length === 0 || signeeValid(builtChoice)
  const canGenerate = docMetas.some((d) => d.meta) && extrasValid && signerValid && !busy

  const folder = settings.package_dir || '(προεπιλογή: Έγγραφα ▸ Πακέτα εγγραφής)'

  async function changeFolder() {
    const r = await api.choosePackageFolder()
    if (r && r.path) {
      await api.setSettings({ package_dir: r.path })
      setSettings((p) => ({ ...p, package_dir: r.path }))
    }
  }

  async function generate() {
    setBusy(true)
    setResult(null)
    const docs = docMetas
      .filter((d) => d.meta)
      .map((d) => ({
        templateFile: d.file,
        signee: d.meta.needsSignee ? builtChoice : null,
        signature: d.meta.needsSignee ? signature : null,
        extras,
      }))
    const res = await api.generatePackage({
      studentId: student.id,
      category,
      docs,
      identity: identity ? { dataUrl: identity } : null,
      identitySigner: cat.signer === 'family' && identitySigner ? { dataUrl: identitySigner } : null,
    })
    setBusy(false)
    setResult(res)
  }

  return (
    <Modal
      title="Πακέτο εγγραφής"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Κλείσιμο
          </button>
          <button
            onClick={generate}
            disabled={!canGenerate}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            {busy ? 'Δημιουργία…' : 'Δημιουργία πακέτου'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        <strong>{student.eponymo} {student.onoma}</strong> — ΔΙΚΑ {student.dika || '—'}
      </p>

      {/* 1) Κατηγορία */}
      <div className="mb-4">
        <p className="mb-1 text-sm font-medium text-slate-700">Κατηγορία μαθητή</p>
        <div className="space-y-1.5">
          {CATEGORIES.map((c) => (
            <label
              key={c.key}
              className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
                category === c.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
              }`}
            >
              <input type="radio" checked={category === c.key} onChange={() => setCategory(c.key)} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 2) Έγγραφα */}
      <div className="mb-4">
        <p className="mb-1 text-sm font-medium text-slate-700">Έγγραφα πακέτου</p>
        <ul className="space-y-1 text-sm text-slate-600">
          {docMetas.map((d) => (
            <li key={d.file} className="flex items-center gap-2">
              <FileText size={14} className={d.meta ? 'text-blue-600' : 'text-slate-300'} />
              <span className={d.meta ? '' : 'text-slate-400 line-through'}>{d.file.replace(/\.(docx|pptx)$/i, '')}</span>
              {d.meta && d.meta.needsSignee && <span className="text-xs text-slate-400">(υπογραφή)</span>}
              {!d.meta && <span className="text-xs text-amber-600">λείπει</span>}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <FileText size={14} className="text-blue-600" />
            <span>Ταυτοποιητικό</span>
          </li>
        </ul>
        {missing.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Λείπουν πρότυπα ({missing.join(', ')}). Θα δημιουργηθούν τα υπόλοιπα. Προσθέστε τα από τις Ρυθμίσεις ▸ Πρότυπα.
          </p>
        )}
      </div>

      {/* 3) Υπογράφων */}
      {signeeDocs.length > 0 && (
        <div className="mb-4 rounded-md border border-slate-200 p-3">
          {cat.signer === 'family' && (
            <SigneePicker value={choice} onChange={setChoice} options={['father', 'mother', 'other']} hints={hints} />
          )}
          {cat.signer === 'unaccompanied' && (
            <>
              <SigneePicker value={choice} onChange={setChoice} options={['sep', 'other']} hints={hints} />
              {choice.type === 'sep' && (
                <p className="mt-2 text-xs text-slate-500">
                  Θα προστεθεί κάτω από την υπογραφή: «Σε αναμονή ορισμού επιτρόπου από την Εισαγγελία νομού{' '}
                  {settings.nomos_gen || settings.nomos || '…'}».
                </p>
              )}
            </>
          )}
          {cat.signer === 'self' && (
            <p className="text-sm text-slate-600">
              Υπογράφει ο ίδιος ο μαθητής: <strong>{student.onoma} {student.eponymo}</strong>
            </p>
          )}
        </div>
      )}

      {/* Ελεύθερα πεδία */}
      {fields.length > 0 && (
        <div className="mb-4 space-y-3">
          <datalist id="pkg-schools">
            {schools.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          {fields.map((f) => (
            <label key={f.token} className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">{f.label}</span>
              <input
                type="text"
                {...(f.useSchoolList ? { list: 'pkg-schools' } : {})}
                value={extras[f.token] || ''}
                onChange={(e) => setExtras((p) => ({ ...p, [f.token]: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
          ))}
        </div>
      )}

      {/* 4) Υπογραφή */}
      {signeeDocs.length > 0 && (
        <div className="mb-4">
          <SignaturePad onChange={setSignature} />
        </div>
      )}

      {/* 5) Ταυτοποιητικό μαθητή */}
      <div className="mb-4">
        <CameraCapture label="Ταυτοποιητικό μαθητή (κάρτα ταυτότητας Δομής)" onChange={setIdentity} />
      </div>

      {/* 5β) Ταυτοποιητικό υπογράφοντα — μόνο για «οικογένεια» */}
      {cat.signer === 'family' && (
        <div className="mb-4">
          <CameraCapture label="Ταυτοποιητικό γονέα/συγγενή (υπογράφοντα)" onChange={setIdentitySigner} />
        </div>
      )}

      {/* Φάκελος αποθήκευσης */}
      <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-slate-50 p-2 text-xs">
        <span className="min-w-0 truncate text-slate-500">Φάκελος: {folder}</span>
        <button onClick={changeFolder} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-white">
          <FolderCog size={13} /> Αλλαγή
        </button>
      </div>

      {result && (
        <div className={`mt-3 rounded-md p-2 text-sm ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {result.error ? (
            result.error
          ) : (
            <>
              Δημιουργήθηκε το πακέτο ({(result.generated || []).length} αρχεία) — άνοιξε ο φάκελος.
              {result.warnings && result.warnings.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs text-amber-700">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
