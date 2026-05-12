param(
  [string]$Event = "manual"
)

$ErrorActionPreference = "Stop"

# Centralized hook responsibilities:
# - Preserve the Orchestrator/Sub-Agent protocol reminder without writing
#   normal hook output that the Codex App may treat as invalid JSON/noise.
# - Capture owner browser QA, diff comments, and multi-point website/admin
#   feedback in .agent-memory/owner-feedback.md so context compression does not
#   lose pending requests.
# - Retain Cloudflare/Wrangler pre-deploy checks as durable log output in
#   .agent-memory/pre-deploy-check.log when the corresponding event is used.
# - Retain Wrangler deploy error capture in .agent-memory/deploy-errors.log
#   when the corresponding event is used.
# - Retain handoff/memory updates before context compaction through
#   Update-Handoff. The event can be wired again later or run manually.
# - Write Stop and PreCompact snapshots with completed work, open work, next
#   steps, and checks/status into durable memory without stdout/stderr output.

function Get-RepoRoot {
  $current = Split-Path -Parent $PSScriptRoot
  while ($current -and -not (Test-Path (Join-Path $current ".git"))) {
    $parent = Split-Path -Parent $current
    if ($parent -eq $current) { break }
    $current = $parent
  }
  return $current
}

function Ensure-MemoryDir {
  param([string]$RepoRoot)
  $memoryDir = Join-Path $RepoRoot ".agent-memory"
  if (-not (Test-Path $memoryDir)) {
    New-Item -ItemType Directory -Path $memoryDir | Out-Null
  }
  return $memoryDir
}

function Read-HookPayload {
  $inputJson = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($inputJson)) { return $null }
  try { return $inputJson | ConvertFrom-Json -ErrorAction Stop } catch { return $null }
}

function Get-StringProperty {
  param([object]$Value, [string[]]$Names)
  if ($null -eq $Value) { return "" }
  foreach ($name in $Names) {
    if ($Value.PSObject.Properties.Name -contains $name) {
      $candidate = $Value.$name
      if ($candidate -is [string] -and -not [string]::IsNullOrWhiteSpace($candidate)) {
        return $candidate
      }
    }
  }
  return ""
}

function Get-HookCommand {
  param([object]$Payload)
  if ($null -eq $Payload) { return "" }
  if ($Payload.PSObject.Properties.Name -contains "tool_input") {
    $command = Get-StringProperty -Value $Payload.tool_input -Names @("command")
    if ($command) { return $command }
  }
  return Get-StringProperty -Value $Payload -Names @("command")
}

function Get-PromptText {
  param([object]$Payload)
  $names = @("prompt", "user_prompt", "userPrompt", "message", "text", "input")
  $direct = Get-StringProperty -Value $Payload -Names $names
  if ($direct) { return $direct }
  foreach ($propertyName in @("tool_input", "hook_input", "event", "payload", "request")) {
    if ($Payload -and $Payload.PSObject.Properties.Name -contains $propertyName) {
      $nested = Get-StringProperty -Value $Payload.$propertyName -Names $names
      if ($nested) { return $nested }
    }
  }
  return ""
}

