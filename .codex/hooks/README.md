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

`PreToolUse` and `PostToolUse` are intentionally not wired in the active
Codex/Claude hook settings. The Codex App currently surfaces those tool hooks
as unreviewable hook approvals in this repo. Keep tool-hook behavior available
inside `agent-protocol.ps1`, but trigger it manually or re-enable it only after
the app review flow is usable.

If a `UserPromptSubmit` payload does not expose prompt text, capture important
owner feedback manually:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/append-owner-feedback.ps1 -Text "<feedback>"
```
