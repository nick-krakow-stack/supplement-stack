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
  pre-compact handoff updates.

Centralized responsibilities:

- `Add-ProtocolLog`: preserve the Orchestrator/Sub-Agent protocol reminder.
- `Add-PreDeployLog`: preserve the Cloudflare/Wrangler pre-deploy checklist.
- `Add-ErrorCapture`: preserve Wrangler deploy error capture into memory.
- `Update-Handoff`: preserve the memory handoff update before context
  compaction.

Only `UserPromptSubmit` is wired in the active Codex/Claude hook settings.
`PreToolUse`, `PostToolUse`, and `PreCompact` are intentionally not wired
because the Codex App surfaced those hooks as unreviewable hook approvals in
this repo. Keep their behavior available inside `agent-protocol.ps1`, but
trigger it manually or re-enable it only after the app review flow is usable.

Manual handoff/memory update before context compaction:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./.codex/hooks/agent-protocol.ps1 -Event PreCompactManual
```

If a `UserPromptSubmit` payload does not expose prompt text, capture important
owner feedback manually:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/append-owner-feedback.ps1 -Text "<feedback>"
```
