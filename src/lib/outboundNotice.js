// Μήνυμα μετά από διαγραφή, όταν ο κανόνας e-mail έστειλε ή έβαλε κάτι στην ουρά.
export function notifyOutbound(res, showToast) {
  const o = res && res.outbound
  if (!o || !showToast) return
  const errors = o.errors || []
  if (errors.length) {
    const tail = o.queued ? ' Μπήκε στις Εκκρεμότητες.' : ''
    showToast(`${errors[0]}${tail}`, 'error')
    return
  }
  if (o.sent) {
    showToast(o.sent === 1 ? 'Στάλθηκε e-mail διαγραφής στο σχολείο.' : `Στάλθηκαν ${o.sent} e-mail διαγραφής.`)
  } else if (o.queued) {
    showToast(
      o.queued === 1
        ? 'Η ειδοποίηση μπήκε στις Εκκρεμότητες.'
        : `${o.queued} ειδοποιήσεις μπήκαν στις Εκκρεμότητες.`
    )
  }
}
