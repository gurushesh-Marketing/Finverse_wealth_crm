param(
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$dataDirectory = Join-Path $repositoryRoot '.data\postgres-native'
$logPath = Join-Path $repositoryRoot '.data\postgres-native.log'
$pgCtl = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw 'PostgreSQL 18 pg_ctl.exe was not found on this workstation.'
}
if (-not (Test-Path -LiteralPath $dataDirectory)) {
  throw 'The project-local PostgreSQL cluster is missing. Restore it from the local backup before starting the CRM.'
}

if ($Action -eq 'status') {
  & $pgCtl status -D $dataDirectory
  exit $LASTEXITCODE
}

if ($Action -eq 'stop') {
  & $pgCtl stop -D $dataDirectory -m fast
  exit $LASTEXITCODE
}

& $pgCtl status -D $dataDirectory *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output 'Project-local PostgreSQL is already running on port 15432.'
  exit 0
}

$serverOptions = '-p 15432 -h 127.0.0.1'
& $pgCtl start -D $dataDirectory -l $logPath -o $serverOptions
if ($LASTEXITCODE -ne 0) {
  if (Test-Path -LiteralPath $logPath) {
    Get-Content -LiteralPath $logPath -Tail 30
  }
  exit $LASTEXITCODE
}

Write-Output 'Project-local PostgreSQL started on port 15432.'
