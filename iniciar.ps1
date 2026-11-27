param([switch]$Apply, [switch]$Login)
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
if (-not $Apply) {
 Write-Output 'Previa: preparar ferramentas isoladas, dependencias travadas e validar o projeto.'
 Write-Output 'Nenhum download ou alteracao. Para executar: .\iniciar.ps1 -Apply [-Login]'
 exit 0
}
try {
 $config = Get-Content -LiteralPath (Join-Path $projectDir 'config/toolchain.json') -Raw | ConvertFrom-Json
 $asset = $config.artifacts.win32_x64
 if ($config.pixiVersion -ne '0.85.0' -or $asset.url -notlike 'https://github.com/prefix-dev/pixi/releases/download/v0.85.0/pixi-*.zip' -or $asset.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Origem da ferramenta divergente.' }
 $toolDir = Join-Path $projectDir '.runtime/tools/pixi'
 $pixi = Join-Path $toolDir 'pixi.exe'
 $receipt = Join-Path $toolDir 'binary.sha256'
 if (-not (Test-Path -LiteralPath $pixi)) {
  New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
  $stage = Join-Path $toolDir ('install-' + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $stage | Out-Null
  try {
   $archive = Join-Path $stage 'pixi.zip'
   Invoke-WebRequest -UseBasicParsing -Uri $asset.url -OutFile $archive
   if ((Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant() -ne $asset.sha256) { throw 'Checksum da ferramenta divergente.' }
   Expand-Archive -LiteralPath $archive -DestinationPath $stage
   Move-Item -LiteralPath (Join-Path $stage 'pixi.exe') -Destination $pixi
   Set-Content -LiteralPath $receipt -Encoding ascii -Value (Get-FileHash -Algorithm SHA256 -LiteralPath $pixi).Hash.ToLowerInvariant()
  } finally { Remove-Item -LiteralPath $stage -Recurse -Force }
 }
 if (-not (Test-Path -LiteralPath $receipt) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $pixi).Hash.ToLowerInvariant() -ne (Get-Content -LiteralPath $receipt -Raw).Trim()) { throw 'A ferramenta local mudou; concilie antes de continuar.' }
 if ((& $pixi --version) -ne 'pixi 0.85.0') { throw 'Versao da ferramenta divergente.' }
 Push-Location $projectDir
 try {
  & $pixi run --locked node scripts/bootstrap.mjs --automatic
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if ($Login) { & $pixi run --locked node scripts/jm.mjs login; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
 } finally { Pop-Location }
} catch { Write-Error 'O preparo nao terminou. Nenhuma conta ou pagina foi alterada; confira a etapa local indicada.'; exit 1 }
