// Εξαγωγή Ημερολογίου σε .docx: συνοπτικά γεγονότα μαθητών ανά ημέρα (π.χ. «Άφιξη: 15 μαθητές»,
// «Εγγραφή: 2ο ΕΠΑΛ (5 μαθητές)», «Διαγραφή: 3 μαθητές») + χειροκίνητες σημειώσεις. Καλύπτει
// ολόκληρο το σχολικό έτος (1 Σεπτεμβρίου – 31 Αυγούστου).
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from 'docx'
import api from './api'
import { MONTHS, DOW_FULL, keyToDMY } from './calendarUtils'

function pluralMathites(n) {
  return `${n} ${n === 1 ? 'μαθητής' : 'μαθητές'}`
}

// Δείκτης ημέρας εβδομάδας με Δευτέρα=0 … Κυριακή=6, από κλειδί 'YYYY-MM-DD'.
function weekdayFull(key) {
  const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return DOW_FULL[(d.getDay() + 6) % 7]
}

// Συνοπτικές γραμμές γεγονότων μαθητών μιας ημέρας (χωρίς ονόματα/ΔΙΚΑ).
function autoLines(events) {
  const lines = []
  const arrivals = events.filter((e) => e.kind === 'arrival')
  const enrollments = events.filter((e) => e.kind === 'enrollment')
  const deletions = events.filter((e) => e.kind === 'deletion')

  if (arrivals.length) lines.push(`Άφιξη: ${pluralMathites(arrivals.length)}`)

  if (enrollments.length) {
    // Ομαδοποίηση εγγραφών ανά σχολείο.
    const bySchool = new Map()
    for (const e of enrollments) {
      const s = (e.school || '').trim() || 'Χωρίς σχολείο'
      bySchool.set(s, (bySchool.get(s) || 0) + 1)
    }
    for (const [school, n] of bySchool) lines.push(`Εγγραφή: ${school} (${pluralMathites(n)})`)
  }

  if (deletions.length) lines.push(`Διαγραφή: ${pluralMathites(deletions.length)}`)
  return lines
}

// Δημιουργία του εγγράφου docx από τα (φιλτραρισμένα) γεγονότα του σχολικού έτους.
function buildDocx(events, syStart, syLabel) {
  const children = []

  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Ημερολόγιο μαθητολογίου')] })
  )
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Σχολικό έτος ${syLabel} · 01/09/${syStart} – 31/08/${syStart + 1}`,
          italics: true,
          color: '64748b',
        }),
      ],
    })
  )
  children.push(new Paragraph({ children: [new TextRun('')] }))

  // Ομαδοποίηση ανά ημέρα.
  const byDay = new Map()
  for (const e of events) {
    if (!byDay.has(e.date)) byDay.set(e.date, [])
    byDay.get(e.date).push(e)
  }
  const days = [...byDay.keys()].sort() // 'YYYY-MM-DD' → λεξικογραφικά = χρονολογικά

  if (days.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('Δεν υπάρχουν καταχωρήσεις για αυτό το σχολικό έτος.')] }))
  }

  let lastMonthKey = ''
  for (const key of days) {
    const [y, mo] = key.split('-')
    const monthKey = `${y}-${mo}`
    if (monthKey !== lastMonthKey) {
      lastMonthKey = monthKey
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun(`${MONTHS[Number(mo) - 1]} ${y}`)],
        })
      )
    }

    const dayEvents = byDay.get(key)
    const notes = dayEvents.filter((e) => e.kind === 'note')
    const lines = autoLines(dayEvents)

    // Επικεφαλίδα ημέρας (έντονα).
    children.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun({ text: `${weekdayFull(key)} ${keyToDMY(key)}`, bold: true })],
      })
    )

    for (const l of lines) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(l)] }))
    }
    for (const n of notes) {
      const text = n.note ? `Σημείωση: ${n.title} — ${n.note}` : `Σημείωση: ${n.title}`
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(text)] }))
    }
  }

  return new Document({
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
    },
    sections: [{ children }],
  })
}

// Δημόσια συνάρτηση: φέρνει τα γεγονότα του σχολικού έτους, χτίζει το docx και ανοίγει
// διάλογο αποθήκευσης. Επιστρέφει το αποτέλεσμα του api.saveCalendarDocx.
export async function exportCalendarDocx({ syStart, syLabel }) {
  const from = `${syStart}-09-01`
  const to = `${syStart + 1}-08-31`
  const events = (await api.calendarEvents({ from, to })) || []
  const blob = await Packer.toBlob(buildDocx(events, syStart, syLabel))
  const buf = new Uint8Array(await blob.arrayBuffer())
  const name = `Ημερολόγιο ${syLabel}.docx`
  return api.saveCalendarDocx(buf, name)
}
