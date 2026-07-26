#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'

const allowedPdfStatuses = new Set(['available', 'stored', 'paywalled', 'unavailable', 'not_checked'])
const finalPdfStatuses = new Set(['available', 'stored', 'paywalled', 'unavailable'])
const allowedPriorities = new Set(['hoch', 'mittel', 'niedrig'])
const allowedSourceKinds = new Set(['official', 'study'])
const officialSourceKinds = new Set([
  'official',
  'dge',
  'behörde/institution',
  'behoerde/institution',
  'behörde',
  'behoerde',
  'institution',
  'leitlinie',
  'guideline',
  'authority',
  'regulatory',
])
const studySourceKinds = new Set([
  'study',
  'studie',
  'meta-analyse',
  'meta analysis',
  'meta-analysis',
  'systematischer review',
  'systematic review',
  'review',
  'rct',
  'kohortenstudie',
  'cohort',
  'fall-kontroll-studie',
  'case-control',
  'querschnittsstudie',
  'cross-sectional',
  'humanstudie mechanistisch',
  'mechanistisch',
  'tierstudie',
  'in-vitro-studie',
  'fallbericht/expertenmeinung',
  'sekundärquelle',
  'sekundaerquelle',
])
const allowedArtifactStatuses = new Set(['draft', 'pending_review', 'approved', 'needs_changes', 'archived'])
const allowedPipelineStatuses = new Set(['not_started', 'in_progress', 'pending_review', 'approved', 'needs_changes', 'blocked'])
const gapValues = new Set([
  'nicht im input verfuegbar',
  'nicht im input verfügbar',
  'input_gap',
  'evidenzluecke',
  'evidenzlücke',
  'download_nicht_verfuegbar',
  'download_nicht_verfügbar',
  'n/a',
  'na',
  'null',
  'undefined',
])

const inventoryColumns = [
  'source_language',
  'source_country',
  'publication_year',
  'authors',
  'journal',
  'pdf_url',
  'pdf_storage_key',
  'pdf_status',
  'archive_url',
  'topic_summary',
  'study_design',
  'participant_count',
  'duration_summary',
  'meta_summary',
  'stage2_priority',
]

const insertColumns = [
  'ingredient_id',
  'source_kind',
  'organization',
  'country',
  'region',
  'population',
  'recommendation_type',
  'no_recommendation',
  'study_type',
  'evidence_quality',
  'evidence_grade',
  'source_title',
  'source_url',
  'doi',
  'pubmed_id',
  'notes',
  'source_date',
  ...inventoryColumns,
]

const updateColumns = [
  'source_kind',
  'organization',
  'country',
  'region',
  'population',
  'recommendation_type',
  'no_recommendation',
  'study_type',
  'evidence_quality',
  'evidence_grade',
  'source_title',
  'source_url',
  'doi',
  'pubmed_id',
  'source_date',
  ...inventoryColumns,
]

const amountColumns = ['dose_min', 'dose_max', 'dose_unit', 'per_kg_body_weight']

function usage() {
  return [
    'Usage:',
    '  node scripts/import-stage1-inventory.mjs --inventory <path> [--write-sql [path]] [--write-validation [path]]',
    '  node scripts/import-stage1-inventory.mjs --inventory <path> --write-sql --apply --d1 <local-d1-name>',
    '',
    'Notes:',
    '  --apply uses Wrangler local D1 only. This script has no remote-write mode.',
  ].join('\n')
}

function parseArgs(argv) {
  const args = {
    inventory: null,
    writeSql: false,
    sqlPath: null,
    writeValidation: false,
    validationPath: null,
    apply: false,
    d1: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--help' || arg === '-h') {
      console.log(usage())
      process.exit(0)
    }

    if (arg === '--remote') {
      throw new Error('--remote is intentionally unsupported; this routine must not perform remote D1 writes.')
    }

    if (arg === '--inventory') {
      if (!next || next.startsWith('--')) throw new Error('--inventory requires a path')
      args.inventory = next
      index += 1
      continue
    }

    if (arg === '--write-sql') {
      args.writeSql = true
      if (next && !next.startsWith('--')) {
        args.sqlPath = next
        index += 1
      }
      continue
    }

    if (arg === '--write-validation') {
      args.writeValidation = true
      if (next && !next.startsWith('--')) {
        args.validationPath = next
        index += 1
      }
      continue
    }

    if (arg === '--apply') {
      args.apply = true
      args.writeSql = true
      continue
    }

    if (arg === '--d1') {
      if (!next || next.startsWith('--')) throw new Error('--d1 requires a local D1 database name')
      args.d1 = next
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!args.inventory) throw new Error('--inventory is required')
  if (args.apply && !args.d1) throw new Error('--apply requires --d1 <local-d1-name>')
  return args
}

