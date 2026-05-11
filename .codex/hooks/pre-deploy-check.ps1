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

function Get-HookCommand {
  $inputJson = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($inputJson)) { return "" }

  try {
    $payload = $inputJson | ConvertFrom-Json -ErrorAction Stop
    $command = $payload.tool_input.command
    if ($command -is [string]) { return $command }
  } catch {
    return ""
  }

  return ""
}

try {
  $command = Get-HookCommand
  if ($command -notmatch "wrangler.*(pages\s+deploy|d1\s+migrations\s+apply|\sdeploy\b)") {
    exit 0
  }

  $repoRoot = Get-RepoRoot
  if (-not $repoRoot) {
    Write-Output "[pre-deploy] Repository root could not be resolved."
    exit 2
  }

  Push-Location $repoRoot

  Write-Output ""
  Write-Output "[pre-deploy] Cloudflare deployment checklist"

  $errors = 0

  if (Test-Path "wrangler.toml") {
    Write-Output "[pre-deploy] ok: wrangler.toml exists"
  } else {
    Write-Output "[pre-deploy] error: wrangler.toml is missing"
    $errors += 1
  }

  if (Test-Path "wrangler.toml") {
    $wranglerToml = Get-Content -Path "wrangler.toml" -Raw
    if ($wranglerToml -match "\[\[d1_databases\]\]") {
      Write-Output "[pre-deploy] ok: D1 binding configured"
    } else {
      Write-Output "[pre-deploy] warning: no D1 binding found in wrangler.toml"
    }
  }

  $migrationCount = @(Get-ChildItem -Path "d1-migrations" -Filter "*.sql" -ErrorAction SilentlyContinue).Count
  Write-Output "[pre-deploy] info: $migrationCount migration files found"

  if (Test-Path "frontend/dist") {
    Write-Output "[pre-deploy] ok: frontend/dist exists"
  } else {
    Write-Output "[pre-deploy] warning: frontend/dist missing; run frontend build before Pages deploy"
  }

  Write-Output "[pre-deploy] reminder: verify Cloudflare Pages secrets before production deploy"

  Pop-Location

  if ($errors -gt 0) { exit 2 }
  exit 0
} catch {
  Write-Output "[pre-deploy] warning: hook check failed non-critically: $($_.Exception.Message)"
  exit 0
}
