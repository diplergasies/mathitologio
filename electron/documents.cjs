'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const PizZip = require('pizzip')

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Ποια εσωτερικά XML αρχεία περιέχουν κείμενο προς αντικατάσταση, ανά τύπο εγγράφου.
function targetXmlPattern(ext) {
  if (ext === '.docx') return /word\/(document|header\d*|footer\d*)\.xml$/
  // .pptx
  return /ppt\/(slides|notesSlides|slideLayouts|slideMasters)\/.*\.xml$/
}

// Συμπληρώνει ένα .pptx ή .docx template αντικαθιστώντας {{TOKEN}} με τιμές.
// data: { TOKEN: value, ... }. Επιστρέφει το path του προσωρινού filled αρχείου.
function fillTemplate(templatePath, data, outDir) {
  const ext = path.extname(templatePath).toLowerCase()
  const content = fs.readFileSync(templatePath)
  const zip = new PizZip(content)
  const pattern = targetXmlPattern(ext)

  Object.keys(zip.files)
    .filter((name) => pattern.test(name))
    .forEach((name) => {
      let xml = zip.file(name).asText()

      // 1) "Επιδιόρθωση" placeholders σπασμένων σε πολλά runs: αφαίρεση tags μέσα σε {{ ... }}.
      xml = xml.replace(/\{\{[\s\S]*?\}\}/g, (m) => m.replace(/<[^>]+>/g, ''))

      // 2) Αντικατάσταση των tokens.
      for (const [token, value] of Object.entries(data)) {
        const re = new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, 'g')
        xml = xml.replace(re, xmlEscape(value))
      }

      zip.file(name, xml)
    })

  const outName =
    path.basename(templatePath, ext) + `_filled_${Date.now()}` + ext
  const outPath = path.join(outDir, outName)
  fs.writeFileSync(outPath, zip.generate({ type: 'nodebuffer' }))
  return outPath
}

// Εντοπισμός εκτελέσιμου LibreOffice (bundled ή συστήματος).
function findSoffice(resourcesPath, isDev) {
  const candidates = []
  const exe = process.platform === 'win32' ? 'soffice.exe' : 'soffice'

  if (resourcesPath) {
    candidates.push(path.join(resourcesPath, 'libreoffice', 'program', exe))
    candidates.push(path.join(resourcesPath, 'libreoffice', exe))
  }
  if (isDev) {
    const devBase = path.join(__dirname, '..', 'resources', 'libreoffice')
    candidates.push(path.join(devBase, 'program', exe))
    candidates.push(path.join(devBase, exe))
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  // Εφεδρικά: εγκατεστημένο στο σύστημα (PATH).
  return process.platform === 'win32' ? 'soffice.exe' : 'soffice'
}

// Μετατροπή pptx/docx -> pdf. Επιστρέφει το path του PDF.
function convertToPdf(srcPath, outDir, soffice) {
  const pptxPath = srcPath
  const profileDir = path.join(os.tmpdir(), `lo_profile_${process.pid}`)
  const result = spawnSync(
    soffice,
    [
      '--headless',
      '--norestore',
      '--nolockcheck',
      `-env:UserInstallation=file://${profileDir.replace(/\\/g, '/')}`,
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      pptxPath,
    ],
    { encoding: 'utf8', timeout: 120000 }
  )

  if (result.error) {
    throw new Error(`Αποτυχία εκτέλεσης LibreOffice (${soffice}): ${result.error.message}`)
  }
  const pdfPath = path.join(outDir, path.basename(pptxPath, path.extname(pptxPath)) + '.pdf')
  if (!fs.existsSync(pdfPath)) {
    throw new Error(
      `Δεν δημιουργήθηκε PDF. Έξοδος LibreOffice: ${result.stdout || ''} ${result.stderr || ''}`
    )
  }
  return pdfPath
}

// Πλήρης ροή: γέμισμα template + μετατροπή σε PDF. Επιστρέφει το path του PDF.
function generate({ templatePath, data, resourcesPath, isDev }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mathitologio_'))
  const filled = fillTemplate(templatePath, data, tmpDir)
  const soffice = findSoffice(resourcesPath, isDev)
  return convertToPdf(filled, tmpDir, soffice)
}

module.exports = { fillTemplate, convertToPdf, findSoffice, generate, xmlEscape }
