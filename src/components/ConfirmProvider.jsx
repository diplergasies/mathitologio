import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Modal from './Modal'

// Αντικαθιστά τα native confirm()/alert(): σε Electron ο native διάλογος «κλέβει» το
// focus από το renderer και δεν το επιστρέφει, οπότε τα inputs «παγώνουν» μέχρι
// minimize/restore. Ένα custom modal μέσα στο renderer αποφεύγει τελείως το πρόβλημα.

const ConfirmContext = createContext(null)

function normalize(msgOrOpts) {
  return typeof msgOrOpts === 'string' ? { message: msgOrOpts } : (msgOrOpts || {})
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null) // { opts, kind: 'confirm' | 'notify' }
  const resolveRef = useRef(null)

  const open = useCallback((kind, msgOrOpts) => {
    const opts = normalize(msgOrOpts)
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setState({ kind, opts })
    })
  }, [])

  const settle = useCallback((value) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    setState(null)
    if (resolve) resolve(value)
  }, [])

  const confirm = useCallback((msgOrOpts) => open('confirm', msgOrOpts), [open])
  const notify = useCallback((msgOrOpts) => open('notify', msgOrOpts), [open])

  const isConfirm = state?.kind === 'confirm'
  const opts = state?.opts || {}
  const {
    title = isConfirm ? 'Επιβεβαίωση' : 'Ειδοποίηση',
    message = '',
    confirmLabel = 'OK',
    cancelLabel = 'Άκυρο',
    danger = true,
  } = opts

  const footer = state && (
    <>
      {isConfirm && (
        <button
          onClick={() => settle(false)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          {cancelLabel}
        </button>
      )}
      <button
        autoFocus
        onClick={() => settle(isConfirm ? true : undefined)}
        className={
          'rounded-md px-3 py-1.5 text-sm font-medium text-white ' +
          (danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')
        }
      >
        {confirmLabel}
      </button>
    </>
  )

  return (
    <ConfirmContext.Provider value={{ confirm, notify }}>
      {children}
      {state && (
        <Modal title={title} onClose={() => settle(isConfirm ? false : undefined)} footer={footer}>
          <p className="whitespace-pre-line text-sm text-slate-700">{message}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm πρέπει να χρησιμοποιείται μέσα σε <ConfirmProvider>')
  return ctx.confirm
}

export function useNotify() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useNotify πρέπει να χρησιμοποιείται μέσα σε <ConfirmProvider>')
  return ctx.notify
}
