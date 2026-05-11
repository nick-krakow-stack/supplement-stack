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
  It handles orchestrator/sub-agent reminders, owner feedback capture,
  pre-deploy logging, deploy error capture, and pre-compact handoff updates.

PreToolUse hooks must not write plain-text stdout in the Codex App. The
dispatcher therefore sends reminders/check output to stderr or durable memory
files instead of stdout.

If a `UserPromptSubmit` payload does not expose prompt text, capture important
owner feedback manually:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/append-owner-feedback.ps1 -Text "<feedback>"
```
