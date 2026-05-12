param(
  [string]$Mode = ""
)

$ErrorActionPreference = "SilentlyContinue"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$memoryDir = Join-Path $repoRoot ".agent-memory"
$feedbackPath = Join-Path $memoryDir "feedback.md"
$currentTaskPath = Join-Path $memoryDir "current-task.md"
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

function Ensure-TaskFileExists {
  if (Test-Path $currentTaskPath) {
    return
  }

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
  $content = @"
# Current Task Checklist

Last updated: $stamp

## Active Task Checklist

- [ ] Define the first checklist item.

## Completed Task Steps

- [x] Baseline checklist file created.
"@
  Set-Content -Path $currentTaskPath -Value $content -Encoding UTF8
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

function Ensure-SectionInFile([string]$raw, [string]$sectionTitle, [string]$defaultContent) {
  if ($raw -match "(?ms)^##\s+$([regex]::Escape($sectionTitle))") {
    return $raw
  }

  $section = @"

## $sectionTitle

$defaultContent
"@
  return $raw.TrimEnd() + $section
}

function Normalize-TaskText([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  return [regex]::Replace([string]$text, "\s+", " ").Trim().ToLowerInvariant()
}

function Update-CurrentTaskFromPrompt([string]$content) {
  if ([string]::IsNullOrWhiteSpace($content)) {
    return
  }

  Ensure-TaskFileExists

  $raw = Get-Content -Raw -Path $currentTaskPath -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($raw)) {
    $raw = "# Current Task Checklist`r`nLast updated: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz") + "`r`n"
  }

  $raw = Ensure-SectionInFile $raw "Active Task Checklist" "- [ ] Add an item."
  $raw = Ensure-SectionInFile $raw "Completed Task Steps" "- [x] Baseline step."

  $activeItems = @()
  $completedItems = @()
  foreach ($line in ($content -split "`r?`n")) {
    $match = $line | Select-String -Pattern '^\s*-\s*\[([ xX])\]\s*(.+)\s*$'
    if (-not $match) {
      continue
    }

    $mark = $match.Matches[0].Groups[1].Value
    $text = [string]$match.Matches[0].Groups[2].Value
    $clean = [regex]::Replace($text, "\s+", " ").Trim()
    if ([string]::IsNullOrWhiteSpace($clean)) {
      continue
    }

    if ($mark.ToLower() -eq "x") {
      $completedItems += $clean
    } else {
      $activeItems += $clean
    }
  }

  if ($activeItems.Count -eq 0 -and $completedItems.Count -eq 0) {
    return
  }

  $existing = Get-Content -Path $currentTaskPath -ErrorAction SilentlyContinue
  foreach ($item in $completedItems) {
    $target = Normalize-TaskText $item
    $already = $existing | Where-Object {
      $_ -match '^\s*-\s*\[[xX]\]\s*(.+)\s*$' -and (Normalize-TaskText $Matches[1]) -eq $target
    }
    if ($already.Count -gt 0) {
      continue
    }

    $raw = [regex]::Replace(
      $raw,
      "(?ms)(^##\s+Completed Task Steps.*?)(?=^\s*##\s+|\z)",
      "`$1`r`n- [x] $item"
    )
  }

  foreach ($item in $activeItems) {
    $target = Normalize-TaskText $item
    $already = $existing | Where-Object {
      $_ -match '^\s*-\s*\[[ xX]\]\s*(.+)\s*$' -and (Normalize-TaskText $Matches[1]) -eq $target
    }
    if ($already.Count -gt 0) {
      continue
    }

    $raw = [regex]::Replace(
      $raw,
      "(?ms)(^##\s+Active Task Checklist.*?)(?=^\s*##\s+|\z)",
      "`$1`r`n- [ ] $item"
    )
  }

  $raw = [regex]::Replace(
    $raw,
    "(?m)^Last updated:.*$",
    "Last updated: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")
  )

  Set-Content -Path $currentTaskPath -Value $raw -Encoding UTF8
}

function Get-PayloadText([pscustomobject]$payload) {
  $textCandidates = @(
    $payload.prompt,
    $payload.message,
    $payload.input,
    $payload.text,
    $payload.comment,
    $payload.feedback,
    $payload.body
  )

  foreach ($candidate in $textCandidates) {
    if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
      return [string]$candidate
    }
  }

  return ""
}

function Get-FeedbackCategory([pscustomobject]$payload, [string]$content) {
  $rawType = ""
  foreach ($property in @("category", "kind", "feedback_type", "feedbackType", "source", "channel")) {
    $value = $payload.$property
    if (-not [string]::IsNullOrWhiteSpace([string]$value)) {
      $rawType = [string]$value
      break
    }
  }

  if ($rawType -match "(?i)browser") {
    return "Browser-Feedback"
  }
  if ($rawType -match "(?i)diff|review|comment") {
    return "Diff-Kommentar"
  }
  if ($content -match "(?i)Browser-Feedback|Browser feedback|Browserfeedback|Browser QA") {
    return "Browser-Feedback"
  }
  if ($content -match "(?i)Diff[- ]?Kommentar|review comment|Code review|PR comment|Diff Kommentar") {
    return "Diff-Kommentar"
  }

  return "Owner-Feedback"
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
Current task status is tracked in `.agent-memory/current-task.md`.
Owner and browser feedback are persisted in `.agent-memory/feedback.md`.

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
  Ensure-TaskFileExists
  Update-HandoffFile

  if (-not (Test-Path $memoryDir)) {
    return
  }

  if (Test-Path $currentStatePath) {
    Update-SectionInFile -path $currentStatePath -sectionTitle "Known Remaining Work" -line "Stop-Hook refreshed memory snapshot and references current-task/checklist handoff continuity."
  }
  if (Test-Path $nextStepsPath) {
    Update-SectionInFile -path $nextStepsPath -sectionTitle "Immediate" -line "Stop-Hook refreshed memory snapshot and current-task/checklist continuity."
  }
}

function Test-IsInternalSignal([string]$content) {
  if ([string]::IsNullOrWhiteSpace($content)) {
    return $false
  }

  $internalPatterns = @(
    "Rolle:\s*(Dev-Agent|QA-Agent|Critic-Agent|UX-Agent|UI-Agent|Science-Agent|Feature-Agent|Mobile-Agent|Persona-Agent|Orchestrator)",
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
      return $true
    }
  }

  return $false
}

function Capture-OwnerFeedback([string]$rawPayload) {
  if ([string]::IsNullOrWhiteSpace($rawPayload)) {
    return $false
  }

  try {
    $payload = $rawPayload | ConvertFrom-Json
    $content = Get-PayloadText $payload
    if ([string]::IsNullOrWhiteSpace($content)) {
      return $false
    }
    $safe = [System.Text.RegularExpressions.Regex]::Replace([string]$content, "\s+", " ")
    if (Test-IsInternalSignal -content $safe) {
      return $false
    }

    $category = Get-FeedbackCategory $payload $safe
    Append-Feedback -path $feedbackPath -line (Format-Entry "${category}: $safe")
    Update-CurrentTaskFromPrompt -content $content
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
      Update-ProgressBlock "Captured user feedback on UserPromptSubmit."
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
