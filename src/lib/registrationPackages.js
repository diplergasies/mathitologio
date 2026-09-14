// Πακέτα εγγραφής: ορισμός προεπιλογών + φόρτωση από τις ρυθμίσεις.
// Κάθε πακέτο: { id, label, signer: 'minor'|'self'|'none', docs: [templateFilename, ...] }
//  - signer 'minor' → επιλογέας υπογράφοντα (γονέας/ΣΕΠ/άλλος)
//  - signer 'self'  → υπογράφει ο ίδιος ο μαθητής
//  - signer 'none'  → έγγραφα χωρίς υπογραφή
// Αποθηκεύονται ως JSON string στη ρύθμιση registration_packages (KV settings).

export const PACKAGES_KEY = 'registration_packages'

export const SIGNER_LABELS = {
  minor: 'Ανήλικος — επιλογή υπογράφοντα',
  self: 'Ο ίδιος ο μαθητής',
  none: 'Χωρίς υπογραφή',
}

// Τα 2 αρχικά πακέτα (ίδια ονόματα προτύπων με resources/templates).
export const DEFAULT_PACKAGES = [
  {
    id: 'minor',
    label: 'Ανήλικος',
    signer: 'minor',
    docs: ['Αίτηση εγγραφής.docx', 'ΥΔ-ΖΕΠ.docx', 'ΑΔΥΜ.pptx'],
  },
  {
    id: 'adult',
    label: 'Ενήλικας',
    signer: 'self',
    docs: ['Αίτηση εγγραφής ενηλίκων.docx', 'ΥΔ-ΖΕΠ ενηλίκων.docx', 'ΑΔΥΜ.pptx'],
  },
]

// Επιστρέφει βαθύ αντίγραφο των προεπιλογών (ώστε να μη μεταλλάσσονται κατά λάθος).
export function defaultPackages() {
  return DEFAULT_PACKAGES.map((p) => ({ ...p, docs: [...p.docs] }))
}

// Έγκυρο πακέτο = αντικείμενο με id, docs πίνακας και αποδεκτό signer.
function isValidPackage(p) {
  return (
    p &&
    typeof p === 'object' &&
    typeof p.id === 'string' &&
    p.id.trim() &&
    Array.isArray(p.docs) &&
    ['minor', 'self', 'none'].includes(p.signer)
  )
}

// Φόρτωση πακέτων από το settings object· fallback στις προεπιλογές αν λείπει/είναι άκυρο.
export function loadPackages(settings) {
  const raw = settings && settings[PACKAGES_KEY]
  if (!raw) return defaultPackages()
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.length && arr.every(isValidPackage)) {
      return arr.map((p) => ({
        id: p.id,
        label: p.label || p.id,
        signer: p.signer,
        docs: [...p.docs],
      }))
    }
  } catch {
    // αγνόησε — πέφτουμε στις προεπιλογές
  }
  return defaultPackages()
}
