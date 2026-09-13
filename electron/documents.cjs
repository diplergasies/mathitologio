'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { spawnSync, spawn } = require('child_process')
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

// Μετατροπή pixel -> EMU (English Metric Units): 1 px @96dpi = 9525 EMU.
const EMU_PER_PX = 9525

// Παράγει το inline DrawingML (<w:drawing>) για ένθεση εικόνας μέσα σε παράγραφο Word.
// Δηλώνει τα namespaces πάνω στο <wp:inline> ώστε να είναι αυτόνομο (να μην εξαρτάται από
// τυχόν δηλώσεις στο <w:document>). rid = το relationship id προς το media αρχείο.
function buildDrawingXml(rid, id, cx, cy) {
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
  const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture'
  const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  return (
    `<w:drawing>` +
    `<wp:inline xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}" xmlns:r="${R}" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="signature_${id}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="${PIC}">` +
    `<pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="signature_${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic>` +
    `</a:graphicData></a:graphic>` +
    `</wp:inline>` +
    `</w:drawing>`
  )
}

// Εξασφαλίζει ότι το [Content_Types].xml δηλώνει το png (χρειάζεται για ενσωματωμένες εικόνες).
function ensurePngContentType(zip) {
  const ct = zip.file('[Content_Types].xml')
  if (!ct) return
  let xml = ct.asText()
  if (/Extension="png"/i.test(xml)) return
  xml = xml.replace(/<\/Types>\s*$/, '<Default Extension="png" ContentType="image/png"/></Types>')
  zip.file('[Content_Types].xml', xml)
}