function sql(value) {
  if (value === undefined || value === null || value === '') return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${String(value).replaceAll("'", "''")}'`
}

function asPositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function cleanString(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function isMeaningful(value) {
  const normalized = cleanString(value).toLowerCase()
  return Boolean(normalized) && !gapValues.has(normalized)
}

function maybeUrl(value) {
  const text = cleanString(value)
  return /^https?:\/\/\S+$/i.test(text)
}

function normalizeDoi(value) {
  let text = cleanString(value).toLowerCase()
  text = text.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
  text = text.replace(/^doi:\s*/, '')
  return text
}

function doiUrl(value) {
  const normalized = normalizeDoi(value)
  return normalized ? `https://doi.org/${normalized}` : ''
}

function pubmedUrl(value) {
  const normalized = cleanString(value)
  return normalized ? `https://pubmed.ncbi.nlm.nih.gov/${normalized}/` : ''
}

function normalizeUrl(value) {
  const text = cleanString(value).toLowerCase()
  return text.replace(/\/+$/, '')
}

function normalizePubmed(value) {
  return cleanString(value).replace(/^pmid:\s*/i, '')
}

function boolInt(value) {
  if (value === true || value === 1) return 1
  const text = cleanString(value).toLowerCase()
  return text === '1' || text === 'true' || text === 'yes' ? 1 : 0
}

function dbSourceKind(source) {
  const raw = cleanString(source.source_kind).toLowerCase()
  if (allowedSourceKinds.has(raw)) return raw
  if (officialSourceKinds.has(raw)) return 'official'
  if (studySourceKinds.has(raw)) return 'study'
  return ''
}

function dbEvidenceGrade(value) {
  const raw = cleanString(value).toLowerCase()
  if (!raw) return null
  const upper = raw.toUpperCase()
  if (['A', 'B', 'C', 'D', 'F'].includes(upper)) return upper
  if (raw === 'stark') return 'A'
  if (raw === 'moderat') return 'B'
  if (raw === 'schwach') return 'C'
  if (raw === 'unzureichend') return 'F'
  return null
}

function visibleLocator(source) {
  if (isMeaningful(source.source_url)) return cleanString(source.source_url)
  if (isMeaningful(source.doi)) return doiUrl(source.doi)
  if (isMeaningful(source.pubmed_id)) return pubmedUrl(source.pubmed_id)
  return ''
}

function defaultSqlPath(inventoryPath) {
  const extension = extname(inventoryPath)
  return resolve(dirname(inventoryPath), `${basename(inventoryPath, extension)}.sql`)
}

function defaultValidationPath(inventoryPath) {
  const extension = extname(inventoryPath)
  const base = basename(inventoryPath, extension)
  const filename = base.includes('inventory')
    ? `${base.replace('inventory', 'validation')}.md`
    : `${base}-validation.md`
  return resolve(dirname(inventoryPath), filename)
}

function normalizeInventory(raw, inventoryPath) {
  const artifact = raw.artifact && typeof raw.artifact === 'object' ? raw.artifact : {}
  const ingredientId = asPositiveInteger(raw.ingredient_id)
  const artifactId = asPositiveInteger(raw.artifact_id ?? artifact.id)
  const artifactTitleFromJson = cleanString(raw.artifact_title ?? artifact.title)
  const fallbackArtifactTitle = cleanString(raw.ingredient_name)
    ? `${cleanString(raw.ingredient_name)} - Stage-1 Quelleninventar`
    : ''
  const artifactTitle = artifactTitleFromJson || fallbackArtifactTitle
  const createIfMissingValue = raw.artifact_create_if_missing ?? artifact.create_if_missing
  const artifactCreateIfMissing = createIfMissingValue === undefined ? !artifactId : Boolean(createIfMissingValue)
  const stage = cleanString(raw.stage || 'research')
  const status = cleanString(raw.artifact_status ?? artifact.status ?? 'pending_review')
  const pipelineStatus = cleanString(raw.pipeline_status ?? 'pending_review')
  const inventoryPathForJson = raw.inventory_path || inventoryPath.replaceAll('\\', '/')
  const warnings = []

  if (!artifactTitleFromJson) {
    warnings.push('artifact_title is missing; using legacy fallback from ingredient_name.')
  }

  return {
    raw,
    inventoryPath,
    inventoryPathForJson,
    ingredient_id: ingredientId,
    ingredient_name: cleanString(raw.ingredient_name),
    artifact_id: artifactId,
    artifact_title: artifactTitle,
    artifact_create_if_missing: artifactCreateIfMissing,
    artifact_status: status || 'pending_review',
    pipeline_status: pipelineStatus || 'pending_review',
    stage,
    created_at: cleanString(raw.created_at) || new Date().toISOString().slice(0, 10),
    description: cleanString(raw.description),
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    warnings,
  }
}

function validateInventory(inventory) {
  const errors = []
  const warnings = [...inventory.warnings]
  const seen = {
    doi: new Map(),
    pubmed_id: new Map(),
    source_url: new Map(),
  }
  const counts = {
    sources: inventory.sources.length,
    existing: 0,
    inserts: 0,
    pdf: {},
    priorities: {},
    missingLocator: 0,
    accessNotes: 0,
  }

  if (!inventory.ingredient_id) errors.push('Missing or invalid ingredient_id.')
  if (inventory.stage !== 'research') errors.push(`Invalid stage "${inventory.stage}". Stage-1 imports may only target stage="research".`)
  if (!inventory.artifact_title) errors.push('Missing artifact_title.')
  if (!allowedArtifactStatuses.has(inventory.artifact_status)) errors.push(`Invalid artifact_status "${inventory.artifact_status}".`)
  if (!allowedPipelineStatuses.has(inventory.pipeline_status)) errors.push(`Invalid pipeline_status "${inventory.pipeline_status}".`)
  if (!inventory.artifact_id && !inventory.artifact_create_if_missing) {
    errors.push('Missing artifact_id while artifact_create_if_missing is false.')
  }
  if (!inventory.sources.length) errors.push('Inventory must contain at least one source.')

  inventory.sources.forEach((source, index) => {
    const row = index + 1
    const label = cleanString(source.existing_id) || cleanString(source.source_title) || `row ${row}`
    const existingId = asPositiveInteger(source.existing_id)

    if (existingId) counts.existing += 1
    else counts.inserts += 1

    if (!isMeaningful(source.source_title)) errors.push(`Missing source_title at source ${row}.`)
    if (!visibleLocator(source)) {
      counts.missingLocator += 1
      errors.push(`Missing visible locator for ${label}: source_url, doi, or pubmed_id is required.`)
    }
    if (isMeaningful(source.source_url) && !maybeUrl(source.source_url)) {
      errors.push(`source_url must be an http(s) locator for ${label}.`)
    }
    if (isMeaningful(source.pdf_url) && !maybeUrl(source.pdf_url)) {
      errors.push(`pdf_url must be an http(s) locator for ${label}.`)
    }
    if (isMeaningful(source.archive_url) && !maybeUrl(source.archive_url)) {
      errors.push(`archive_url must be an http(s) locator for ${label}.`)
    }

    const pdfStatus = cleanString(source.pdf_status)
    counts.pdf[pdfStatus || 'missing'] = (counts.pdf[pdfStatus || 'missing'] ?? 0) + 1
    if (!pdfStatus) errors.push(`Missing pdf_status for ${label}.`)
    else if (!allowedPdfStatuses.has(pdfStatus)) errors.push(`Invalid pdf_status for ${label}: ${pdfStatus}.`)
    else if (!finalPdfStatuses.has(pdfStatus)) errors.push(`Final Stage-1 inventory may not contain pdf_status="${pdfStatus}" for ${label}.`)
    if (pdfStatus === 'stored' && !isMeaningful(source.pdf_storage_key)) {
      errors.push(`pdf_status="stored" requires pdf_storage_key for ${label}.`)
    }
    if ((pdfStatus === 'paywalled' || pdfStatus === 'unavailable')) {
      const explanation = [source.access_check_note, source.notes, source.meta_summary].some(isMeaningful)
      if (explanation) counts.accessNotes += 1
      else errors.push(`pdf_status="${pdfStatus}" requires access_check_note, notes, or meta_summary for ${label}.`)
    }

    const priority = cleanString(source.stage2_priority)
    counts.priorities[priority || 'missing'] = (counts.priorities[priority || 'missing'] ?? 0) + 1
    if (!allowedPriorities.has(priority)) {
      errors.push(`Invalid or missing stage2_priority for ${label}: ${priority || 'missing'}.`)
    }

    const mappedSourceKind = dbSourceKind(source)
    if (!existingId && !mappedSourceKind) {
      errors.push(`New source ${label} requires source_kind that maps to DB value "official" or "study".`)
    } else if (existingId && source.source_kind !== undefined && !mappedSourceKind) {
      errors.push(`Existing source ${label} has source_kind that does not map to DB value "official" or "study".`)
    }

    amountColumns.forEach((column) => {
      if (isMeaningful(source[column])) {
        errors.push(`Amount field ${column} is not allowed in Stage-1 source inventory for ${label}. Use dose_recommendations instead.`)
      }
    })

    const duplicateChecks = [
      ['doi', normalizeDoi(source.doi)],
      ['pubmed_id', normalizePubmed(source.pubmed_id)],
      ['source_url', normalizeUrl(source.source_url)],
    ]
    duplicateChecks.forEach(([field, value]) => {
      if (!value) return
      if (seen[field].has(value)) {
        errors.push(`Duplicate ${field} "${cleanString(source[field])}" in ${seen[field].get(value)} and ${label}.`)
      }
      seen[field].set(value, label)
    })
  })

  return { errors, warnings, counts }
}

function sourceMatch(source) {
  const existingId = asPositiveInteger(source.existing_id)
  if (existingId) return `id = ${existingId}`

  const clauses = []
  const doi = cleanString(source.doi)
  const normalizedDoi = normalizeDoi(source.doi)
  const pubmedId = normalizePubmed(source.pubmed_id)
  const sourceUrl = cleanString(source.source_url)

  if (doi) clauses.push(`lower(trim(doi)) = lower(trim(${sql(doi)}))`)
  if (normalizedDoi && normalizedDoi !== doi.toLowerCase()) {
    clauses.push(`lower(trim(doi)) = lower(trim(${sql(normalizedDoi)}))`)
  }
  if (pubmedId) clauses.push(`trim(pubmed_id) = trim(${sql(pubmedId)})`)
  if (sourceUrl) clauses.push(`trim(source_url) = trim(${sql(sourceUrl)})`)
  return clauses.length ? `(${clauses.join(' OR ')})` : '0'
}

function artifactIdExpression(inventory) {
  if (inventory.artifact_id) return String(inventory.artifact_id)
  return `(SELECT id FROM research_pipeline_artifacts WHERE ingredient_id = ${inventory.ingredient_id} AND stage = 'research' AND title = ${sql(inventory.artifact_title)} ORDER BY id LIMIT 1)`
}

function accessNoteForDb(source) {
  if (!isMeaningful(source.access_check_note)) return null
  return `Zugriffsprüfung: ${cleanString(source.access_check_note)}`
}

function valueForColumn(source, column, inventory) {
  if (column === 'ingredient_id') return inventory.ingredient_id
  if (column === 'source_kind') return dbSourceKind(source)
  if (column === 'notes') return source.notes ?? accessNoteForDb(source)
  if (column === 'no_recommendation') return boolInt(source.no_recommendation)
  if (column === 'study_type') return source.study_type ?? source.study_design ?? null
  if (column === 'evidence_quality') return source.evidence_quality ?? source.evidence_grade ?? null
  if (column === 'evidence_grade') return dbEvidenceGrade(source.evidence_grade ?? source.evidence_quality)
  if (column === 'journal') return source.journal ?? source.journal_or_institution ?? null
  if (column === 'doi') return isMeaningful(source.doi) ? normalizeDoi(source.doi) : null
  if (column === 'pubmed_id') return isMeaningful(source.pubmed_id) ? normalizePubmed(source.pubmed_id) : null
  return source[column] ?? null
}

function explicitUpdateAssignments(source) {
  const assignments = []

  updateColumns.forEach((column) => {
    if (column === 'source_kind') {
      if (source.source_kind !== undefined) assignments.push(`${column} = ${sql(valueForColumn(source, column, null))}`)
      return
    }
    if (column === 'study_type') {
      if (source.study_type !== undefined || source.study_design !== undefined) {
        assignments.push(`${column} = ${sql(valueForColumn(source, column, null))}`)
      }
      return
    }
    if (column === 'doi') {
      if (source.doi !== undefined) assignments.push(`${column} = ${sql(valueForColumn(source, column, null))}`)
      return
    }
    if (column === 'pubmed_id') {
      if (source.pubmed_id !== undefined) assignments.push(`${column} = ${sql(valueForColumn(source, column, null))}`)
      return
    }
    if (column === 'no_recommendation') {
      if (source.no_recommendation !== undefined) assignments.push(`${column} = ${sql(valueForColumn(source, column, null))}`)
      return
    }
    if (column === 'evidence_quality') {
      if (source.evidence_quality !== undefined || source.evidence_grade !== undefined) {
        assignments.push(`${column} = ${sql(valueForColumn(source, column, null))}`)
      }
      return
    }
    if (column === 'evidence_grade') {
      if (source.evidence_grade !== undefined || source.evidence_quality !== undefined) {
        assignments.push(`${column} = ${sql(valueForColumn(source, column, null))}`)
      }
      return
    }
    if (source[column] !== undefined) assignments.push(`${column} = ${sql(source[column])}`)
  })

  if (source.notes !== undefined) {
    assignments.push(`notes = ${sql(source.notes)}`)
  } else {
    const accessNote = accessNoteForDb(source)
    if (accessNote) {
      assignments.push(`notes = CASE WHEN notes IS NULL OR trim(notes) = '' THEN ${sql(accessNote)} ELSE notes END`)
    }
  }

  return assignments
}

function artifactMarkdown(inventory, report) {
  const lines = [
    `# ${inventory.artifact_title}`,
    '',
    `Status: kontrolliertes Stage-1-Quelleninventar, erzeugt am ${inventory.created_at}.`,
    '',
    'Hinweis: Dieses Artefakt ist ein Quelleninventar. Es enthält keine Tiefeninterpretation, keine Therapieempfehlung und keine individuelle Dosierungsempfehlung.',
    '',
    `Umfang: ${inventory.sources.length} Quellen.`,
    `Validierung: ${report.errors.length ? 'BLOCKED' : 'PASS'}.`,
    '',
    '## Quellen',
    '',
  ]

  inventory.sources.forEach((source, index) => {
    const ids = []
    if (isMeaningful(source.doi)) ids.push(`DOI ${normalizeDoi(source.doi)}`)
    if (isMeaningful(source.pubmed_id)) ids.push(`PMID ${normalizePubmed(source.pubmed_id)}`)
    const access = isMeaningful(source.access_check_note)
      ? ` | Zugriffsprüfung: ${cleanString(source.access_check_note)}`
      : ''
    const pdf = [
      `PDF-Status: ${cleanString(source.pdf_status) || 'missing'}`,
      isMeaningful(source.pdf_url) ? `PDF: ${cleanString(source.pdf_url)}` : null,
      isMeaningful(source.archive_url) ? `Archiv: ${cleanString(source.archive_url)}` : null,
      isMeaningful(source.pdf_storage_key) ? `Storage: ${cleanString(source.pdf_storage_key)}` : null,
    ].filter(Boolean).join('; ')
    const meta = [
      source.source_language ? `Sprache: ${source.source_language}` : null,
      source.source_country ? `Land/Region: ${source.source_country}` : null,
      source.publication_year ? `Jahr: ${source.publication_year}` : null,
      source.study_design ? `Design: ${source.study_design}` : null,
      source.participant_count ? `n=${source.participant_count}` : null,
      source.duration_summary ? `Dauer: ${source.duration_summary}` : null,
    ].filter(Boolean).join('; ')

    lines.push(`- **${index + 1}. ${cleanString(source.source_title)}** | Priorität: ${cleanString(source.stage2_priority) || 'missing'} | Link: ${visibleLocator(source)}${ids.length ? `; ${ids.join('; ')}` : ''} | ${pdf} | Thema: ${cleanString(source.topic_summary) || 'INPUT_GAP'} | Meta: ${meta || 'INPUT_GAP'}${source.meta_summary ? `; Notiz: ${source.meta_summary}` : ''}${access}`)
  })

  return lines.join('\n')
}

function artifactContentJson(inventory, report) {
  const sources = inventory.sources.map((source, index) => ({
    order: index + 1,
    existing_id: source.existing_id ?? null,
    source_title: source.source_title ?? null,
    source_kind: source.source_kind ?? null,
    visible_locator: visibleLocator(source),
    source_url: source.source_url ?? null,
    doi: isMeaningful(source.doi) ? normalizeDoi(source.doi) : null,
    pubmed_id: isMeaningful(source.pubmed_id) ? normalizePubmed(source.pubmed_id) : null,
    pdf_status: source.pdf_status ?? null,
    pdf_url: source.pdf_url ?? null,
    archive_url: source.archive_url ?? null,
    pdf_storage_key: source.pdf_storage_key ?? null,
    access_check_note: source.access_check_note ?? null,
    topic_summary: source.topic_summary ?? null,
    meta_summary: source.meta_summary ?? null,
    stage2_priority: source.stage2_priority ?? null,
  }))

  return JSON.stringify({
    schema: 'stage1_inventory_import_v1',
    ingredient_id: inventory.ingredient_id,
    ingredient_name: inventory.ingredient_name || null,
    artifact_id: inventory.artifact_id ?? null,
    artifact_title: inventory.artifact_title,
    artifact_create_if_missing: inventory.artifact_create_if_missing,
    generated_at: inventory.created_at,
    inventory_path: inventory.inventoryPathForJson,
    validation_status: report.errors.length ? 'blocked' : 'pass',
    validation_errors: report.errors,
    validation_warnings: report.warnings,
    source_count: inventory.sources.length,
    existing_source_updates: report.counts.existing,
    new_source_candidates: report.counts.inserts,
    missing_source_locator: report.counts.missingLocator,
    pdf_status_counts: report.counts.pdf,
    stage2_priority_counts: report.counts.priorities,
    sources,
  }, null, 2)
}

function artifactSummary(inventory, report) {
  const priorityParts = ['hoch', 'mittel', 'niedrig']
    .map((priority) => `${priority}=${report.counts.priorities[priority] ?? 0}`)
    .join(', ')
  const pdfParts = ['available', 'stored', 'paywalled', 'unavailable']
    .map((status) => `${status}=${report.counts.pdf[status] ?? 0}`)
    .join(', ')
  return `Stage-1-Quelleninventar für ${inventory.ingredient_name || `ingredient_id ${inventory.ingredient_id}`} mit ${inventory.sources.length} Quellen. PDF-Status: ${pdfParts}. Stage-2-Prioritäten: ${priorityParts}.`
}

function createArtifactStatements(inventory, report) {
  const markdown = artifactMarkdown(inventory, report)
  const contentJson = artifactContentJson(inventory, report)
  const summary = artifactSummary(inventory, report)
  const statements = []

  if (inventory.artifact_create_if_missing) {
    const idColumns = inventory.artifact_id ? 'id, ' : ''
    const idValues = inventory.artifact_id ? `${inventory.artifact_id}, ` : ''
    const missingCondition = inventory.artifact_id
      ? `id = ${inventory.artifact_id}`
      : `ingredient_id = ${inventory.ingredient_id} AND stage = 'research' AND title = ${sql(inventory.artifact_title)}`
    statements.push(`INSERT INTO research_pipeline_artifacts (${idColumns}ingredient_id, stage, agent_id, status, title, summary, content_markdown, content_json) SELECT ${idValues}${inventory.ingredient_id}, 'research', 'nutrient-research-analyst', ${sql(inventory.artifact_status)}, ${sql(inventory.artifact_title)}, ${sql(summary)}, ${sql(markdown)}, ${sql(contentJson)} WHERE NOT EXISTS (SELECT 1 FROM research_pipeline_artifacts WHERE ${missingCondition});`)
  }

  const artifactWhere = inventory.artifact_id
    ? `id = ${inventory.artifact_id} AND ingredient_id = ${inventory.ingredient_id} AND stage = 'research'`
    : `ingredient_id = ${inventory.ingredient_id} AND stage = 'research' AND title = ${sql(inventory.artifact_title)}`
  statements.push(`UPDATE research_pipeline_artifacts SET title = ${sql(inventory.artifact_title)}, summary = ${sql(summary)}, content_markdown = ${sql(markdown)}, content_json = ${sql(contentJson)}, status = ${sql(inventory.artifact_status)}, updated_at = datetime('now'), version = version + 1 WHERE ${artifactWhere};`)

  return statements
}

function generateSql(inventory, report) {
  const statements = [
    'PRAGMA foreign_keys = ON;',
    '',
    `-- Generated from ${inventory.inventoryPathForJson}`,
    '-- This file only writes Stage-1 research data. It does not write Stage-1.5 pipeline stages.',
    '-- Amount fields stay out of ingredient_research_sources; use dose_recommendations for quantities.',
    '',
  ]
  const artifactId = artifactIdExpression(inventory)
  const linkNote = `Stage-1 Quelleninventar ${inventory.created_at}`

  statements.push(...createArtifactStatements(inventory, report), '')

  inventory.sources.forEach((source) => {
    const match = sourceMatch(source)
    const assignments = explicitUpdateAssignments(source)
    if (assignments.length) {
      statements.push(`UPDATE ingredient_research_sources SET ${assignments.join(', ')}, updated_at = datetime('now'), version = version + 1 WHERE ingredient_id = ${inventory.ingredient_id} AND ${match};`)
    }
  })

  inventory.sources.forEach((source) => {
    if (asPositiveInteger(source.existing_id)) return

    const values = insertColumns.map((column) => sql(valueForColumn(source, column, inventory))).join(', ')
    const match = sourceMatch(source)
    statements.push(`INSERT INTO ingredient_research_sources (${insertColumns.join(', ')}) SELECT ${values} WHERE NOT EXISTS (SELECT 1 FROM ingredient_research_sources WHERE ingredient_id = ${inventory.ingredient_id} AND ${match});`)

    const assignments = explicitUpdateAssignments(source)
    if (assignments.length) {
      statements.push(`UPDATE ingredient_research_sources SET ${assignments.join(', ')}, updated_at = datetime('now'), version = version + 1 WHERE ingredient_id = ${inventory.ingredient_id} AND ${match};`)
    }
  })

  statements.push('')

  inventory.sources.forEach((source, index) => {
    const sortOrder = (index + 1) * 10
    const match = sourceMatch(source)
    statements.push(`UPDATE research_artifact_sources SET sort_order = ${sortOrder}, note = ${sql(linkNote)} WHERE artifact_id = ${artifactId} AND research_source_id IN (SELECT id FROM ingredient_research_sources WHERE ingredient_id = ${inventory.ingredient_id} AND ${match});`)
    statements.push(`INSERT OR IGNORE INTO research_artifact_sources (artifact_id, research_source_id, sort_order, note) SELECT ${artifactId}, id, ${sortOrder}, ${sql(linkNote)} FROM ingredient_research_sources WHERE ingredient_id = ${inventory.ingredient_id} AND ${match} AND ${artifactId} IS NOT NULL;`)
  })

  statements.push('')
  statements.push(`INSERT OR IGNORE INTO ingredient_research_pipeline_status (ingredient_id, stage, agent_id, status, artifact_id, started_at, completed_at, notes) VALUES (${inventory.ingredient_id}, 'research', 'nutrient-research-analyst', ${sql(inventory.pipeline_status)}, ${artifactId}, datetime('now'), datetime('now'), ${sql(artifactSummary(inventory, report))});`)
  statements.push(`UPDATE ingredient_research_pipeline_status SET agent_id = 'nutrient-research-analyst', status = ${sql(inventory.pipeline_status)}, artifact_id = ${artifactId}, completed_at = COALESCE(completed_at, datetime('now')), notes = ${sql(artifactSummary(inventory, report))}, updated_at = datetime('now'), version = version + 1 WHERE ingredient_id = ${inventory.ingredient_id} AND stage = 'research';`)

  return `${statements.join('\n')}\n`
}

function validationMarkdown(inventory, report) {
  const lines = [
    `# ${inventory.artifact_title} - Validierung`,
    '',
    `Status: ${report.errors.length ? 'BLOCKED' : 'PASS'}`,
    '',
    `- ingredient_id: ${inventory.ingredient_id ?? 'missing'}`,
    `- artifact_id: ${inventory.artifact_id ?? 'create-if-missing by title'}`,
    `- artifact_title: ${inventory.artifact_title || 'missing'}`,
    `- source_count: ${report.counts.sources}`,
    `- existing_source_updates: ${report.counts.existing}`,
    `- new_source_candidates: ${report.counts.inserts}`,
    `- missing_visible_locator: ${report.counts.missingLocator}`,
    `- pdf_status_counts: ${JSON.stringify(report.counts.pdf)}`,
    `- stage2_priority_counts: ${JSON.stringify(report.counts.priorities)}`,
    '',
    '## Regeln',
    '',
    '- Sichtbarer Locator: source_url, DOI oder PubMed-ID.',
    '- Finale PDF-Status: available, stored, paywalled oder unavailable; not_checked blockiert.',
    '- paywalled/unavailable brauchen access_check_note, notes oder meta_summary.',
    '- Stage-2-Priorität: hoch, mittel oder niedrig.',
    '- DOI, PMID und source_url dürfen im Inventar nicht doppelt vorkommen.',
    '- Mengenfelder bleiben aus ingredient_research_sources heraus.',
    '- Pipeline-Stage ist ausschliesslich research; Stage 1.5 wird nicht in research_pipeline_artifacts geschrieben.',
    '',
  ]

  if (report.warnings.length) {
    lines.push('## Warnungen', '')
    report.warnings.forEach((warning) => lines.push(`- ${warning}`))
    lines.push('')
  }

  if (report.errors.length) {
    lines.push('## Fehler', '')
    report.errors.forEach((error) => lines.push(`- ${error}`))
    lines.push('')
  }

  return lines.join('\n')
}

function printDryRun(inventory, report) {
  console.log(`${inventory.ingredient_name || `ingredient ${inventory.ingredient_id}`} Stage-1 inventory dry run`)
  console.log(`- validation: ${report.errors.length ? 'BLOCKED' : 'PASS'}`)
  console.log(`- ingredient_id: ${inventory.ingredient_id}`)
  console.log(`- artifact_id: ${inventory.artifact_id ?? 'create-if-missing by title'}`)
  console.log(`- artifact_title: ${inventory.artifact_title}`)
  console.log(`- sources: ${report.counts.sources}`)
  console.log(`- existing rows to enrich: ${report.counts.existing}`)
  console.log(`- candidate inserts: ${report.counts.inserts}`)
  console.log(`- pdf_status_counts: ${JSON.stringify(report.counts.pdf)}`)
  console.log(`- stage2_priority_counts: ${JSON.stringify(report.counts.priorities)}`)
  report.warnings.forEach((warning) => console.warn(`warning: ${warning}`))
  report.errors.forEach((error) => console.error(`error: ${error}`))
}

function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, 'utf8')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const inventoryPath = resolve(args.inventory)
  const raw = JSON.parse(readFileSync(inventoryPath, 'utf8'))
  const inventory = normalizeInventory(raw, inventoryPath)
  const report = validateInventory(inventory)

  printDryRun(inventory, report)

  if (args.writeValidation) {
    const validationPath = resolve(args.validationPath || defaultValidationPath(inventoryPath))
    writeText(validationPath, `${validationMarkdown(inventory, report)}\n`)
    console.log(`- wrote validation: ${validationPath}`)
  }

  if (report.errors.length) {
    process.exitCode = 1
    return
  }

  const sqlPath = resolve(args.sqlPath || defaultSqlPath(inventoryPath))
  if (args.writeSql || args.apply) {
    writeText(sqlPath, generateSql(inventory, report))
    console.log(`- wrote SQL: ${sqlPath}`)
  }

  if (args.apply) {
    execFileSync('npx', ['wrangler', 'd1', 'execute', args.d1, '--local', '--file', sqlPath], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
