# Codex Hook Entry Points

This directory is the canonical hook location for this repository.

- Codex reads `.codex/hooks.json`.
- Claude-compatible settings in `.claude/settings.json` point back to these
  same PowerShell hook files.
- Keep hook code here to avoid duplicated `.codex` / `.claude` behavior.
- Hooks are PowerShell-based for Windows Codex App compatibility; do not add
  Bash-only hooks unless the Windows runner is updated to provide `bash`.

Current hooks:

- `pre-deploy-check.ps1`: lightweight Wrangler deploy/migration checklist.
- `error-capture.ps1`: records Wrangler failures to
  `.agent-memory/deploy-errors.log`.
- `orchestrator-guard.ps1`: brief protocol reminder.
- `update-agent-handoff.ps1`: automatic `.agent-memory/handoff.md` snapshot.
