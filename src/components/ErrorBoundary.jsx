import React from 'react'
import api from '../api'

// Αποστολή σφάλματος renderer στα insights (best-effort, δεν ρίχνει ποτέ).
export function reportRendererError(source, err) {
  try {
    const e = err || {}
    api.reportRendererError({
      source,
      name: e.name || 'Error',
      message: e.message || String(e),
      stack: e.stack || '',
    })
  } catch {
    /* noop */
  }
}

// Καθολικά hooks: μη πιασμένα σφάλματα & απορρίψεις promises του renderer.
export function installRendererErrorHooks() {
  window.addEventListener('error', (ev) => {
    reportRendererError('window', ev.error || { message: ev.message })
  })
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason
    reportRendererError('unhandledrejection', r instanceof Error ? r : { message: String(r) })
  })
}

// Πιάνει σφάλματα κατά το render, ώστε να μη μένει λευκή οθόνη, και τα καταγράφει.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    const e = error || {}
    reportRendererError('react', {
      name: e.name,
      message: e.message,
      stack: `${e.stack || ''}\n--- component stack ---${(info && info.componentStack) || ''}`,
    })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Κάτι πήγε στραβά</h2>
          <p className="mb-4 text-sm text-slate-500">
            Το σφάλμα καταγράφηκε αυτόματα για διόρθωση. Τα δεδομένα σας δεν επηρεάστηκαν.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Επαναφόρτωση
          </button>
        </div>
      </div>
    )
  }
}
