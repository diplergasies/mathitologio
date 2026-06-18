import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, HelpCircle } from 'lucide-react'
import api from '../api'

export default function HelpModal({ onClose }) {
  const [md, setMd] = useState('Φόρτωση…')

  useEffect(() => {
    api.getReadme().then((t) => setMd(t || '—'))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <HelpCircle size={20} className="text-blue-600" /> Βοήθεια
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="md-body overflow-auto px-6 py-4" data-selectable>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
