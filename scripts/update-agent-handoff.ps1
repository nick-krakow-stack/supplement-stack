param(
  [string]$Mode = "manual",
  [string]$Notes = ""
)

$ErrorActionPreference = "SilentlyContinue"

$repoRoot = Split-Path -Parent $PSScriptRoot
$memoryDir = Join-Path $repoRoot ".agent-memory"
$handoffPath = Join-Path $memoryDir "handoff.md"

if (-not (Test-Path $memoryDir)) {
  New-Item -ItemType Directory -Path $memoryDir | Out-Null
}

Push-Location $repoRoot

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
$branch = git rev-parse --abbrev-ref HEAD 2>$null
$commit = git log -1 --oneline 2>$null
$statusLines = @(git status --short 2>$null)
$changedFiles = @()

foreach ($line in $statusLines) {
  if ($line.Length -ge 4) {
    $changedFiles += $line.Trim()
  }
}

$nextStepsPath = Join-Path $memoryDir "next-steps.md"
$currentStatePath = Join-Path $memoryDir "current-state.md"

$nextSummary = @()
if (Test-Path $nextStepsPath) {
  $nextSummary = Get-Content $nextStepsPath | Where-Object {
    $_ -match "^(##|###|Goal:|Add a new|Wire all|Implement server|Recommended|Important:|- )"
  } | Select-Object -First 35
}

$stateSummary = @()
if (Test-Path $currentStatePath) {
  $stateSummary = Get-Content $currentStatePath | Where-Object {
    $_ -match "^(## Current Phase|Phase B|Phase C|## Current Code Shape|- )"
  } | Select-Object -First 25
}

if ([string]::IsNullOrWhiteSpace($Notes)) {
  $Notes = "Automatic handoff snapshot written by scripts/update-agent-handoff.ps1."
}

$statusBlock = if ($changedFiles.Count -gt 0) {
  ($changedFiles | Select-Object -First 80) -join "`n"
} else {
  "Clean working tree."
}

$nextBlock = if ($nextSummary.Count -gt 0) {
  $nextSummary -join "`n"
} else {
  "See .agent-memory/next-steps.md."
}

$stateBlock = if ($stateSummary.Count -gt 0) {
  $stateSummary -join "`n"
} else {
  "See .agent-memory/current-state.md."
}

$content = @"
# Handoff

Last updated: $timestamp
Update mode: $Mode

## Latest Notes

$Notes

## Git Snapshot

- Branch: $branch
- Last commit: $commit

## Working Tree

~~~text
$statusBlock
~~~

## Current State Summary

$stateBlock

## Next Planned Work

$nextBlock

## Required Startup For Next Agent

1. Read ``AGENTS.md``.
2. Read ``CLAUDE.md``.
3. Read ``.agent-memory/current-state.md``.
4. Read this handoff.
5. Read ``.agent-memory/next-steps.md``.
6. Run ``git status --short``.

## Constraints

- Do not write secrets, tokens, passwords, or raw credential values into memory files.
- Do not touch the old ``recommendations`` table during Phase C.
- Use ``dose_recommendations`` for dosage recommendations.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
- Review untracked files before deleting or committing them.
"@

Set-Content -Path $handoffPath -Value $content -Encoding UTF8

Pop-Location

Write-Output "Updated .agent-memory/handoff.md ($Mode)"
