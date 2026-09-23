import { useState } from 'react'
import Modal from './Modal'

// Pop-up ανακοίνωσης προς τους χρήστες στην έναρξη. Το περιεχόμενο είναι το HTML ενός κοινόχρηστου
// Google Doc, ώστε να διατηρείται η μορφοποίηση (bold/italics/χρώματα). Αποδίδεται μέσα σε iframe
// (sandbox χωρίς scripts) για απομόνωση των στυλ/κλάσεων του εγγράφου. Βασική γραμματοσειρά Arial 12.
// Ουδετεροποιεί μόνο τα «περιθώρια σελίδας» του Google Doc και βάζει Arial ως fallback·
// το μέγεθος/γραμματοσειρά/χρώματα έρχονται ΑΠΟ το Doc (WYSIWYG).
const BASE_STYLE = `<style>
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .doc-content { padding: 0 !important; max-width: 100% !important; }
  body { font-family: Arial, Helvetica, sans-serif; }
  img { max-width: 100%; height: auto; }
</style>`

// Ενσωμάτωση του βασικού στυλ μέσα στο <head> του εγγράφου (ώστε να υπερισχύει).
function withBaseStyle(html) {
  if (html.includes('</head>')) return html.replace('</head>', `${BASE_STYLE}</head>`)
  return BASE_STYLE + html
}

export default function AnnouncementModal({ html, onClose }) {
  const [height, setHeight] = useState(220)

  function onLoad(e) {
    try {
      const doc = e.target.contentWindow.document
      const h = doc.body ? doc.body.scrollHeight : 0
      if (h) setHeight(Math.min(h + 6, Math.round(window.innerHeight * 0.62)))
    } catch (_e) {
      /* no-op */
    }
  }

  const footer = (
    <button
      onClick={onClose}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      Εντάξει
    </button>
  )

  return (
    <Modal title="Ανακοίνωση" onClose={onClose} footer={footer}>
      <iframe
        title="Ανακοίνωση"
        sandbox="allow-same-origin"
        srcDoc={withBaseStyle(html)}
        onLoad={onLoad}
        style={{ height }}
        className="w-full border-0"
      />
    </Modal>
  )
}
