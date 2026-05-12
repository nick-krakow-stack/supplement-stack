param(
  [string]$Mode = ""
)

$ErrorActionPreference = "SilentlyContinue"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$memoryDir = Join-Path $repoRoot ".agent-memory"
$feedbackPath = Join-Path $memoryDir "feedback.md"
$handoffPath = Join-Path $memoryDir "handoff.md"
$currentStatePath = Join-Path $memoryDir "current-state.md"
$nextStepsPath = Join-Path $memoryDir "next-steps.md"
$progressPath = Join-Path $memoryDir "progress.md"

function Get-HookEvent {
  param([string[]]$ArgsInput, [string]$Stdin)

  $candidateValues = @(
    $env:CODex_HOOK_EVENT
    $env:HOOK_EVENT
    $env:CODEX_HOOK_EVENT
    $env:CLAUDE_HOOK_EVENT
    $env:AGENT_HOOK_EVENT
    $env:CLAUDE_TOOL_USE_EVENT
    $ArgsInput[0]
  )

  foreach ($value in $candidateValues) {
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($Stdin)) {
    try {
      $payload = $Stdin | ConvertFrom-Json -ErrorAction Stop
      foreach ($prop in @("event", "type", "hook", "name")) {
        $candidate = $payload.$prop
        if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
          return [string]$candidate
        }
      }
    } catch {
      # ignore payload that cannot be parsed as JSON
    }
  }

  return $Mode
}

function Format-Entry([string]$text) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
  return "$timestamp - $text"
}

function Append-Feedback([string]$path, [string]$line) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  Add-Content -Path $path -Value $line -Encoding UTF8
}

function Update-ProgressBlock([string]$entry) {
  $stamp = Format-Entry $entry
  $line = "- $stamp"

  if (-not (Test-Path $progressPath)) {
    $content = @"
# Progress

$line
"@
    Set-Content -Path $progressPath -Value $content -Encoding UTF8
    return
  }

  Add-Content -Path $progressPath -Value $line -Encoding UTF8
}

function Update-SectionInFile([string]$path, [string]$sectionTitle, [string]$line) {
  if (-not (Test-Path $path)) {
    return
  }

  $raw = Get-Content -Raw -Path $path -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return
  }

  $marker = "## " + $sectionTitle
  if ($raw -notmatch [regex]::Escape($marker)) {
    return
  }

  $stampedLine = "- " + (Format-Entry $line)
  $pattern = "(?ms)^##\\s+" + [regex]::Escape($sectionTitle) + ".*?(\\r?\\n##|\\z)"
  $match = [regex]::Match($raw, $pattern)
  if (-not $match.Success) {
    return
  }

  $block = $match.Value
  $updated = $block + "`r`n" + $stampedLine
  $updatedRaw = $raw.Replace($block, $updated)
  Set-Content -Path $path -Value $updatedRaw -Encoding UTF8
}

function Update-HandoffFile {
  if (-not (Test-Path $memoryDir)) {
    New-Item -ItemType Directory -Path $memoryDir | Out-Null
  }

  Push-Location $repoRoot
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
  $branch = git rev-parse --abbrev-ref HEAD 2>$null
  $commit = git log -1 --oneline 2>$null
  $statusLines = @(git status --short 2>$null)
  Pop-Location

  $statusBlock = if ($statusLines.Count -gt 0) {
    ($statusLines | Select-Object -First 80) -join "`n"
  } else {
    "Clean working tree."
  }

  $content = @"
# Handoff

Last updated: $timestamp
Update mode: Stop

## Latest Notes

Automatic handoff snapshot written by `.codex/hooks/agent-protocol.ps1`.

## Git Snapshot

- Branch: $branch
- Last commit: $commit

## Working Tree

~~~text
$statusBlock
~~~

## Current State Summary

See `.agent-memory/current-state.md`.

## Next Planned Work

See `.agent-memory/next-steps.md`.

## Required Startup For Next Agent

1. Read `AGENTS.md`.
2. Read `.agent-memory/current-state.md`.
3. Read this handoff.
4. Read `.agent-memory/next-steps.md`.
5. Run `git status --short`.

## Constraints

- Do not write secrets, tokens, passwords, or raw credential values into memory files.
- Use code and migrations as final source of truth if docs conflict.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
"@

  Set-Content -Path $handoffPath -Value $content -Encoding UTF8
}

function Update-MemoryAfterStop {
  Update-HandoffFile

  if (-not (Test-Path $memoryDir)) {
    return
  }

  if (Test-Path $currentStatePath) {
    Update-SectionInFile -path $currentStatePath -sectionTitle "Known Remaining Work" -line "Codex-Hook-Regelwerk: zentrale Hooks aktiv (UserPromptSubmit, Stop). Claude-Hooks deaktiviert; kein aktives Claude-Hooking."
  }
  if (Test-Path $nextStepsPath) {
    Update-SectionInFile -path $nextStepsPath -sectionTitle "Immediate" -line "Stop-Hook: Memory-Handoff-Progress-Snapshot aktualisiert."
  }
}

function Test-IsOwnerFeedback([string]$content) {
  if ([string]::IsNullOrWhiteSpace($content)) {
    return $false
  }

  $internalPatterns = @(
    "Rolle:\s*(Dev-Agent|QA-Agent|Critic-Agent|UX-Agent|UI-Agent|Science-Agent|Feature-Agent|Mobile-Agent|Persona-Agent)",
    "Du bist nicht allein im Codebase",
    "Repository:\s*C:\\Users\\email\\supplement-stack",
    "Pflichtstart:",
    "Nicht committen\.",
    "Antworte mit ge[aä]nderten Dateien",
    "subagent_notification",
    "agent_path"
  )

  foreach ($pattern in $internalPatterns) {
    if ($content -match $pattern) {
      return $false
    }
  }

  return $true
}

function Capture-OwnerFeedback([string]$rawPayload) {
  if ([string]::IsNullOrWhiteSpace($rawPayload)) {
    return $false
  }

  try {
    $payload = $rawPayload | ConvertFrom-Json
    $content = $payload.prompt
    if ([string]::IsNullOrWhiteSpace($content)) {
      $content = $payload.message
    }
    if ([string]::IsNullOrWhiteSpace($content)) {
      $content = $payload.input
    }
    if ([string]::IsNullOrWhiteSpace($content)) {
      return $false
    }
    $safe = [System.Text.RegularExpressions.Regex]::Replace([string]$content, "\s+", " ")
    if (-not (Test-IsOwnerFeedback -content $safe)) {
      return $false
    }
    Append-Feedback -path $feedbackPath -line (Format-Entry "Owner-Feedback: $safe")
    return $true
  } catch {
    # no-op if payload is not JSON
    return $false
  }
}

try {
  $stdin = [Console]::In.ReadToEnd()
} catch {
  $stdin = ""
}

$event = Get-HookEvent -ArgsInput $args -Stdin $stdin

if ([string]::IsNullOrWhiteSpace($event)) {
  return
}

switch ($event) {
  "UserPromptSubmit" {
    if (Capture-OwnerFeedback -rawPayload $stdin) {
      Update-ProgressBlock "Captured owner feedback on UserPromptSubmit."
    }
  }
  "Stop" {
    Update-ProgressBlock "Stop hook ran and refreshed central memory snapshot."
    Update-MemoryAfterStop
  }
  default {
    # keep no-op for non-configured events
  }
}
