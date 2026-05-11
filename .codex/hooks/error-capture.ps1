param()

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  $current = Split-Path -Parent $PSScriptRoot
  while ($current -and -not (Test-Path (Join-Path $current ".git"))) {
    $parent = Split-Path -Parent $current
    if ($parent -eq $current) { break }
    $current = $parent
  }
  return $current
}

try {
  $inputJson = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($inputJson)) { exit 0 }

  $payload = $inputJson | ConvertFrom-Json -ErrorAction Stop
  $command = ""
  if ($payload.tool_input -and $payload.tool_input.command) {
    $command = [string]$payload.tool_input.command
  }
  if ($command -notmatch "wrangler") { exit 0 }

  $responseOutput = ""
  $responseError = ""
  if ($payload.tool_response -and $payload.tool_response.output) {
    $responseOutput = [string]$payload.tool_response.output
  }
  if ($payload.tool_response -and $payload.tool_response.error) {
    $responseError = [string]$payload.tool_response.error
  }

  $output = @(
    $responseOutput
    $responseError
  ) -join "`n"

  if ($output -notmatch "(?i)(\[ERROR\]|error:|failed|Authentication error|code:\s*[0-9])") {
    exit 0
  }

  $repoRoot = Get-RepoRoot
  if (-not $repoRoot) { exit 0 }

  $logDir = Join-Path $repoRoot ".agent-memory"
  if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
  }

  $logPath = Join-Path $logDir "deploy-errors.log"
  $matches = ($output -split "`r?`n") |
    Where-Object { $_ -match "(?i)(\[ERROR\]|error:|failed|Authentication error|code:\s*[0-9])" } |
    Select-Object -First 20

  @(
    "============================================================"
    "FEHLER: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
    "BEFEHL: $command"
    "------------------------------------------------------------"
    ($matches -join "`n")
    ""
  ) | Add-Content -Path $logPath -Encoding UTF8

  exit 0
} catch {
  Write-Output "[error-capture] warning: hook failed non-critically: $($_.Exception.Message)"
  exit 0
}