// Προσθέτει relationship εικόνας στο word/_rels/document.xml.rels (δημιουργεί το αρχείο αν λείπει).
function addImageRelationship(zip, rid, target) {
  const relPath = 'word/_rels/document.xml.rels'
  const rel =
    `<Relationship Id="${rid}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
    `Target="${target}"/>`
  const existing = zip.file(relPath)
  if (existing) {
    let xml = existing.asText()
    xml = xml.replace(/<\/Relationships>\s*$/, rel + '</Relationships>')
    zip.file(relPath, xml)
  } else {
    zip.file(
      relPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        rel +
        `</Relationships>`
    )
  }
}

// Αντικαθιστά ένα {{token}} μέσα στο word/document.xml με ενσωματωμένη εικόνα (inline drawing).
// Σπάει το τρέχον run: κλείνει το κείμενο, παρεμβάλλει run με το drawing, ξανανοίγει run κειμένου.
// Επιστρέφει το τροποποιημένο xml (ή το ίδιο αν δεν βρέθηκε το token).
function insertImageToken(zip, xml, token, img, seq) {
  const re = new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, 'g')
  if (!re.test(xml)) return xml
  const wPx = Number(img.wPx) > 0 ? Number(img.wPx) : 200
  const hPx = Number(img.hPx) > 0 ? Number(img.hPx) : 80
  const cx = Math.round(wPx * EMU_PER_PX)
  const cy = Math.round(hPx * EMU_PER_PX)
  const rid = `rIdSig${seq}`
  const mediaName = `sig_${seq}.png`
  zip.file(`word/media/${mediaName}`, img.pngBuffer)
  addImageRelationship(zip, rid, `media/${mediaName}`)
  ensurePngContentType(zip)
  const drawing = buildDrawingXml(rid, 1000 + seq, cx, cy)
  // Κλείσιμο του τρέχοντος <w:t>/<w:r>, run με το drawing, εκ νέου άνοιγμα run κειμένου.
  const replacement =
    `</w:t></w:r><w:r>${drawing}</w:r><w:r><w:t xml:space="preserve">`
  return xml.replace(re, replacement)
}

// Συμπληρώνει ένα .pptx ή .docx template αντικαθιστώντας {{TOKEN}} με τιμές.
// data: { TOKEN: value, ... }. images (προαιρετικό, μόνο .docx): { TOKEN: { pngBuffer, wPx, hPx } }
// — τα tokens αυτά αντικαθίστανται με ενσωματωμένη (transparent) εικόνα στη θέση τους (π.χ.
// χειρόγραφη υπογραφή πάνω στο {{signee}}). Επιστρέφει το path του προσωρινού filled αρχείου.
function fillTemplate(templatePath, data, outDir, images) {
  const ext = path.extname(templatePath).toLowerCase()
  const content = fs.readFileSync(templatePath)
  const zip = new PizZip(content)
  const pattern = targetXmlPattern(ext)
  const imgTokens = images && ext === '.docx' ? Object.keys(images) : []
  let imgSeq = 0

  Object.keys(zip.files)
    .filter((name) => pattern.test(name))
    .forEach((name) => {
      let xml = zip.file(name).asText()

      // 1) "Επιδιόρθωση" placeholders σπασμένων σε πολλά runs: αφαίρεση tags μέσα σε {{ ... }}.
      xml = xml.replace(/\{\{[\s\S]*?\}\}/g, (m) => m.replace(/<[^>]+>/g, ''))

      // 2) Εικόνες (μόνο στο σώμα του εγγράφου): ένθεση ΠΡΙΝ την αντικατάσταση κειμένου,
      //    ώστε το token να «καταναλωθεί» από την εικόνα και να μη γεμίσει με κείμενο.
      if (imgTokens.length && name === 'word/document.xml') {
        for (const token of imgTokens) {
          xml = insertImageToken(zip, xml, token, images[token], ++imgSeq)
        }
      }

      // 3) Αντικατάσταση των tokens (τα image-tokens που τυχόν απέμειναν αλλού → κενό/τιμή).
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

// Εξάγει το σύνολο των tokens (χωρίς {{ }}) που υπάρχουν σε ένα template.
function extractTokens(templatePath) {
  const ext = path.extname(templatePath).toLowerCase()
  const zip = new PizZip(fs.readFileSync(templatePath))
  const pattern = targetXmlPattern(ext)
  const set = new Set()
  Object.keys(zip.files)
    .filter((name) => pattern.test(name))
    .forEach((name) => {
      // Αφαίρεση tags ώστε να ενωθούν tokens σπασμένα σε πολλά runs.
      const text = zip.file(name).asText().replace(/<[^>]+>/g, '')
      ;(text.match(/\{\{[^}]+\}\}/g) || []).forEach((t) => set.add(t.replace(/[{}]/g, '').trim()))
    })
  return [...set]
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

  // Τυπικές διαδρομές εγκατεστημένου LibreOffice ανά λειτουργικό.
  if (process.platform === 'win32') {
    candidates.push('C:\\Program Files\\LibreOffice\\program\\soffice.exe')
    candidates.push('C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe')
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/LibreOffice.app/Contents/MacOS/soffice')
  } else {
    candidates.push('/usr/bin/soffice', '/usr/bin/libreoffice', '/snap/bin/libreoffice')
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  // Εφεδρικά: ό,τι υπάρχει στο PATH.
  return process.platform === 'win32' ? 'soffice.exe' : 'soffice'
}

// Μετατροπή path -> 8.3 short path στα Windows (ASCII-safe). Λύνει τη σιωπηλή
// αποτυχία του LibreOffice όταν το path περιέχει μη-ASCII χαρακτήρες (π.χ. ελληνικό
// όνομα χρήστη: C:\Users\Μαρία\...). Σε άλλα OS ή αν αποτύχει, επιστρέφει το αρχικό.
// Το short name απαιτεί να υπάρχει το αρχείο/φάκελος· αλλιώς πέφτουμε στο αρχικό.
const _shortPathCache = new Map()
function winShortPath(p) {
  if (process.platform !== 'win32' || !p) return p
  if (_shortPathCache.has(p)) return _shortPathCache.get(p)
  let resolved = p
  try {
    const out = spawnSync('cmd.exe', ['/d', '/c', `for %I in ("${p}") do @echo %~sI`], {
      encoding: 'utf8',
      windowsHide: true,
    })
    const s = (out.stdout || '').trim()
    if (s && fs.existsSync(s)) resolved = s
  } catch {}
  _shortPathCache.set(p, resolved)
  return resolved
}

// Μετατροπή pptx/docx -> pdf. Επιστρέφει το path του PDF.
// profileDir: σταθερός (persistent) φάκελος προφίλ LibreOffice. Η 1η μετατροπή τον
// δημιουργεί (αργή σε HDD + antivirus που σκανάρει το φρεσκο-εγκατεστημένο LO), οι
// επόμενες τον επαναχρησιμοποιούν -> ~10x ταχύτερες (μετρήθηκε 26.9s ψυχρό vs 2.7s ζεστό).
// Αν δεν δοθεί (π.χ. κλήση εκτός Electron), πέφτουμε σε σταθερό φάκελο στο tmp.
function convertToPdf(srcPath, outDir, soffice, profileDir) {
  const baseProfile = profileDir || path.join(os.tmpdir(), 'mathitologio_lo_profile')
  const pdfPath = path.join(outDir, path.basename(srcPath, path.extname(srcPath)) + '.pdf')

  // Μία προσπάθεια μετατροπής με συγκεκριμένο προφίλ. Όλα τα paths περνάνε από
  // 8.3 short form (ASCII-safe) ώστε να μην αποτυγχάνει σιωπηλά σε μη-ASCII path.
  const attempt = (profile) => {
    fs.mkdirSync(profile, { recursive: true })
    // Έγκυρο file:// URL και στα δύο OS: στα Windows δίνει file:///C:/... (τρία slashes),
    // στο Linux/mac file:///tmp/... — το χειροκίνητο `file://`+path έσπαγε στα Windows
    // (file://C:/... → το C: ερμηνευόταν ως host) και προκαλούσε «bootstrap.ini is corrupt».
    const userInstallationUrl = pathToFileURL(winShortPath(profile)).href
    return spawnSync(
      winShortPath(soffice),
      [
        '--headless',
        '--norestore',
        '--nolockcheck',
        `-env:UserInstallation=${userInstallationUrl}`,
        '--convert-to',
        'pdf',
        '--outdir',
        winShortPath(outDir),
        winShortPath(srcPath),
      ],
      // Timeout 5': η πρώτη ψυχρή εκτέλεση σε αργό δίσκο (HDD) ενώ ο antivirus σκανάρει
      // τα χιλιάδες αρχεία του LO μπορεί να ξεπεράσει τα 2' — το persistent profile
      // επιταχύνει τις επόμενες, αλλά όχι την πρώτη.
      { encoding: 'utf8', timeout: 300000, windowsHide: true }
    )
  }

  let result = attempt(baseProfile)
  if (result.error) {
    throw new Error(`Αποτυχία εκτέλεσης LibreOffice (${soffice}): ${result.error.message}`)
  }

  // Εφεδρικό: αν δεν βγήκε PDF, ξαναδοκίμασε ΜΙΑ φορά με φρέσκο, μοναδικό προφίλ.
  // Καλύπτει κλειδωμένο/χαλασμένο persistent profile και υποκλοπή της μετατροπής από
  // ήδη ανοιχτό LibreOffice/Quickstarter (το νέο προφίλ → νέο named pipe, ανεξάρτητο).
  if (!fs.existsSync(pdfPath)) {
    let freshProfile
    try {
      freshProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'mathitologio_lo_p_'))
      result = attempt(freshProfile)
    } catch {}
    try {
      if (freshProfile) fs.rmSync(freshProfile, { recursive: true, force: true })
    } catch {}
  }

  if (result.error) {
    throw new Error(`Αποτυχία εκτέλεσης LibreOffice (${soffice}): ${result.error.message}`)
  }
  if (!fs.existsSync(pdfPath)) {
    throw new Error(
      `Δεν δημιουργήθηκε PDF (exit=${result.status} signal=${result.signal || '-'} ` +
        `timedOut=${result.timedOut ? 'ναι' : 'όχι'}). soffice=${soffice} · src=${srcPath} · ` +
        `out=${outDir}. Έξοδος LibreOffice: ${(result.stdout || '').trim()} ${(result.stderr || '').trim()}`.trim()
    )
  }
  return pdfPath
}

