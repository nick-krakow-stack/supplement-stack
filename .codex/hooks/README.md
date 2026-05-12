# Codex Hook Protocol

Dieses Projekt nutzt ein zentrales, minimales Hook-Setup.

Aktiv verdrahtet in `.codex/hooks.json`:

- `UserPromptSubmit`
- `Stop`

Absichtlich nicht aktiv:

- `PreCompact`
- `PreToolUse`
- `PostToolUse`

Die frueheren Claude-Hooks sind entfernt. `.claude/settings.json` wird nicht
mehr als Projekt-Hook-Konfiguration genutzt, damit Codex keine versteckten
Claude-Hooks zur Review einsammelt.

Die Hook-Ziele:

- `UserPromptSubmit` faengt Benutzer-Feedback ab.
- `Stop` schreibt einen kurzen Memory-/Handoff-/Progress-Snapshot.

`agent-protocol.ps1` ist absichtlich sparsam:

- kein lauter Standard-Output
- keine aktiven Tool- oder PreCompact-Hooks
- keine Shell- oder Netzwerk-Aktionen
- robust bei fehlendem oder invalidem Hook-Payload
