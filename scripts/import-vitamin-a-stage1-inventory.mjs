#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const inventoryPath = resolve('_research_raw/vitamin-a-stage1-inventory-2026-05-22.json')
const outputSqlPath = resolve('_research_raw/vitamin-a-stage1-inventory-2026-05-22.sql')

const allowedPdfStatuses = new Set(['not_checked', 'available', 'stored', 'paywalled', 'unavailable'])
const allowedPriorities = new Set(['hoch', 'mittel', 'niedrig'])
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
  'per_kg_body_weight',
  'study_type',
  'evidence_quality',
  'source_title',
  'source_url',
  'doi',
  'pubmed_id',
  'notes',
  'source_date',
  ...inventoryColumns,
]
const existingUpdateColumns = [
  'source_url',
  'doi',
  'pubmed_id',
  ...inventoryColumns,
]

function sql(value) {
  if (value === undefined || value === null || value === '') {
    return 'NULL'
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL'
  }
  return `'${String(value).replaceAll("'", "''")}'`
}

function key(value) {
  return String(value ?? '').trim().toLowerCase()
}

function validate(inventory) {
  const errors = []
  const seen = {
    doi: new Map(),
    pubmed_id: new Map(),
    source_url: new Map(),
    existing_id: new Map(),
  }

  inventory.sources.forEach((source, index) => {
    const label = source.existing_id ? `existing ${source.existing_id}` : source.source_title
    if (!source.source_title) errors.push(`Missing source_title at row ${index + 1}`)
    if (!source.source_url && !source.doi && !source.pubmed_id) {
      errors.push(`Missing artifact locator for ${label}: source_url, doi, or pubmed_id is required`)
    }
    if (source.pdf_status && !allowedPdfStatuses.has(source.pdf_status)) {
      errors.push(`Invalid pdf_status for ${label}: ${source.pdf_status}`)
    }
    if ((source.pdf_status === 'available' || source.pdf_status === 'stored') && !source.pdf_url && !source.archive_url && !source.pdf_storage_key) {
      errors.push(`pdf_status ${source.pdf_status} needs pdf_url, archive_url, or pdf_storage_key for ${label}`)
    }
    if (source.stage2_priority && !allowedPriorities.has(source.stage2_priority)) {
      errors.push(`Invalid stage2_priority for ${label}: ${source.stage2_priority}`)
    }

    for (const field of Object.keys(seen)) {
      const value = key(source[field])
      if (!value) continue
      if (seen[field].has(value)) {
        errors.push(`Duplicate ${field} ${source[field]}: ${seen[field].get(value)} and ${label}`)
      }
      seen[field].set(value, label)
    }
  })

  if (errors.length) {
    throw new Error(errors.join('\n'))
  }
}

function sourceMatch(source) {
  if (source.existing_id) {
    return `id = ${Number(source.existing_id)}`
  }

  const clauses = []
  if (source.doi) clauses.push(`lower(doi) = lower(${sql(source.doi)})`)
  if (source.pubmed_id) clauses.push(`pubmed_id = ${sql(source.pubmed_id)}`)
  if (source.source_url) clauses.push(`source_url = ${sql(source.source_url)}`)
  return clauses.length ? `(${clauses.join(' OR ')})` : '0'
}

function baseValue(source, column, ingredientId) {
  if (column === 'ingredient_id') return ingredientId
  if (column === 'no_recommendation' || column === 'per_kg_body_weight') return 0
  if (column === 'study_type') return source.study_design ?? source.study_type ?? null
  return source[column] ?? null
}