// Πλήρης ροή: γέμισμα template + μετατροπή σε PDF. Επιστρέφει το path του PDF.
function generate({ templatePath, data, resourcesPath, isDev, userDataPath, images }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mathitologio_'))
  const filled = fillTemplate(templatePath, data, tmpDir, images)
  const soffice = findSoffice(resourcesPath, isDev)
  // Persistent προφίλ LibreOffice μέσα στο userData (όταν τρέχουμε σε Electron),
  // ώστε να μη δημιουργείται νέο προφίλ σε κάθε έκδοση εγγράφου.
  const profileDir = userDataPath ? path.join(userDataPath, 'lo_profile') : null
  return convertToPdf(filled, tmpDir, soffice, profileDir)
}

// Προθέρμανση (warm-up) του persistent προφίλ LibreOffice σε background, ΧΩΡΙΣ να
// μπλοκάρει το main process (async spawn, όχι spawnSync). Καλείται στην 1η εκκίνηση
// όταν δεν υπάρχει ακόμη προφίλ, ώστε ο χρήστης να μη χτυπήσει την ψυχρή καθυστέρηση
// (φόρτωση DLLs + δημιουργία προφίλ + scan antivirus) ζωντανά στην πρώτη έκδοση εγγράφου.
// Best-effort: ποτέ δεν κάνει reject — επιστρέφει true/false.
function warmUpProfile({ templatePath, soffice, profileDir }) {
  return new Promise((resolve) => {
    if (!soffice || !templatePath || !fs.existsSync(templatePath)) return resolve(false)
    let outDir
    try {
      outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mathitologio_warmup_'))
    } catch {
      return resolve(false)
    }
    const profile = profileDir || path.join(os.tmpdir(), 'mathitologio_lo_profile')
    try {
      fs.mkdirSync(profile, { recursive: true })
    } catch {}
    const userInstallationUrl = pathToFileURL(winShortPath(profile)).href

    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      try {
        fs.rmSync(outDir, { recursive: true, force: true })
      } catch {}
      resolve(ok)
    }

    let child
    try {
      child = spawn(
        winShortPath(soffice),
        [
          '--headless',
          '--norestore',
          '--nolockcheck',
          `-env:UserInstallation=${userInstallationUrl}`,
          '--convert-to',
          'pdf',
          '--outdir',
          winShortPath(outDir),
          winShortPath(templatePath),
        ],
        { stdio: 'ignore', windowsHide: true }
      )
    } catch {
      return finish(false)
    }

    // Ασφαλιστικό: αν κολλήσει, σκότωσε το child και μην αφήσεις zombie/temp.
    const killer = setTimeout(() => {
      try {
        child.kill()
      } catch {}
      finish(false)
    }, 300000)

    child.on('error', () => {
      clearTimeout(killer)
      finish(false)
    })
    child.on('exit', () => {
      clearTimeout(killer)
      finish(true)
    })
  })
}

module.exports = { fillTemplate, convertToPdf, findSoffice, generate, warmUpProfile, xmlEscape, extractTokens }
