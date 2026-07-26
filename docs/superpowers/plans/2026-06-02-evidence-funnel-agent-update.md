# Evidence-Funnel Agent Update Implementation Plan

> **ARCHIVED / SUPERSEDED (2026-07-13):** Historical design record only. Do not
> reuse its old Stage-2/Stage-3 sequencing, extract or review rules. The active
> pipeline is defined by `AGENTS.md` and Framework 06.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Nährstoff-Agenten nutzen künftig einen kostensparenden Evidence-Funnel, der breite Recherche erhält, aber Stage-2-Artikel auf entscheidungsstarke Anchor-Quellen begrenzt.

**Architecture:** Stage 0 sammelt nur Metadaten, Stage 1 verifiziert Quellen, Stage 1.5 ist das harte Gate mit `ANCHOR | SUPPORTING | COVERED_BY_REVIEW | LOW_SIGNAL | BLOCKED`. Stage 2 verarbeitet primär `ANCHOR`-Quellen, Stage 3 baut aus akzeptierten Anchor-Artikeln den Hauptartikel, Stage 4 schreibt nur gedeckte Werte in `dose_recommendations`.

**Tech Stack:** Markdown-Protokolle in `AGENTS.md`, `codex-files/agents/*`, `codex-files/frameworks/*`.

---

### Task 1: Pipeline-Protokoll aktualisieren

**Files:**
- Modify: `AGENTS.md`

- [x] Stage-0/1/1.5/2/3/4-Funnel in Shared Output Handling dokumentieren.
- [x] Pipeline-Modi auf Stage 0, harte Stage-1.5-Labels und Anchor-only Stage 2 anpassen.
- [x] Stage 4 auf operative `dose_recommendations`-/Stack-Abbildung statt zweite Empfehlungstabelle festlegen.
- [x] Modellrouting ergänzen: Spark für Radar/Preflight/Scoring, `gpt-5.5` für Writer und Acceptance-Gates.

### Task 2: Agentendefinitionen aktualisieren

**Files:**
- Modify: `codex-files/agents/AGENT_stage_1_0_nutrient-research-analyst.md`
- Modify: `codex-files/agents/AGENT_stage_1_5_bewertung.md`
- Modify: `codex-files/agents/AGENT_stage_2_0_clinical-study-interpreter.md`
- Modify: `codex-files/agents/AGENT_stage_3_0_german-health-science-writer.md`
- Modify: `codex-files/agents/AGENT_stage_4_0_stack_sync.md`

- [x] Stage 1 als verifiziertes Quelleninventar nach Quellenradar rahmen.
- [x] Stage 1.5 als hartes Scoring- und Cluster-Gate beschreiben.
- [x] Stage 2 auf `ANCHOR`-Quellen und Cluster-Abdeckung begrenzen.
- [x] Stage 3 auf Anchor-Artikel plus Supporting-Kontext ausrichten.
- [x] Stage 4 auf `dose_recommendations` ausrichten.

### Task 3: Frameworks aktualisieren

**Files:**
- Modify: `codex-files/frameworks/04_framework_stage_1_5_bewertung.md`
- Modify: `codex-files/frameworks/05_framework_stage_4_stack_sync.md`

- [x] Stage-1.5-Scoringachsen, Entscheidungstabelle und Label-Übergabe dokumentieren.
- [x] Stage-4-Projektion als additive Nutzung von `dose_recommendations` dokumentieren.

### Task 4: Validierung

**Files:**
- Check: `AGENTS.md`
- Check: `codex-files/agents/*`
- Check: `codex-files/frameworks/*`

- [x] `git diff --check -- AGENTS.md codex-files/agents codex-files/frameworks` ausführen.
- [x] Nach `Stage 0`, `ANCHOR`, `SUPPORTING`, `COVERED_BY_REVIEW`, `LOW_SIGNAL`, `BLOCKED`, `dose_recommendations` suchen.
- [x] UTF-8-/Mojibake-Check für geänderte Protokolldateien ausführen.
