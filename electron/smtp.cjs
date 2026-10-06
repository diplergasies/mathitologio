'use strict'

// Αποστολή εξερχόμενου e-mail μέσω SMTP (λογαριασμός sch.gr, ίδια στοιχεία με το IMAP).
// Τρέχει στη διεργασία mailWorker, όχι στο κύριο νήμα.

const nodemailer = require('nodemailer')

function sendMessage(config) {
  const c = config || {}
  const port = Number(c.port) || 465
  const transporter = nodemailer.createTransport({
    host: c.host || 'mail.sch.gr',
    port,
    secure: port === 465,
    auth: { user: c.username, pass: c.password },
    connectionTimeout: 20 * 1000,
    greetingTimeout: 20 * 1000,
    socketTimeout: 30 * 1000,
  })
  const cc = String(c.cc || '').trim()
  return transporter
    .sendMail({
      from: c.username,
      to: c.to,
      cc: cc || undefined,
      subject: c.subject || '',
      text: c.text || '',
    })
    .then((info) => ({ ok: true, messageId: info && info.messageId }))
}

module.exports = { sendMessage }
