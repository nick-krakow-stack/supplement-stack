# Codex Hook Entry Points

This directory is the canonical hook location for this repository.

- Codex reads `.codex/hooks.json`.
- Claude-compatible settings in `.claude/settings.json` point back to these
  same PowerShell hook files.
- Keep hook code here to avoid duplicated `.codex` / `.claude` behavior.
- Hooks are PowerShell-based for Windows Codex App compatibility; do not add
  Bash-only hooks unless the Windows runner is updated to provide `bash`.

Current hooks:

- `agent-protocol.ps1`: single centralized dispatcher for all hook events.
  It contains the consolidated logic for orchestrator/sub-agent reminders,
  owner feedback capture, pre-deploy logging, deploy error capture, and
  Stop/PreCompact handoff-progress snapshots.

Centralized responsibilities:

- `Add-ProtocolLog`: preserve the Orchestrator/Sub-Agent protocol reminder.
- `Add-PreDeployLog`: preserve the Cloudflare/Wrangler pre-deploy checklist.
- `Add-ErrorCapture`: preserve Wrangler deploy error capture into memory.
- `Update-MemorySnapshot`: preserve the handoff/progress update on Stop and
  before context compaction.

Active Codex/Claude hook settings:

- `UserPromptSubmit`: captures owner browser feedback, diff comments, and
  multi-change website/admin requests into
  `.agent-memory/owner-feedback.md`.
- `Stop`: writes a durable handoff/progress snapshot.
- `PreCompact` with `auto` and `manual` matchers: writes the same durable
  handoff/progress snapshot before context compaction.

`PreToolUse` and `PostToolUse` are intentionally not wired. Keep any
manual/future behavior inside `agent-protocol.ps1` and do not add separate hook
entry-point files.

Memory rules:

- Codex acts as Orchestrator: plan, delegate, and review. Implementation and
  file edits belong to the responsible Sub-Agent; Dev-Agent owns code edits.
- Completed work and project state belong in `.agent-memory/current-state.md`
  or in the efficient snapshot log `.agent-memory/progress-snapshots.md`.
- Exact continuation state belongs in `.agent-memory/handoff.md`.
- Durable priorities and follow-ups belong in `.agent-memory/next-steps.md`.
- Before compaction, the snapshot must clearly state completed work, open work,
  next steps, and checks/status.

Manual handoff/memory update if needed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./.codex/hooks/agent-protocol.ps1 -Event PreCompactManual
```

If a `UserPromptSubmit` payload does not expose prompt text, capture important
owner feedback manually:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/append-owner-feedback.ps1 -Text "<feedback>"
```
