import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ConfirmProvider } from './components/ConfirmProvider'
import ErrorBoundary, { installRendererErrorHooks } from './components/ErrorBoundary'
import './index.css'

installRendererErrorHooks()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