function artifactMarkdown(inventory) {
  const officialCount = inventory.sources.filter((source) => source.source_kind === 'official' || source.existing_id && source.existing_id <= 4 || source.existing_id >= 14 && source.existing_id <= 16 || source.existing_id === 19).length
  const studyCount = inventory.sources.length - officialCount
  const lines = [
    '# Vitamin A - Stage-1 Quelleninventar',
    '',
    'Status: kontrollierter Stage-1-Research-Durchlauf, gespeichert am 2026-05-22.',
    '',
    'Hinweis: Dieses Artefakt ist ein Quelleninventar. Es enthält keine Tiefeninterpretation, keine Therapieempfehlung und keine individuelle Dosierungsempfehlung.',
    '',
    `Umfang: ${inventory.sources.length} Quellen (${officialCount} institutionelle/regulatorische Quellen, ${studyCount} Studien/Reviews/Meta-Analysen).`,
    '',
    '## Quellen',
    '',
  ]

  inventory.sources.forEach((source, index) => {
    const ids = []
    if (source.doi) ids.push(`DOI ${source.doi}`)
    if (source.pubmed_id) ids.push(`PMID ${source.pubmed_id}`)
    const link = source.source_url ? `Link: ${source.source_url}` : `Link/ID FEHLT IM IMPORT-MANIFEST (${ids.join('; ') || 'source_url/doi/pubmed_id fehlen'})`
    const pdf = source.pdf_status ? `PDF-Status: ${source.pdf_status}${source.pdf_url ? ` (${source.pdf_url})` : ''}${source.archive_url ? `; Archiv: ${source.archive_url}` : ''}${source.pdf_storage_key ? `; R2: ${source.pdf_storage_key}` : ''}` : 'PDF-Status: NICHT GESETZT'
    const meta = [
      source.source_language ? `Sprache: ${source.source_language}` : null,
      source.source_country ? `Land/Region: ${source.source_country}` : null,
      source.publication_year ? `Jahr: ${source.publication_year}` : null,
      source.study_design ? `Design: ${source.study_design}` : null,
      source.participant_count ? `n=${source.participant_count}` : null,
      source.duration_summary ? `Dauer: ${source.duration_summary}` : null,
    ].filter(Boolean).join('; ')

    const note = source.meta_summary ? `; Notiz: ${source.meta_summary}` : ''
    lines.push(`- **${index + 1}. ${source.source_title}** | Priorität: ${source.stage2_priority ?? 'mittel'} | ${link}${ids.length ? `; ${ids.join('; ')}` : ''} | ${pdf} | Thema: ${source.topic_summary ?? 'NICHT IM INPUT VERFÜGBAR'} | Meta: ${meta || 'NICHT IM INPUT VERFÜGBAR'}${note}`)
  })

  return lines.join('\n')
}

