# ============================================================================
# Bootstrap script for setup-github.ps1
# Pure ASCII so Windows PowerShell 5.1 can parse it without a BOM.
#
# What it does:
#   1) Read setup-github.ps1 as UTF-8
#   2) Re-write it with a UTF-8 BOM so PS 5.1 reads Chinese correctly
#   3) Invoke setup-github.ps1
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\fix-and-run.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'

# Force UTF-8 console output so progress messages display correctly
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding           = [System.Text.Encoding]::UTF8

$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $here 'setup-github.ps1'

if (-not (Test-Path $target)) {
    Write-Host "[ERR] Target file not found: $target" -ForegroundColor Red
    exit 1
}

Write-Host '------------------------------------------'
Write-Host ' Step 1/2: Re-encode setup-github.ps1 as UTF-8 with BOM'
Write-Host '------------------------------------------'

# Read raw bytes, strip an existing BOM if present, decode as UTF-8
$raw = [System.IO.File]::ReadAllBytes($target)
$start = 0
if ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF) {
    $start = 3
    Write-Host '  (file already has BOM, will rewrite to be safe)'
}
$text = [System.Text.Encoding]::UTF8.GetString($raw, $start, $raw.Length - $start)

# Write back with BOM
$utf8bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($target, $text, $utf8bom)

Write-Host '  OK: setup-github.ps1 re-encoded as UTF-8 BOM' -ForegroundColor Green

Write-Host ''
Write-Host '------------------------------------------'
Write-Host ' Step 2/2: Invoke setup-github.ps1'
Write-Host '------------------------------------------'
Write-Host ''

& powershell.exe -ExecutionPolicy Bypass -File $target
exit $LASTEXITCODE
