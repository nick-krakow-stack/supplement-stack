# Codex Hook Protocol

Dieses Projekt nutzt ein zentrales, minimales Hook-Setup mit zentraler Memory-Führung.

Aktiv verdrahtet in `.codex/hooks.json`:

- `UserPromptSubmit`
- `Stop`

Absichtlich nicht aktiv:

- `PreCompact`
- `PreToolUse`
- `PostToolUse`

Die früheren Claude-Hooks sind entfernt. `.claude/settings.json` wird nicht
mehr als Projekt-Hook-Konfiguration genutzt, damit Codex keine versteckten
Claude-Hooks zur Review einsammelt.

Die Hook-Ziele:

- `UserPromptSubmit` faengt Benutzer-Feedback ab.
- `Stop` schreibt einen kurzen Memory-/Handoff-/Progress-Snapshot.
- Nach jedem Sub-Agent-Final-Output werden erledigte Punkte in `.agent-memory/current-task.md` sofort abgehakt, bevor weiter delegiert oder final geantwortet wird.
- `.agent-memory/current-task.md` bleibt die live To-do-Liste und wird von `Stop` referenziert.
- Browser-/Diff-Feedback und Owner-Feedback werden vollständig in `.agent-memory/feedback.md` persistiert.
- `.agent-memory/current-task.md`, `.agent-memory/feedback.md` und `.agent-memory/handoff.md` bilden zusammen den zentralen Übergabezustand.

`agent-protocol.ps1` ist absichtlich sparsam:

- kein lauter Standard-Output
- keine aktiven Tool- oder PreCompact-Hooks
- keine Shell- oder Netzwerk-Aktionen
- robust bei fehlendem oder invalidem Hook-Payload
- schreibt bei Bedarf ein kanonisches `.agent-memory/current-task.md`, falls es fehlt
