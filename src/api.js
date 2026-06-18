// Λεπτό wrapper γύρω από το window.api (IPC bridge από το preload).
// Αν τρέξει εκτός Electron (π.χ. σκέτος browser), επιστρέφει ασφαλή no-ops.

const noop = async () => {
  console.warn('window.api μη διαθέσιμο — εκτελείται εκτός Electron;')
  return null
}

const api = typeof window !== 'undefined' && window.api ? window.api : new Proxy({}, { get: () => noop })

export default api
