# Vitamin-Reststages Implementation Plan

> **ARCHIVED / SUPERSEDED (2026-07-13):** Historical execution record only.
> Its accepted-Stage-2-first, extract, pilot and per-article review rules are not
> active instructions. Use `AGENTS.md`, Framework 06, the framework catalog and
> the Stage-3 Style Contract for all new work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Stage 2, Stage 3, Stage 3.5, and Stage 4 for Vitamin B1, B2, B3, B5, B6, B7, B9, B12, C, D, E, and canonical Vitamin K.

**Architecture:** Stage 1 and Stage 1.5 are already present and remain the source basis. Stage 2 writes accepted single-study/meta-review knowledge articles first; Stage 3 writes the main article from accepted Stage 2 material; Stage 4 projects accepted article/cluster data into `dose_recommendations` only.

**Tech Stack:** Local markdown/JSON artifacts under `_research_raw/`, Cloudflare D1 tables `ingredient_research_sources`, `knowledge_articles`, `knowledge_article_ingredients`, `study_interpretation_records`, and `dose_recommendations`.

---

### Task 1: Verified Intake

**Files:**
- Read: `AGENTS.md`
- Read: `docs/nutrient-content-article-quality-contract.md`
- Read: `codex-files/agents/AGENT_stage_2_0_clinical-study-interpreter.md`
- Read: `codex-files/agents/AGENT_stage_3_5_article-reader-acceptance-reviewer.md`
- Read: `_research_raw/vitamin-stage1-batch/<vitamin>/<vitamin>-stage1-inventory.json`
- Read: `_research_raw/vitamin-stage1-batch/<vitamin>/<vitamin>-stage1-5-evaluation.json`
- Read: `_research_raw/vitamin-stage1-batch/<vitamin>/<vitamin>-stage2-readiness.md`
- Modify: `.agent-memory/current-task.md`

- [ ] Confirm all target vitamins have parseable Stage-1 and Stage-1.5 artifacts and `READY`.
- [ ] Confirm D1 has no missing source locator and no `pdf_status='not_checked'`.
- [ ] Confirm no target vitamin already has Stage-2/Stage-3 articles unless continuing/reviewing them.

### Task 2: Stage-2 Contract And Pilot Planning

**Files:**
- Create: `_research_raw/vitamin-stage2/<vitamin>/stage2-contract.md`
- Create: `_research_raw/vitamin-stage2/<vitamin>/article-list.json`
- Create: `_research_raw/vitamin-stage2/<vitamin>/pilot-plan.md`

- [ ] For each vitamin, build a Stage-2 contract from Stage-1/1.5 inputs.
- [ ] Identify meta-/review coverage first.
- [ ] Create article candidates: suitable review/meta articles plus uncovered individual studies.
- [ ] Select pilot set: one meta/review source, one large individual study/RCT if available, one guideline/safety/reference source.
- [ ] Mark unavailable/paywalled/input-limited sources explicitly; do not invent missing fields.

### Task 3: Stage-2 Pilot Articles

**Files:**
- Create: `_research_raw/vitamin-stage2/<vitamin>/pilot/<slug>/article.md`
- Create: `_research_raw/vitamin-stage2/<vitamin>/pilot/<slug>/extract.json`
- Create: `_research_raw/vitamin-stage2/<vitamin>/pilot/<slug>/review.md`

- [ ] Write visible German study articles article-first.
- [ ] Derive machine-friendly extracts only from finished article text.
- [ ] Run banned-term scan.
- [ ] Run Stage 3.5 reader acceptance gate; only Q1=Ja, Q2=Ja, Q3=Nein is PASS.
- [ ] Update article-list status to `accepted`, `drafted`, `blocked`, or `excluded`.

### Task 4: Stage-2 Full Run

**Files:**
- Create: `_research_raw/vitamin-stage2/<vitamin>/single-study/<slug>/article.md`
- Create: `_research_raw/vitamin-stage2/<vitamin>/single-study/<slug>/extract.json`
- Create: `_research_raw/vitamin-stage2/<vitamin>/single-study/<slug>/review.md`
- Create: import SQL/generator artifacts only after accepted local drafts.

- [ ] Parallelize independent article candidates; one Sub-Agent per article.
- [ ] Review each result, close its Sub-Agent, update status.
- [ ] Import only accepted articles into `knowledge_articles` with `article_layer='single_study'` and matching `study_interpretation_records`.

### Task 5: Stage 3 And Stage 3.5

**Files:**
- Create: `_research_raw/vitamin-stage3/<vitamin>/article.md`
- Create: `_research_raw/vitamin-stage3/<vitamin>/extract.json`
- Create: `_research_raw/vitamin-stage3/<vitamin>/review.md`

- [ ] Write one main article per vitamin from accepted Stage-2 material and Stage-1.5 clusters.
- [ ] Run Stage 3.5 gate against article and extract.
- [ ] Import only PASS articles as `main_article`.

### Task 6: Stage 4

**Files:**
- Create: `_research_raw/vitamin-stage4/<vitamin>/stage4-dose-recommendation-drafts.sql`
- Create: `_research_raw/vitamin-stage4/<vitamin>/stage4-release-report.md`

- [ ] Use `dose_recommendations` only; no second recommendation table.
- [ ] Insert only gedeckte draft rows first: `stage4_status='entwurf'`, `stack_visible=0`.
- [ ] Run technical-change-reviewer before DB writes.
- [ ] Run Framework-05 checks before any activation.
- [ ] Activate only after PASS: no tested amount as recommendation, exactly one standard or clean patt per visible demography, source links present.
