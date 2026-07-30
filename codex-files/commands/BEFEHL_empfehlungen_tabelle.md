# Veraltet: keine parallele `empfehlungen`-Tabelle anlegen

Dieser frühere Einmalbefehl ist aufgehoben. Stage 4 projiziert ausschließlich in
die bestehende operative Tabelle `dose_recommendations`; eine zusätzliche
`empfehlungen`-Tabelle wäre eine konkurrierende Wahrheit und darf nicht angelegt
werden.

Für einen normalen Wirkstofflauf gelten:

- `codex-files/agents/AGENT_stage_4_0_stack_sync.md`
- `codex-files/frameworks/06_framework_coverage_source_evidence.md`
- `codex-files/frameworks/05_framework_stage_4_stack_sync.md`

Stage 4 liest `coverage_plan.v1` und fachlich validierte
`source_evidence_record.v1`, arbeitet additiv und versioniert und aktiviert nur
vollständig gedeckte stack-relevante Cluster.

Falls eine echte Schema-, Code- oder Query-Änderung an `dose_recommendations`
nötig wird, ist sie ein separater DB-/Code-Eingriff nach
`codex-files/commands/GOAL_TEMPLATE_DB_CODE.md`. Sie gehört nicht in den
alltäglichen Content- oder Stack-Sync-Lauf.