function generateSql(inventory) {
  const statements = []
  const note = 'Stage-1 Quelleninventar 2026-05-22'
  const updateAssignments = (source) => existingUpdateColumns
    .filter((column) => source[column] !== undefined)
    .map((column) => `${column} = ${sql(source[column])}`)

  inventory.sources.forEach((source) => {
    if (!source.existing_id) return
    const assignments = updateAssignments(source)
    statements.push(`UPDATE ingredient_research_sources SET ${assignments.join(', ')}, updated_at = datetime('now'), version = version + 1 WHERE ingredient_id = ${inventory.ingredient_id} AND id = ${Number(source.existing_id)};`)
  })

  inventory.sources.forEach((source) => {
    if (source.existing_id) return
    const values = insertColumns.map((column) => sql(baseValue(source, column, inventory.ingredient_id))).join(', ')
    const assignments = updateAssignments(source)
    statements.push(`INSERT INTO ingredient_research_sources (${insertColumns.join(', ')}) SELECT ${values} WHERE NOT EXISTS (SELECT 1 FROM ingredient_research_sources WHERE ingredient_id = ${inventory.ingredient_id} AND ${sourceMatch(source)});`)
    statements.push(`UPDATE ingredient_research_sources SET ${assignments.join(', ')}, updated_at = datetime('now'), version = version + 1 WHERE ingredient_id = ${inventory.ingredient_id} AND ${sourceMatch(source)};`)
  })

  inventory.sources.forEach((source, index) => {
    const sortOrder = (index + 1) * 10
    const match = sourceMatch(source)
    statements.push(`UPDATE research_artifact_sources SET sort_order = ${sortOrder}, note = ${sql(note)} WHERE artifact_id = ${inventory.artifact_id} AND research_source_id IN (SELECT id FROM ingredient_research_sources WHERE ingredient_id = ${inventory.ingredient_id} AND ${match});`)
    statements.push(`INSERT OR IGNORE INTO research_artifact_sources (artifact_id, research_source_id, sort_order, note) SELECT ${inventory.artifact_id}, id, ${sortOrder}, ${sql(note)} FROM ingredient_research_sources WHERE ingredient_id = ${inventory.ingredient_id} AND ${match};`)
  })

  const markdown = artifactMarkdown(inventory)
  const summary = `Stage-1-Quelleninventar für Vitamin A mit ${inventory.sources.length} deduplizierten Quellen; strukturierte Felder für Link, PDF-Status, Thema, Metadaten und Stage-2-Priorität befüllt.`
  const priorityCounts = inventory.sources.reduce((acc, source) => {
    const priority = source.stage2_priority ?? 'mittel'
    acc[priority] = (acc[priority] ?? 0) + 1
    return acc
  }, {})
  const pdfStatusCounts = inventory.sources.reduce((acc, source) => {
    const status = source.pdf_status ?? 'not_checked'
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
  const contentJson = JSON.stringify({
    ingredient_id: inventory.ingredient_id,
    artifact_id: inventory.artifact_id,
    generated_at: inventory.created_at,
    inventory_path: '_research_raw/vitamin-a-stage1-inventory-2026-05-22.json',
    source_count: inventory.sources.length,
    existing_source_updates: inventory.sources.filter((source) => source.existing_id).length,
    new_source_candidates: inventory.sources.filter((source) => !source.existing_id).length,
    sources_with_source_url: inventory.sources.filter((source) => source.source_url).length,
    missing_source_locator: inventory.sources.filter((source) => !source.source_url && !source.doi && !source.pubmed_id).length,
    pdf_available_or_stored: inventory.sources.filter((source) => source.pdf_status === 'available' || source.pdf_status === 'stored').length,
    pdf_status_counts: pdfStatusCounts,
    sources_with_pdf_url: inventory.sources.filter((source) => source.pdf_url).length,
    sources_with_archive_url: inventory.sources.filter((source) => source.archive_url).length,
    sources_with_pdf_storage_key: inventory.sources.filter((source) => source.pdf_storage_key).length,
    stage2_priority_counts: priorityCounts,
  })
  statements.push(`UPDATE research_pipeline_artifacts SET title = ${sql('Vitamin A - Stage-1 Quelleninventar')}, summary = ${sql(summary)}, content_markdown = ${sql(markdown)}, content_json = ${sql(contentJson)}, status = 'pending_review', updated_at = datetime('now'), version = version + 1 WHERE id = ${inventory.artifact_id} AND ingredient_id = ${inventory.ingredient_id} AND stage = 'research';`)
  return statements.join('\n')
}

function printDryRun(inventory) {
  const newSources = inventory.sources.filter((source) => !source.existing_id)
  const existingSources = inventory.sources.filter((source) => source.existing_id)
  const availablePdf = inventory.sources.filter((source) => source.pdf_status === 'available' || source.pdf_status === 'stored')
  const priorities = inventory.sources.reduce((acc, source) => {
    const priority = source.stage2_priority ?? 'mittel'
    acc[priority] = (acc[priority] ?? 0) + 1
    return acc
  }, {})

  console.log('Vitamin A Stage-1 inventory dry run')
  console.log(`- ingredient_id: ${inventory.ingredient_id}`)
  console.log(`- artifact_id: ${inventory.artifact_id}`)
  console.log(`- total sources in artifact: ${inventory.sources.length}`)
  console.log(`- existing rows to enrich: ${existingSources.length}`)
  console.log(`- candidate inserts after remote dedupe: ${newSources.length}`)
  console.log(`- sources with available/stored PDF reference: ${availablePdf.length}`)
  console.log(`- Stage-2 priority counts: hoch=${priorities.hoch ?? 0}, mittel=${priorities.mittel ?? 0}, niedrig=${priorities.niedrig ?? 0}`)
}

const args = new Set(process.argv.slice(2))
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'))
validate(inventory)
printDryRun(inventory)

if (args.has('--write-sql') || args.has('--apply')) {
  mkdirSync(dirname(outputSqlPath), { recursive: true })
  writeFileSync(outputSqlPath, `${generateSql(inventory)}\n`, 'utf8')
  console.log(`- wrote SQL: ${outputSqlPath}`)
}

if (args.has('--apply')) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'supplementstack-production', '--remote', '--file', outputSqlPath], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}
