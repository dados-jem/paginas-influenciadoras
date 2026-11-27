$ErrorActionPreference = 'Stop'
$pixi = Join-Path $PSScriptRoot '.runtime/tools/pixi/pixi.exe'
$receipt = Join-Path $PSScriptRoot '.runtime/tools/pixi/binary.sha256'
if (-not (Test-Path -LiteralPath $pixi) -or -not (Test-Path -LiteralPath $receipt)) { Write-Error 'Execute primeiro: .\iniciar.ps1 -Apply'; exit 2 }
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $pixi).Hash.ToLowerInvariant() -ne (Get-Content -LiteralPath $receipt -Raw).Trim()) { Write-Error 'Ferramenta local divergente.'; exit 2 }
Push-Location $PSScriptRoot
try { & $pixi run --locked node scripts/jm.mjs @args; exit $LASTEXITCODE } finally { Pop-Location }