function Get-ListProperty {
  param([object]$Value, [string[]]$Names)
  if ($null -eq $Value) { return @() }
  foreach ($name in $Names) {
    if ($Value.PSObject.Properties.Name -contains $name) {
      $candidate = $Value.$name
      if ($candidate -is [string] -and -not [string]::IsNullOrWhiteSpace($candidate)) {
        return @($candidate)
      }
      if ($candidate -is [System.Array]) {
        return @($candidate | ForEach-Object { "$_" } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
      }
    }
  }
  foreach ($propertyName in @("hook_input", "event", "payload", "request", "summary")) {
    if ($Value.PSObject.Properties.Name -contains $propertyName) {
      $nested = Get-ListProperty -Value $Value.$propertyName -Names $Names
      if ($nested.Count -gt 0) { return $nested }
    }
  }
  return @()
}

function Format-SnapshotList {
  param([string[]]$Items, [string]$Fallback)
  if ($Items.Count -eq 0) { return "- $Fallback" }
  return (($Items | ForEach-Object { "- $_" }) -join "`n")
}

function Ensure-ProgressSnapshotFile {
  param([string]$MemoryDir)
  $snapshotPath = Join-Path $MemoryDir "progress-snapshots.md"
  if (-not (Test-Path $snapshotPath)) {
    @(
      "# Progress Snapshots",
      "",
      "Durable Stop and PreCompact snapshots for turn/task progress that must survive context compression.",
      "",
      "Use this file for efficient recent progress snapshots. Move durable completed project state into `.agent-memory/current-state.md`, exact continuation context into `.agent-memory/handoff.md`, and durable next steps into `.agent-memory/next-steps.md`.",
      "",
      "Each snapshot should preserve completed work, open work, next steps, and checks/status.",
      "",
      "## Snapshots",
      ""
    ) | Set-Content -Path $snapshotPath -Encoding UTF8
  }
  return $snapshotPath
}

function New-MemorySnapshot {
  param([string]$RepoRoot, [object]$Payload, [string]$Mode)
  Push-Location $RepoRoot
  try {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    $commit = git log -1 --oneline 2>$null
    $statusLines = @(git status --short 2>$null)
    $statusBlock = if ($statusLines.Count -gt 0) { ($statusLines | Select-Object -First 80) -join "`n" } else { "Clean working tree." }
  } finally {
    Pop-Location
  }

  $completed = Get-ListProperty -Value $Payload -Names @("completed", "completed_work", "done", "progress")
  $open = Get-ListProperty -Value $Payload -Names @("open", "open_work", "open_items", "pending", "remaining")
  $nextSteps = Get-ListProperty -Value $Payload -Names @("next_steps", "nextSteps", "next", "todo")
  $checks = Get-ListProperty -Value $Payload -Names @("checks_status", "checksStatus", "checks", "status", "verification")

  $completedBlock = Format-SnapshotList -Items $completed -Fallback "No structured completed-work notes were provided by the hook payload; review the git snapshot and recent conversation."
  $openBlock = Format-SnapshotList -Items $open -Fallback "No structured open-work notes were provided by the hook payload; preserve unresolved items in next-steps when known."
  $nextBlock = Format-SnapshotList -Items $nextSteps -Fallback "No structured next steps were provided by the hook payload; keep `.agent-memory/next-steps.md` as the durable priority source."
  $checksBlock = Format-SnapshotList -Items $checks -Fallback "No structured checks/status were provided by the hook payload; run verification before claiming completion."

  return @"
## Snapshot: $Mode

### Completed
$completedBlock

### Open
$openBlock

### Next Steps
$nextBlock

### Checks/Status
$checksBlock

### Git Snapshot

- Branch: $branch
- Last commit: $commit

~~~text
$statusBlock
~~~
"@
}

function Add-ProgressSnapshot {
  param([string]$MemoryDir, [string]$Snapshot)
  $snapshotPath = Ensure-ProgressSnapshotFile -MemoryDir $MemoryDir
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
  @(
    "### $timestamp",
    "",
    $Snapshot,
    ""
  ) | Add-Content -Path $snapshotPath -Encoding UTF8
}

function Test-IsOwnerFeedback {
  param([string]$PromptText)
  if ([string]::IsNullOrWhiteSpace($PromptText)) { return $false }
  $agentRolePattern = "(?i)\bDu bist\s+(?:Dev|QA|Critic|Science|Feature|UX|UI|Mobile|Persona|Legal|Explorer)(?:-Agent)?\b"
  $internalDelegationPattern = "(?is)(Workspace:\s*\S+.*$agentRolePattern|$agentRolePattern.*(?:Du bist nicht allein im Codebase|Aufgabe:|Workspace:))"
  if ($PromptText -match $internalDelegationPattern) { return $false }
  $feedbackPattern = "(?i)(browser|screenshot|diff|feedback|owner|review|kommentar|aenderung|admin|administrator|dashboard|website|demo|stack)"
  if ($PromptText -notmatch $feedbackPattern) { return $false }
  $listMarkers = ([regex]::Matches($PromptText, "(?m)^\s*(-|\*|\d+[\.)])\s+")).Count
  $changeWords = ([regex]::Matches($PromptText, "(?i)\b(change|fix|adjust|update|remove|add|rename|move|polish|aendern|fixen|hinzufuegen|entfernen|umbenennen)\b")).Count
  return (
    $PromptText -match "(?i)(browser|screenshot|diff|feedback|owner|kommentar)" -or
    (($PromptText -match "(?i)(website|admin|administrator|dashboard|demo|stack)") -and ($listMarkers -ge 2 -or $changeWords -ge 2))
  )
}

function Escape-CodeFence {
  param([string]$Text)
  return ($Text -replace '```', '````')
}

function Ensure-OwnerFeedbackFile {
  param([string]$MemoryDir)
  $feedbackPath = Join-Path $MemoryDir "owner-feedback.md"
  if (-not (Test-Path $feedbackPath)) {
    @(
      "# Pending Owner Feedback",
      "",
      "Durable capture for owner browser QA, diff feedback, and multi-change website/admin requests that must survive context compression.",
      "",
      "Automatic capture comes from the UserPromptSubmit hook when prompt text is available.",
      'Manual fallback: `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/append-owner-feedback.ps1 -Text "<feedback>"`.',
      "",
      "Use this file for pending owner feedback only. Move completed work into `.agent-memory/current-state.md` or `.agent-memory/handoff.md` when it is implemented, verified, or explicitly deferred.",
      "",
      "## Pending Entries",
      ""
    ) | Set-Content -Path $feedbackPath -Encoding UTF8
  }
  return $feedbackPath
}

function Add-OwnerFeedback {
  param([string]$MemoryDir, [string]$Text, [string]$Source)
  if ([string]::IsNullOrWhiteSpace($Text)) { return }
  $feedbackPath = Ensure-OwnerFeedbackFile -MemoryDir $MemoryDir
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
  @(
    "### $timestamp - $Source",
    "",
    "- Source: $Source",
    "- Status: pending triage",
    "",
    '```text',
    (Escape-CodeFence -Text $Text),
    '```',
    ""
  ) | Add-Content -Path $feedbackPath -Encoding UTF8
}

function Add-ProtocolLog {
  param([string]$MemoryDir, [string]$EventName, [string]$Command)
  # agent-protocol.log is intentionally named here for regression coverage, but
  # normal hook runs must not dirty the worktree with a log file.
  return
  $logPath = Join-Path $MemoryDir "agent-protocol.log"
  @(
    "============================================================",
    "EVENT: $EventName",
    "TIME: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
    "COMMAND: $Command",
    "RULES:",
    "- Orchestrator plans/delegates/reviews.",
    "- Implementation must be delegated to the responsible Sub-Agent.",
    "- Dev-Agent owns code/file edits.",
    "- Owner browser/diff/multi-point feedback belongs in .agent-memory/owner-feedback.md.",
    ""
  ) | Add-Content -Path $logPath -Encoding UTF8
}

function Add-PreDeployLog {
  param([string]$RepoRoot, [string]$MemoryDir, [string]$Command)
  if ($Command -notmatch "wrangler.*(pages\s+deploy|d1\s+migrations\s+apply|\sdeploy\b)") { return }
  Push-Location $RepoRoot
  try {
    $messages = @("[pre-deploy] Cloudflare deployment checklist")
    $messages += if (Test-Path "wrangler.toml") { "[pre-deploy] ok: wrangler.toml exists" } else { "[pre-deploy] error: wrangler.toml is missing" }
    if (Test-Path "wrangler.toml") {
      $wranglerToml = Get-Content -Path "wrangler.toml" -Raw
      $messages += if ($wranglerToml -match "\[\[d1_databases\]\]") { "[pre-deploy] ok: D1 binding configured" } else { "[pre-deploy] warning: no D1 binding found in wrangler.toml" }
    }
    $migrationCount = @(Get-ChildItem -Path "d1-migrations" -Filter "*.sql" -ErrorAction SilentlyContinue).Count
    $messages += "[pre-deploy] info: $migrationCount migration files found"
    $messages += if (Test-Path "frontend/dist") { "[pre-deploy] ok: frontend/dist exists" } else { "[pre-deploy] warning: frontend/dist missing; run frontend build before Pages deploy" }
    $messages += "[pre-deploy] reminder: verify Cloudflare Pages secrets before production deploy"
    $logPath = Join-Path $MemoryDir "pre-deploy-check.log"
    @(
      "============================================================",
      "CHECK: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
      "COMMAND: $Command",
      "------------------------------------------------------------",
      ($messages -join "`n"),
      ""
    ) | Add-Content -Path $logPath -Encoding UTF8
  } finally {
    Pop-Location
  }
}

function Add-ErrorCapture {
  param([string]$MemoryDir, [object]$Payload, [string]$Command)
  if ($Command -notmatch "wrangler") { return }
  $responseOutput = ""
  $responseError = ""
  if ($Payload -and $Payload.PSObject.Properties.Name -contains "tool_response") {
    $responseOutput = Get-StringProperty -Value $Payload.tool_response -Names @("output")
    $responseError = Get-StringProperty -Value $Payload.tool_response -Names @("error")
  }
  $output = @($responseOutput, $responseError) -join "`n"
  if ($output -notmatch "(?i)(\[ERROR\]|error:|failed|Authentication error|code:\s*[0-9])") { return }
  $matches = ($output -split "`r?`n") | Where-Object { $_ -match "(?i)(\[ERROR\]|error:|failed|Authentication error|code:\s*[0-9])" } | Select-Object -First 20
  $logPath = Join-Path $MemoryDir "deploy-errors.log"
  @(
    "============================================================",
    "FEHLER: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
    "BEFEHL: $Command",
    "------------------------------------------------------------",
    ($matches -join "`n"),
    ""
  ) | Add-Content -Path $logPath -Encoding UTF8
}

function Update-Handoff {
  param([string]$RepoRoot, [string]$MemoryDir, [string]$Mode, [string]$Snapshot)
  Push-Location $RepoRoot
  try {
    $handoffPath = Join-Path $MemoryDir "handoff.md"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    $commit = git log -1 --oneline 2>$null
    $statusLines = @(git status --short 2>$null)
    $statusBlock = if ($statusLines.Count -gt 0) { ($statusLines | Select-Object -First 80) -join "`n" } else { "Clean working tree." }
    $content = @"
# Handoff

Last updated: $timestamp
Update mode: $Mode

## Latest Notes

Automatic handoff snapshot written by .codex/hooks/agent-protocol.ps1.

$Snapshot

## Git Snapshot

- Branch: $branch
- Last commit: $commit

## Working Tree

~~~text
$statusBlock
~~~

## Required Startup For Next Agent

1. Read ``AGENTS.md``.
2. Read ``CLAUDE.md``.
3. Read ``.agent-memory/current-state.md``.
4. Read this handoff.
5. Read ``.agent-memory/next-steps.md``.
6. Run ``git status --short``.

## Constraints

- Do not write secrets, tokens, passwords, or raw credential values into memory files.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
- Review untracked files before deleting or committing them.
- Check ``.agent-memory/owner-feedback.md`` before continuing after context compression.
- Put durable completed state in ``.agent-memory/current-state.md`` and durable priorities in ``.agent-memory/next-steps.md``.
"@
    Set-Content -Path $handoffPath -Value $content -Encoding UTF8
  } finally {
    Pop-Location
  }
}

function Update-MemorySnapshot {
  param([string]$RepoRoot, [string]$MemoryDir, [object]$Payload, [string]$Mode)
  $snapshot = New-MemorySnapshot -RepoRoot $RepoRoot -Payload $Payload -Mode $Mode
  Update-Handoff -RepoRoot $RepoRoot -MemoryDir $MemoryDir -Mode $Mode -Snapshot $snapshot
  Add-ProgressSnapshot -MemoryDir $MemoryDir -Snapshot $snapshot
}

try {
  $repoRoot = Get-RepoRoot
  if (-not $repoRoot) { exit 0 }
  $memoryDir = Ensure-MemoryDir -RepoRoot $repoRoot
  $payload = Read-HookPayload
  $command = Get-HookCommand -Payload $payload

  switch -Regex ($Event) {
    "^PreToolUse$" {
      Add-ProtocolLog -MemoryDir $memoryDir -EventName $Event -Command $command
      Add-PreDeployLog -RepoRoot $repoRoot -MemoryDir $memoryDir -Command $command
      break
    }
    "^PostToolUse$" {
      Add-ErrorCapture -MemoryDir $memoryDir -Payload $payload -Command $command
      break
    }
    "^UserPromptSubmit$" {
      $promptText = Get-PromptText -Payload $payload
      if (Test-IsOwnerFeedback -PromptText $promptText) {
        Add-OwnerFeedback -MemoryDir $memoryDir -Text $promptText -Source "UserPromptSubmit"
      }
      break
    }
    "^Stop$" {
      Update-MemorySnapshot -RepoRoot $repoRoot -MemoryDir $memoryDir -Payload $payload -Mode $Event
      break
    }
    "^PreCompact" {
      Update-MemorySnapshot -RepoRoot $repoRoot -MemoryDir $memoryDir -Payload $payload -Mode $Event
      break
    }
    default {
      Add-ProtocolLog -MemoryDir $memoryDir -EventName $Event -Command $command
      break
    }
  }
  exit 0
} catch {
  exit 0
}
