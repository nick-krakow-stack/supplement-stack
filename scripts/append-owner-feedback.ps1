param(
  [Parameter(Mandatory = $true)]
  [string]$Text,

  [string]$Source = "manual",

  [switch]$PassThru
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  $current = (Get-Location).Path
  while ($current -and -not (Test-Path (Join-Path $current ".git"))) {
    $parent = Split-Path -Parent $current
    if ($parent -eq $current) { break }
    $current = $parent
  }
  return $current
}

function Escape-CodeFence {
  param([string]$Value)
  return ($Value -replace '```', '````')
}

$repoRoot = Get-RepoRoot
if (-not $repoRoot) {
  throw "Repository root could not be resolved."
}

$memoryDir = Join-Path $repoRoot ".agent-memory"
if (-not (Test-Path $memoryDir)) {
  New-Item -ItemType Directory -Path $memoryDir | Out-Null
}

$feedbackPath = Join-Path $memoryDir "owner-feedback.md"
if (-not (Test-Path $feedbackPath)) {
  @(
    "# Pending Owner Feedback"
    ""
    "Durable capture for owner browser QA, diff feedback, and multi-change website/admin requests that must survive context compression."
    ""
    "Automatic capture comes from the UserPromptSubmit hook when prompt text is available."
    'Manual fallback: `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/append-owner-feedback.ps1 -Text "<feedback>"`.'
    ""
    "## Pending Entries"
    ""
  ) | Set-Content -Path $feedbackPath -Encoding UTF8
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
$entry = @(
  "### $timestamp - Manual Capture"
  ""
  "- Source: $Source"
  "- Status: pending triage"
  ""
  '```text'
  (Escape-CodeFence -Value $Text)
  '```'
  ""
)

$entry | Add-Content -Path $feedbackPath -Encoding UTF8
if ($PassThru) {
  Write-Output "Appended feedback to .agent-memory/owner-feedback.md"
}
