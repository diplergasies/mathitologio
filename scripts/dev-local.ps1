# Δοκιμή του branch στον υπολογιστή, χωρίς release.
# Δεν κάνει git tag, git push, npm run dist ή electron-builder.
# PowerShell 5.1: το αρχείο πρέπει να μείνει σε UTF-8 με BOM (ελληνικά στο path).

$ErrorActionPreference = "Continue"
$env:PATH = "C:\Users\katsa\nodejs;" + $env:PATH

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Εκκίνηση δοκιμής χωρίς release."

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "Δεν βρέθηκε το Node. Αναμενόταν στο C:\Users\katsa\nodejs"
  exit 1
}

$installed = Get-Process -ErrorAction SilentlyContinue | Where-Object {
  $_.ProcessName -eq "Μαθητολόγιο ΣΕΠ" -or $_.ProcessName -eq "Μαθητολόγιο"
}
if ($installed) {
  Write-Host "Η εγκατεστημένη εφαρμογή τρέχει. Κλείσε την και ξανατρέξε το task, ώστε να μην γράψουν και οι δύο στην ίδια βάση."
  exit 1
}

$data = Join-Path $env:APPDATA "Μαθητολόγιο"
$stamp = Get-Date -Format "yyyy-MM-dd"
$backup = "$data.backup-$stamp"
if (Test-Path -LiteralPath $data) {
  if (Test-Path -LiteralPath $backup) {
    Write-Host "Υπάρχει ήδη αντίγραφο: $backup"
  } else {
    Write-Host "Αντίγραφο δεδομένων: $backup"
    Copy-Item -LiteralPath $data -Destination $backup -Recurse
  }
} else {
  Write-Host "Δεν βρέθηκε φάκελος δεδομένων (θα δημιουργηθεί στην εκκίνηση): $data"
}

$branch = "ekkremmotites"
git fetch origin $branch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git diff --quiet
if ($LASTEXITCODE -ne 0) {
  Write-Host "Υπάρχουν τοπικές αλλαγές. Δεν αλλάζω branch."
  exit 1
}
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  Write-Host "Υπάρχουν staged αλλαγές. Δεν αλλάζω branch."
  exit 1
}

git checkout $branch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git pull --ff-only origin $branch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Άνοιγμα εφαρμογής σε dev. Κλείσιμο με Ctrl+C."
npm run dev
exit $LASTEXITCODE
