import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const MOJIBAKE_PATTERNS = [
  /\uFFFD/u,
  /(?:Ã[\u0080-\u00BFŸ]|Â[\u0080-\u00BF]|â(?:€|„|€œ|€™|€“|€”|€¦|†|‡)|ðŸ)/u,
  /(?:Ã¤|Ã¶|Ã¼|Ã„|Ã–|Ãœ|ÃŸ|Âµ|â€“|â€”|â€ž|â€œ|â€™|â€¦)/u,
]

const WORKFLOW_TERMS = [
  /\bStage[- ]?[0-4](?:\.5)?\b/iu,
  /\b(?:Evidence[- ]?Funnel|Coverage[- ]?Mapping|Review[- ]?Anker|Review[- ]?Coverage|Handoff|Pipeline)\b/iu,
  /\b(?:Maschinenhinweis|maschinenlesbar|für die Maschine)\b/iu,
  /\b(?:INPUT_GAP|NICHT IM INPUT VERFÜGBAR|DOWNLOAD_NICHT_VERFÜGBAR)\b/u,
  /\b(?:Dieser Artikel|In diesem Artikel|Der Artikel (?:ordnet|trennt)|Relevanz für (?:den )?Hauptartikel|dient als Grundlage|Formulierung prüfen)\b/iu,
  /\b(?:für supplementstack\.de relevant|für die Wissensdatenbank relevant)\b/iu,
]

const GRAPHIC_PLACEHOLDERS = [
  /\b(?:Grafik|Diagramm|Abbildung)[- ]?Briefing\b/iu,
  /\b(?:Grafik|Diagramm|Abbildung)\s+(?:hier|folgt|einfügen|ergänzen|platzieren)\b/iu,
  /\[(?:Grafik|Diagramm|Abbildung|Bild)(?:[^\]]*?)\]/iu,
  /\b(?:TODO|PLACEHOLDER)\s*:?\s*(?:Grafik|Diagramm|Abbildung|Bild)\b/iu,
]

const CLAIM_HINTS = /\b(?:verhindert|heilt|therapiert|senkt|steigert|reduziert|verbessert|schützt|wirkt gegen|führt zu)\b/giu
const QUANTITY_HINTS = /\b\d+(?:[.,]\d+)?\s*(?:µg|μg|mcg|mg|g|kg|ml|l|IE|IU|%|mmol|mol|KBE|CFU)\b/giu

export function decodeUtf8Strict(buffer, label = 'input') {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(3)), errors: [`${label}: UTF-8 BOM is not allowed`] }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), errors: [] }
  } catch {
    return { text: '', errors: [`${label}: invalid UTF-8 byte sequence`] }
  }
}

export function readUtf8Strict(path) {
  return decodeUtf8Strict(readFileSync(path), path)
}

function visibleMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length
}

function issue(code, message, file, line) {
  return { severity: 'error', code, message, file, ...(line ? { line } : {}) }
}

function warning(code, message, file, line) {
  return { severity: 'warning', code, message, file, ...(line ? { line } : {}) }
}

function validateEmptyH2(markdown, file) {
  const issues = []
  const matches = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)]
  for (let index = 0; index < matches.length; index += 1) {
    const heading = matches[index]
    const start = (heading.index ?? 0) + heading[0].length
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? markdown.length) : markdown.length
    const rawSection = markdown.slice(start, end).trim()
    if (heading[1].trim() === 'Quellen' && rawSection === '<!-- sources:auto -->') continue
    const section = visibleMarkdown(markdown.slice(start, end))
      .replace(/^#{3,}\s+.*$/gm, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[\s>*_\-|:]/g, '')
    if (!section) issues.push(issue('EMPTY_H2', `H2 section has no visible content: ${heading[1].trim()}`, file, lineNumber(markdown, heading.index ?? 0)))
  }
  return issues
}

function validateImageAltText(markdown, file) {
  const issues = []
  for (const match of markdown.matchAll(/!\[([^\]\n]*)\]\(([^)\n]+)\)/g)) {
    if (!match[1].trim()) issues.push(issue('IMAGE_ALT', 'Markdown image needs non-empty alt text', file, lineNumber(markdown, match.index ?? 0)))
  }
  for (const match of markdown.matchAll(/<img\b[^>]*>/gi)) {
    const alt = match[0].match(/\balt=["']([^"']*)["']/i)
    if (!alt?.[1]?.trim()) issues.push(issue('IMAGE_ALT', 'HTML image needs non-empty alt text', file, lineNumber(markdown, match.index ?? 0)))
  }
  return issues
}

function validateLinks(markdown, file) {
  const issues = []
  const validLinks = [...markdown.matchAll(/!?\[([^\]\n]*)\]\(([^)\n]*)\)/g)]
  for (const match of validLinks) {
    const target = match[2].trim().replace(/^<|>$/g, '')
    if (!target || /\s/.test(target) || /^(?:javascript|vbscript):/i.test(target)) {
      issues.push(issue('LINK_FORMAT', `Invalid Markdown link target: ${target || '(empty)'}`, file, lineNumber(markdown, match.index ?? 0)))
    }
  }
  const stripped = markdown.replace(/!?\[[^\]\n]*\]\([^)\n]*\)/g, '')
  for (const match of stripped.matchAll(/!?\[[^\]\n]+\]\([^\n)]*(?:$|\n)/gm)) {
    issues.push(issue('LINK_FORMAT', 'Malformed or unclosed Markdown link', file, lineNumber(markdown, match.index ?? 0)))
  }
  return issues
}

function validateDisclosureStructure(markdown, file) {
  const issues = []
  const stack = []
  for (const match of markdown.matchAll(/<\/?(details|summary)\b[^>]*>/gi)) {
    const closing = match[0].startsWith('</')
    const tag = match[1].toLowerCase()
    if (!closing) {
      if (tag === 'summary' && !stack.includes('details')) issues.push(issue('HTML_STRUCTURE', '<summary> must be inside <details>', file, lineNumber(markdown, match.index ?? 0)))
      stack.push(tag)
      continue
    }
    if (stack.at(-1) !== tag) {
      issues.push(issue('HTML_STRUCTURE', `Unbalanced closing </${tag}>`, file, lineNumber(markdown, match.index ?? 0)))
      continue
    }
    stack.pop()
  }
  for (const tag of stack) issues.push(issue('HTML_STRUCTURE', `Unclosed <${tag}>`, file))
  return issues
}

function localImagePaths(markdown) {
  const paths = []
  for (const match of markdown.matchAll(/!\[[^\]\n]*\]\(([^)\n]+)\)/g)) paths.push({ target: match[1].trim().replace(/^<|>$/g, ''), index: match.index ?? 0 })
  for (const match of markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) paths.push({ target: match[1].trim(), index: match.index ?? 0 })
  return paths.filter(({ target }) => !/^(?:https?:|data:|\/\/|\/api\/r2\/knowledge\/)/i.test(target))
}

function resolveLocalAssets(articleFile, target, repoRoot) {
  const clean = decodeURIComponent(target.split(/[?#]/, 1)[0])
  if (clean.startsWith('/')) {
    const relative = clean.replace(/^[/\\]+/, '')
    return [resolve(repoRoot, relative), resolve(repoRoot, 'frontend/public', relative)]
  }
  return [resolve(dirname(articleFile), clean)]
}

function collectStringValues(value, keys, found = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, keys, found)
    return found
  }
  if (!value || typeof value !== 'object') return found
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key)) {
      const values = Array.isArray(child) ? child : [child]
      for (const entry of values) {
        if (typeof entry === 'string' && entry.trim()) found.add(entry.trim())
        else if (entry && typeof entry === 'object') {
          const slug = entry.slug ?? entry.source_slug ?? entry.article_slug
          if (typeof slug === 'string' && slug.trim()) found.add(slug.trim())
        }
      }
    }
    collectStringValues(child, keys, found)
  }
  return found
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function stringArray(value) {
  return Array.isArray(value) && value.every(isNonEmptyString)
}

function duplicateValues(values) {
  const seen = new Set()
  return values.filter((value) => seen.has(value) || !seen.add(value))
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isObject(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
}

export function canonicalJsonHash(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex')}`
}

export function sha256Bytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function withoutKeys(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.has(key)))
}

export function evidenceRecordPayloadHash(record) {
  return canonicalJsonHash(record)
}

export function evidenceBundleContentHash(value) {
  const payload = Array.isArray(value)
    ? { sources: [], records: value }
    : { sources: value?.sources ?? [], records: value?.records ?? [] }
  return canonicalJsonHash(payload)
}

export function coveragePlanContentHash(plan) {
  return canonicalJsonHash(withoutKeys(plan, new Set(['content_hash', 'facts_gate'])))
}

export function normalizeEvidenceRecords(value) {
  if (Array.isArray(value)) return value
  if (value?.schema === 'source_evidence_bundle.v1') return Array.isArray(value.records) ? value.records : []
  return isObject(value) ? [value] : []
}

function normalizeRiskClasses(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value]
}

function validateHash(value, label, file, errors) {
  if (!isNonEmptyString(value) || !/^sha256:[a-f0-9]{64}$/.test(value)) errors.push(issue('EVIDENCE_HASH', `${label} must use sha256:<64 lowercase hex>`, file))
}

export function validateEvidenceRecord(value, file = 'evidence.json') {
  const errors = []
  const requiredStrings = ['record_id', 'source_id', 'claim', 'result', 'safety', 'uncertainty']
  if (value.schema !== 'source_evidence_record.v1') errors.push(issue('JSON_SCHEMA', 'evidence schema must equal source_evidence_record.v1', file))
  for (const key of requiredStrings) if (!isNonEmptyString(value[key])) errors.push(issue('JSON_SCHEMA', `evidence.${key} must be a non-empty string`, file))
  if (!stringArray(value.cluster_keys) || value.cluster_keys.length === 0) errors.push(issue('JSON_SCHEMA', 'evidence.cluster_keys must be a non-empty string array', file))
  if (!isObject(value.provenance) || !isNonEmptyString(value.provenance.location) || !isNonEmptyString(value.provenance.language)) errors.push(issue('JSON_SCHEMA', 'evidence.provenance needs location and language', file))
  if (!isObject(value.quantity)) errors.push(issue('JSON_SCHEMA', 'evidence.quantity must be an object', file))
  else {
    if (!(value.quantity.value === null || Number.isFinite(value.quantity.value))) errors.push(issue('JSON_SCHEMA', 'quantity.value must be null or a finite number', file))
    if (!(value.quantity.unit === null || isNonEmptyString(value.quantity.unit)) || (Number.isFinite(value.quantity.value) && !isNonEmptyString(value.quantity.unit))) errors.push(issue('JSON_SCHEMA', 'quantity.unit must accompany a numeric value', file))
    for (const key of ['schedule', 'duration']) if (!(value.quantity[key] === null || isNonEmptyString(value.quantity[key]))) errors.push(issue('JSON_SCHEMA', `quantity.${key} must be null or non-empty`, file))
    if (value.quantity.is_recommendation !== false) errors.push(issue('JSON_SCHEMA', 'quantity.is_recommendation must be false', file))
  }

  if (!isObject(value.stack_relevance)) {
    errors.push(issue('JSON_SCHEMA', 'evidence.stack_relevance must be an object', file))
  } else {
    if (typeof value.stack_relevance.candidate !== 'boolean') errors.push(issue('JSON_SCHEMA', 'stack_relevance.candidate must be boolean', file))
    if (!isNonEmptyString(value.stack_relevance.use)) errors.push(issue('JSON_SCHEMA', 'stack_relevance.use must be a non-empty string', file))
    if (value.stack_relevance.direct_user_dose_recommendation !== false) errors.push(issue('JSON_SCHEMA', 'stack_relevance.direct_user_dose_recommendation must be false', file))
  }
  return errors
}

export function validateEvidenceSource(value, file = 'evidence.json') {
  const errors = []
  if (!isNonEmptyString(value?.source_id)) errors.push(issue('JSON_SCHEMA', 'evidence source_id must be a non-empty string', file))
  if (!isObject(value?.created_by)) errors.push(issue('JSON_SCHEMA', `source ${value?.source_id ?? '(missing)'} needs created_by`, file))
  else for (const key of ['role', 'id', 'created_at']) if (!isNonEmptyString(value.created_by[key])) errors.push(issue('JSON_SCHEMA', `source ${value.source_id} created_by.${key} is required`, file))
  const locator = value?.source_locator
  if (!isObject(locator) || ![locator?.source_url, locator?.doi, locator?.pmid].some(isNonEmptyString)) errors.push(issue('JSON_SCHEMA', `source ${value?.source_id ?? '(missing)'} needs a locator`, file))
  if (!isObject(value?.methods) || !isNonEmptyString(value.methods.population) || !isNonEmptyString(value.methods.design)) errors.push(issue('JSON_SCHEMA', `source ${value?.source_id ?? '(missing)'} methods need population and design`, file))
  if (!isNonEmptyString(value?.source_artifact_path)) errors.push(issue('SOURCE_ARTIFACT', `source ${value?.source_id ?? '(missing)'} needs source_artifact_path`, file))
  validateHash(value?.source_content_hash, `source ${value?.source_id ?? '(missing)'} source_content_hash`, file, errors)
  return errors
}

export function validateCoveragePlan(value, file = 'coverage.json') {
  const errors = []
  const add = (message) => errors.push(issue('JSON_SCHEMA', message, file))
  const frameworkDecisions = new Set(['existing', 'adapt', 'new'])
  const clusterStatuses = new Set(['covered', 'input_gap', 'not_applicable'])
  const sourceLabels = new Set(['ANCHOR', 'SUPPORTING', 'COVERED_BY_REVIEW', 'LOW_SIGNAL', 'BLOCKED'])
  const articleStatuses = new Set(['planned', 'delegated', 'drafted', 'facts_complete', 'publication_reviewed', 'accepted', 'blocked', 'excluded'])
  const riskClasses = new Set(['standard', 'dose_or_reference', 'safety', 'controversy', 'vulnerable_population'])
  const supportingReasons = new Set(['distinct_uncovered_finding', 'safety_relevance', 'material_controversy', 'distinct_population_or_endpoint'])

  if (value.schema !== 'coverage_plan.v1') add('coverage schema must equal coverage_plan.v1')
  if (!isNonEmptyString(value.coverage_plan_id)) add('coverage.coverage_plan_id must be a non-empty string')
  validateHash(value.content_hash, 'coverage.content_hash', file, errors)
  if (value.content_hash !== coveragePlanContentHash(value)) errors.push(issue('COVERAGE_HASH', 'coverage.content_hash does not match the canonical plan payload', file))
  if (!isNonEmptyString(value.substance)) add('coverage.substance must be a non-empty string')
  if (typeof value.stage4_requested !== 'boolean') add('coverage.stage4_requested must be boolean')
  const stage3Archetypes = new Set(['essential_nutrient', 'nonessential_or_endogenous', 'microorganism_extract_product_category'])
  if (!isObject(value.stage3_archetype_decision)) add('coverage.stage3_archetype_decision must be an object')
  else {
    if (!stage3Archetypes.has(value.stage3_archetype_decision.archetype)) add('stage3_archetype_decision.archetype is invalid')
    if (!isNonEmptyString(value.stage3_archetype_decision.reason)) add('stage3_archetype_decision.reason must be a non-empty string')
    if (!new Set(['planned', 'approved']).has(value.stage3_archetype_decision.status)) add('stage3_archetype_decision.status must be planned or approved')
  }

  const clusters = Array.isArray(value.clusters) ? value.clusters : []
  const sources = Array.isArray(value.sources) ? value.sources : []
  const articles = Array.isArray(value.article_candidates) ? value.article_candidates : []
  if (!Array.isArray(value.clusters) || !clusters.length) add('coverage.clusters must be a non-empty array')
  if (!Array.isArray(value.sources) || !sources.length) add('coverage.sources must be a non-empty array')
  if (!Array.isArray(value.article_candidates)) add('coverage.article_candidates must be an array')

  const clusterKeys = clusters.map((entry) => entry?.cluster_key).filter(isNonEmptyString)
  const sourceIds = sources.map((entry) => entry?.source_id).filter(isNonEmptyString)
  const articleIds = articles.map((entry) => entry?.article_id).filter(isNonEmptyString)
  if (duplicateValues(clusterKeys).length) add('cluster_key values must be unique')
  if (duplicateValues(sourceIds).length) add('source_id values must be unique')
  if (duplicateValues(articleIds).length) add('article_id values must be unique')
  const clusterSet = new Set(clusterKeys)
  const sourceSet = new Set(sourceIds)
  const articleSet = new Set(articleIds)
  const sourceById = new Map(sources.map((entry) => [entry?.source_id, entry]))
  const articleById = new Map(articles.map((entry) => [entry?.article_id, entry]))

  for (const [index, cluster] of clusters.entries()) {
    if (!isObject(cluster)) { add(`clusters[${index}] must be an object`); continue }
    if (!isNonEmptyString(cluster.cluster_key)) add(`clusters[${index}].cluster_key must be a non-empty string`)
    if (typeof cluster.required !== 'boolean') add(`clusters[${index}].required must be boolean`)
    if (!clusterStatuses.has(cluster.status)) add(`clusters[${index}].status is invalid`)
    for (const key of ['primary_source_ids', 'supporting_source_ids', 'article_candidate_ids']) if (!stringArray(cluster[key])) add(`clusters[${index}].${key} must be a string array`)
    for (const id of [...(cluster.primary_source_ids ?? []), ...(cluster.supporting_source_ids ?? [])]) if (!sourceSet.has(id)) add(`cluster ${cluster.cluster_key} references unknown source_id ${id}`)
    for (const id of cluster.article_candidate_ids ?? []) if (!articleSet.has(id)) add(`cluster ${cluster.cluster_key} references unknown article_id ${id}`)
    if (cluster.status === 'covered' && !(cluster.primary_source_ids?.length || cluster.supporting_source_ids?.length)) add(`covered cluster ${cluster.cluster_key} needs a source relation`)
    if (cluster.required && cluster.status !== 'covered' && !isNonEmptyString(cluster.reason)) add(`required ${cluster.status} cluster ${cluster.cluster_key} needs a reason`)
  }

  for (const [index, source] of sources.entries()) {
    if (!isObject(source)) { add(`sources[${index}] must be an object`); continue }
    if (!isNonEmptyString(source.source_id)) add(`sources[${index}].source_id must be a non-empty string`)
    if (!sourceLabels.has(source.stage15_label)) add(`source ${source.source_id ?? index} has invalid stage15_label`)
    if (!isNonEmptyString(source.source_url) || !/^https?:\/\//i.test(source.source_url)) add(`source ${source.source_id ?? index} needs an HTTP(S) source_url`)
    if (!stringArray(source.covered_by_source_ids)) add(`source ${source.source_id ?? index}.covered_by_source_ids must be a string array`)
    for (const id of source.covered_by_source_ids ?? []) if (!sourceSet.has(id)) add(`source ${source.source_id ?? index} references unknown covering source ${id}`)
    if (!stringArray(source.assigned_article_ids)) add(`source ${source.source_id ?? index}.assigned_article_ids must be a string array`)
    for (const assignedArticleId of source.assigned_article_ids ?? []) {
      if (!articleSet.has(assignedArticleId)) add(`source ${source.source_id ?? index} references unknown assigned_article_id ${assignedArticleId}`)
      const assigned = articleById.get(assignedArticleId)
      const assignedSources = new Set([assigned?.primary_source_id, ...(assigned?.integrated_source_ids ?? [])])
      if (!assignedSources.has(source.source_id)) add(`source ${source.source_id} assignment is inconsistent with article ${assignedArticleId}`)
    }
  }

  for (const [index, article] of articles.entries()) {
    if (!isObject(article)) { add(`article_candidates[${index}] must be an object`); continue }
    if (!isNonEmptyString(article.article_id)) add(`article_candidates[${index}].article_id must be a non-empty string`)
    if (!isNonEmptyString(article.primary_source_id) || !sourceSet.has(article.primary_source_id)) add(`article ${article.article_id ?? index} references unknown primary_source_id`)
    if (!stringArray(article.integrated_source_ids)) add(`article ${article.article_id ?? index}.integrated_source_ids must be a string array`)
    for (const id of article.integrated_source_ids ?? []) if (!sourceSet.has(id)) add(`article ${article.article_id ?? index} references unknown integrated source ${id}`)
    for (const id of [article.primary_source_id, ...(article.integrated_source_ids ?? [])]) {
      const source = sourceById.get(id)
      if (source && ['BLOCKED', 'LOW_SIGNAL'].includes(source.stage15_label)) add(`article ${article.article_id ?? index} must not use ${source.stage15_label} source ${id}`)
      if (source && !(source.assigned_article_ids ?? []).includes(article.article_id)) add(`article ${article.article_id ?? index} source ${id} has inconsistent assigned_article_ids`)
    }
    if (!stringArray(article.cluster_keys) || !article.cluster_keys.length) add(`article ${article.article_id ?? index} must cover at least one cluster`)
    for (const key of article.cluster_keys ?? []) if (!clusterSet.has(key)) add(`article ${article.article_id ?? index} references unknown cluster ${key}`)
    if (!(article.cluster_keys ?? []).some((key) => clusters.some((cluster) => cluster.cluster_key === key && cluster.required))) add(`article ${article.article_id ?? index} must cover at least one required cluster`)
    if (!isNonEmptyString(article.own_article_reason)) add(`article ${article.article_id ?? index}.own_article_reason must be a non-empty string`)
    const risks = article.risk_class
    if (!stringArray(risks) || !risks.length || risks.some((risk) => !riskClasses.has(risk))) add(`article ${article.article_id ?? index} risk_class must be a non-empty valid string array`)
    if (risks.includes('standard') && risks.length > 1) add(`article ${article.article_id ?? index} cannot combine standard with higher risk`)
    if (!articleStatuses.has(article.status)) add(`article ${article.article_id ?? index} has invalid status`)
    if (sourceById.get(article.primary_source_id)?.stage15_label === 'SUPPORTING' && !supportingReasons.has(article.own_article_reason)) add(`Supporting article ${article.article_id ?? index} needs an allowed own_article_reason`)
    if (!isObject(article.framework_fit)) {
      add(`article ${article.article_id ?? index} needs framework_fit`)
    } else {
      const fit = article.framework_fit
      if (!frameworkDecisions.has(fit.decision)) add(`article ${article.article_id ?? index} framework_fit.decision is invalid`)
      for (const key of ['framework_id', 'variant_id', 'reason']) if (!isNonEmptyString(fit[key])) add(`article ${article.article_id ?? index} framework_fit.${key} is required`)
      if (!isObject(fit.owner_approval)) add(`article ${article.article_id ?? index} framework_fit.owner_approval is required`)
      if (!isObject(fit.pilot)) add(`article ${article.article_id ?? index} framework_fit.pilot is required`)
      if (fit.decision === 'new' && (fit.owner_approval?.status !== 'approved' || fit.pilot?.status !== 'passed')) add(`article ${article.article_id ?? index} new framework requires approved owner gate and passed pilot whenever used`)
      if (fit.decision === 'existing' && (fit.owner_approval?.required !== false || fit.owner_approval?.status !== 'not_required' || fit.pilot?.required !== false || fit.pilot?.status !== 'not_required')) add(`article ${article.article_id ?? index} existing framework must not require owner approval or pilot`)
    }
    if (!isNonEmptyString(article.source_archetype)) add(`article ${article.article_id ?? index}.source_archetype is required`)
    const publicationGate = article.publication_gate
    if (['publication_reviewed', 'accepted'].includes(article.status) && (!isObject(publicationGate) || String(publicationGate.result).toUpperCase() !== 'PASS')) add(`article ${article.article_id ?? index} cannot advance publication status without publication_gate PASS`)
    if (article.status === 'accepted' && publicationGate?.status !== 'accepted') add(`article ${article.article_id ?? index} accepted status requires publication_gate.status=accepted`)
    if (article.status === 'facts_complete' && value.facts_gate?.status !== 'pass') add(`article ${article.article_id ?? index} facts_complete requires facts_gate pass`)
    if (article.publication_status != null && !new Set(['drafted', 'reviewed', 'accepted', 'blocked']).has(article.publication_status)) add(`article ${article.article_id ?? index} has invalid publication_status`)
    if (['reviewed', 'accepted'].includes(article.publication_status) && (!isObject(publicationGate) || String(publicationGate.result).toUpperCase() !== 'PASS')) add(`article ${article.article_id ?? index} cannot advance publication_status without publication_gate PASS`)
    if (article.publication_status === 'accepted' && publicationGate?.status !== 'accepted') add(`article ${article.article_id ?? index} accepted publication_status requires publication_gate.status=accepted`)
    if (article.facts_status === 'complete' && value.facts_gate?.status !== 'pass') add(`article ${article.article_id ?? index} facts_status complete requires facts_gate pass`)
  }

  for (const cluster of clusters) {
    for (const articleId of cluster?.article_candidate_ids ?? []) {
      const candidate = articleById.get(articleId)
      if (candidate && !(candidate.cluster_keys ?? []).includes(cluster.cluster_key)) add(`cluster ${cluster.cluster_key} and article ${articleId} assignments are inconsistent`)
    }
  }
  for (const article of articles) {
    for (const clusterKey of article?.cluster_keys ?? []) {
      const cluster = clusters.find((entry) => entry?.cluster_key === clusterKey)
      if (cluster && !(cluster.article_candidate_ids ?? []).includes(article.article_id)) add(`article ${article.article_id} and cluster ${clusterKey} assignments are inconsistent`)
    }
  }

  if (!isObject(value.facts_gate)) {
    add('coverage.facts_gate must be an object')
  } else {
    if (!new Set(['pending', 'pass', 'blocked']).has(value.facts_gate.status)) add('facts_gate.status must be pending, pass, or blocked')
    for (const key of ['required_record_ids', 'validated_record_ids', 'missing_cluster_keys', 'blocking_gaps']) if (!stringArray(value.facts_gate[key])) add(`facts_gate.${key} must be a string array`)
    for (const key of value.facts_gate.missing_cluster_keys ?? []) if (!clusterSet.has(key)) add(`facts_gate references unknown missing cluster ${key}`)
    if (value.facts_gate.status === 'pass' && ((value.facts_gate.missing_cluster_keys?.length ?? 0) || (value.facts_gate.blocking_gaps?.length ?? 0))) add('facts_gate pass cannot retain missing clusters or blocking gaps')
    if (value.facts_gate.status === 'pass') {
      for (const key of ['evidence_bundle_id', 'gate_artifact_id']) if (!isNonEmptyString(value.facts_gate[key])) add(`facts_gate.${key} must be a non-empty string for pass`)
      if (!stringArray(value.facts_gate.source_facts_review_ids) || !value.facts_gate.source_facts_review_ids.length || duplicateValues(value.facts_gate.source_facts_review_ids).length) add('facts_gate.source_facts_review_ids must be a non-empty unique string array for pass')
      validateHash(value.facts_gate.evidence_bundle_content_hash, 'facts_gate.evidence_bundle_content_hash', file, errors)
      if (!value.facts_gate.required_record_ids?.length) add('facts_gate pass requires non-empty required_record_ids')
      if (duplicateValues(value.facts_gate.required_record_ids ?? []).length) add('facts_gate.required_record_ids must be unique')
      if (duplicateValues(value.facts_gate.validated_record_ids ?? []).length || !sameSet(new Set(value.facts_gate.required_record_ids ?? []), new Set(value.facts_gate.validated_record_ids ?? []))) add('facts_gate validated_record_ids must exactly match required_record_ids')
    }
  }
  return errors
}

function candidateRisksForSource(coveragePlan, sourceId) {
  const risks = new Set()
  for (const candidate of coveragePlan?.article_candidates ?? []) {
    const sources = new Set([candidate.primary_source_id, ...(candidate.integrated_source_ids ?? [])])
    if (sources.has(sourceId)) for (const risk of normalizeRiskClasses(candidate.risk_class)) risks.add(risk)
  }
  return risks.size ? [...risks] : ['standard']
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((entry) => right.has(entry))
}

export function deterministicStandardSample(recordIds, seed, expandedToFullBatch = false) {
  const eligible = [...new Set(recordIds)].sort()
  if (expandedToFullBatch) return eligible
  const count = Math.min(eligible.length, Math.max(2, Math.ceil(eligible.length * 0.25)))
  return eligible.map((id) => ({ id, rank: createHash('sha256').update(`${seed}:${id}`).digest('hex') }))
    .sort((a, b) => a.rank.localeCompare(b.rank) || a.id.localeCompare(b.id)).slice(0, count).map(({ id }) => id)
}

function validateStackProjection(record, source, stage4Requested, file) {
  const errors = []
  if (!stage4Requested) {
    if (record.stack_projection != null) errors.push(issue('STAGE4_PROJECTION', `evidence ${record.record_id} must omit stack_projection when stage4_requested=false`, file))
    return errors
  }
  const p = record.stack_projection
  if (!isObject(p)) return [issue('STAGE4_PROJECTION', `evidence ${record.record_id} needs stack_projection when stage4_requested=true`, file)]
  if (record.stack_relevance?.candidate !== true) {
    if (p.status !== 'not_applicable') errors.push(issue('STAGE4_PROJECTION', `non-candidate ${record.record_id} must use not_applicable`, file))
    return errors
  }
  if (p.status !== 'ready') return [issue('STAGE4_PROJECTION', `stack candidate ${record.record_id} must be ready`, file)]
  if (!Number.isInteger(p.ingredient_id) || p.ingredient_id <= 0) errors.push(issue('STAGE4_PROJECTION', 'ingredient_id must be a positive integer', file))
  if (!new Set(['adult', 'pregnant', 'breastfeeding', 'children', 'elderly']).has(p.population_key)) errors.push(issue('STAGE4_PROJECTION', 'population_key is invalid', file))
  if (!Number.isInteger(p.population_id) || p.population_id <= 0 || p.population_slug !== p.population_key) errors.push(issue('STAGE4_PROJECTION', 'population_id must be resolved and population_slug must equal population_key', file))
  if (!(p.dose_min === null || Number.isFinite(p.dose_min)) || !Number.isFinite(p.dose_max) || p.dose_max < 0 || (Number.isFinite(p.dose_min) && (p.dose_min < 0 || p.dose_min > p.dose_max))) errors.push(issue('STAGE4_PROJECTION', 'dose_min/dose_max must be finite nonnegative ordered numbers', file))
  if (!isNonEmptyString(p.unit) || /(?:\/kg|per\s*kg|â€“|–|\bto\b)/iu.test(p.unit)) errors.push(issue('STAGE4_PROJECTION', 'unit must be one canonical non-per-kg unit', file))
  if (!new Set(['recommended_amount', 'tested_amount', 'reference_value']).has(p.amount_type)) errors.push(issue('STAGE4_PROJECTION', 'amount_type is invalid', file))
  if (!new Set(['dge', 'study', 'country_framework', 'influencer']).has(p.stage4_source_kind)) errors.push(issue('STAGE4_PROJECTION', 'stage4_source_kind is invalid', file))
  if (!new Set(['official', 'study', 'profile', 'user_private', 'user_public']).has(p.source_type)) errors.push(issue('STAGE4_PROJECTION', 'source_type is invalid', file))
  const mappings = { dge: ['official', 'reference_value'], study: ['study', 'tested_amount'], country_framework: ['official', null], influencer: ['profile', null] }
  const mapping = mappings[p.stage4_source_kind]
  if (mapping && (p.source_type !== mapping[0] || (mapping[1] && p.amount_type !== mapping[1]))) errors.push(issue('STAGE4_PROJECTION', 'source kind/type/amount mapping is inconsistent', file))
  if (p.stage4_source_kind === 'influencer' && (!Number.isInteger(p.verified_profile_id) || p.verified_profile_id <= 0)) errors.push(issue('STAGE4_PROJECTION', 'influencer projection needs verified_profile_id', file))
  if (p.source_url !== source?.source_locator?.source_url) errors.push(issue('STAGE4_PROJECTION', 'projection source_url must equal source header locator', file))
  if (!new Set(['standard', 'alternative', 'tie', 'not_in_stack']).has(p.stack_role)) errors.push(issue('STAGE4_PROJECTION', 'stack_role is invalid', file))
  if (typeof p.stack_visible !== 'boolean' || typeof p.is_controversial !== 'boolean' || typeof p.is_athlete !== 'boolean') errors.push(issue('STAGE4_PROJECTION', 'projection booleans are invalid', file))
  if (p.stack_role === 'not_in_stack' && p.stack_visible !== false) errors.push(issue('STAGE4_PROJECTION', 'not_in_stack must be invisible', file))
  if (p.stack_role === 'tie' && p.is_controversial !== true) errors.push(issue('STAGE4_PROJECTION', 'tie must be controversial', file))
  if (!new Set(['male', 'female', null]).has(p.sex_filter)) errors.push(issue('STAGE4_PROJECTION', 'sex_filter is invalid', file))
  if (!new Set(['maintenance', 'deficiency_correction', 'therapeutic']).has(p.purpose) || p.purpose === 'therapeutic') errors.push(issue('STAGE4_PROJECTION', 'therapeutic or invalid purpose is blocked', file))
  for (const key of ['reported_amount_text', 'source_label', 'relevance_reason']) if (!isNonEmptyString(p[key])) errors.push(issue('STAGE4_PROJECTION', `${key} is required`, file))
  return errors
}

function requiredReviewScopes(risks, stage4Candidate) {
  const scopes = new Set(['source_fidelity', 'coverage_crossrefs'])
  if (risks.includes('safety')) scopes.add('safety')
  if (risks.includes('dose_or_reference')) scopes.add('quantity')
  if (risks.includes('controversy')) scopes.add('controversy')
  if (risks.includes('vulnerable_population')) scopes.add('population')
  if (stage4Candidate) for (const value of ['quantity', 'population_mapping', 'stage4_projection']) scopes.add(value)
  return [...scopes]
}

export function validateEvidencePipeline({ coveragePlan, evidenceBundle, sourceFactsReviews, factsCompletenessGate, sourceArtifacts = {}, file = 'evidence-pipeline.json' }) {
  const errors = []
  if (!coveragePlan || !evidenceBundle) return [issue('BUNDLE_SCHEMA', 'coveragePlan and evidenceBundle are required', file)]
  errors.push(...validateCoveragePlan(coveragePlan, file))
  const records = normalizeEvidenceRecords(evidenceBundle)
  const sources = Array.isArray(evidenceBundle.sources) ? evidenceBundle.sources : []
  if (evidenceBundle.schema !== 'source_evidence_bundle.v1' || !records.length || !sources.length) errors.push(issue('BUNDLE_SCHEMA', 'bundle needs schema, non-empty sources and records', file))
  if (coveragePlan.facts_gate?.status !== 'pass' || coveragePlan.stage3_archetype_decision?.status !== 'approved') errors.push(issue('FACTS_GATE_ARTIFACT', 'pipeline consumption requires coverage facts_gate pass and approved Stage-3 archetype', file))
  if (evidenceBundle.coverage_plan_id !== coveragePlan.coverage_plan_id || evidenceBundle.coverage_plan_content_hash !== coveragePlan.content_hash) errors.push(issue('EVIDENCE_COVERAGE_MISMATCH', 'bundle must bind the coverage plan ID and canonical hash', file))
  if (evidenceBundle.stage4_requested !== coveragePlan.stage4_requested) errors.push(issue('STAGE4_PROJECTION', 'bundle and coverage stage4_requested must match', file))
  const sourceIds = sources.map((s) => s?.source_id).filter(isNonEmptyString)
  const recordIds = records.map((r) => r?.record_id).filter(isNonEmptyString)
  if (duplicateValues(sourceIds).length || duplicateValues(recordIds).length) errors.push(issue('BUNDLE_RECORD_IDS', 'source_id and record_id values must be unique', file))
  const sourceById = new Map(sources.map((s) => [s?.source_id, s]))
  const recordSourceIds = new Set(records.map((record) => record?.source_id).filter(isNonEmptyString))
  if (!sameSet(new Set(sourceIds), recordSourceIds)) errors.push(issue('BUNDLE_SCHEMA', 'bundle source headers must exactly match sources used by records', file))
  for (const source of sources) {
    errors.push(...validateEvidenceSource(source, file))
    const bytes = sourceArtifacts instanceof Map ? sourceArtifacts.get(source.source_id) : sourceArtifacts[source.source_id]
    if (!(typeof bytes === 'string' || bytes instanceof Uint8Array)) errors.push(issue('SOURCE_ARTIFACT', `source ${source.source_id} artifact bytes were not supplied`, file))
    else if (sha256Bytes(bytes) !== source.source_content_hash) errors.push(issue('SOURCE_ARTIFACT_HASH', `source ${source.source_id} hash does not match artifact bytes`, file))
    const plannedSource = (coveragePlan.sources ?? []).find((entry) => entry.source_id === source.source_id)
    if (!plannedSource || plannedSource.source_url !== source.source_locator?.source_url || ['BLOCKED', 'LOW_SIGNAL'].includes(plannedSource.stage15_label)) errors.push(issue('EVIDENCE_COVERAGE_MISMATCH', `source ${source.source_id} is not an eligible hash-identical coverage source`, file))
  }
  const coverageSources = new Set((coveragePlan.sources ?? []).map((s) => s.source_id))
  const clusters = new Set((coveragePlan.clusters ?? []).map((c) => c.cluster_key))
  for (const record of records) {
    errors.push(...validateEvidenceRecord(record, file))
    if (!sourceById.has(record.source_id) || !coverageSources.has(record.source_id)) errors.push(issue('EVIDENCE_COVERAGE_MISMATCH', `evidence ${record.record_id} has unknown source_id`, file))
    for (const key of record.cluster_keys ?? []) if (!clusters.has(key)) errors.push(issue('EVIDENCE_COVERAGE_MISMATCH', `evidence ${record.record_id} has unknown cluster ${key}`, file))
    errors.push(...validateStackProjection(record, sourceById.get(record.source_id), coveragePlan.stage4_requested, file))
  }
  validateHash(evidenceBundle.content_hash, 'bundle.content_hash', file, errors)
  if (evidenceBundle.content_hash !== evidenceBundleContentHash(evidenceBundle)) errors.push(issue('EVIDENCE_HASH', 'bundle.content_hash does not match canonical sources+records payload', file))
  const requiredIds = coveragePlan.facts_gate?.required_record_ids ?? []
  if (!sameSet(new Set(requiredIds), new Set(recordIds)) || duplicateValues(requiredIds).length) errors.push(issue('FACTS_GATE_RECORDS', 'coverage required_record_ids must exactly and uniquely match bundle records', file))

  const reviews = Array.isArray(sourceFactsReviews) ? sourceFactsReviews : []
  if (!reviews.length) errors.push(issue('SOURCE_FACTS_REVIEW', 'at least one source_facts_review.v1 artifact is required', file))
  const reviewIds = reviews.map((r) => r?.review_id).filter(isNonEmptyString)
  if (duplicateValues(reviewIds).length) errors.push(issue('SOURCE_FACTS_REVIEW', 'review IDs must be unique', file))
  const resultsByRecord = new Map()
  for (const review of reviews) {
    if (review?.schema !== 'source_facts_review.v1' || review.status !== 'pass') errors.push(issue('SOURCE_FACTS_REVIEW', 'every review shard must be source_facts_review.v1 with status pass', file))
    if (review.bundle_id !== evidenceBundle.bundle_id || review.bundle_content_hash !== evidenceBundle.content_hash) errors.push(issue('SOURCE_FACTS_REVIEW', `review ${review?.review_id} has stale bundle binding`, file))
    if (review.reviewer?.role !== 'source-facts-reviewer' || !isNonEmptyString(review.reviewer?.id)) errors.push(issue('SOURCE_FACTS_REVIEW', `review ${review?.review_id} needs an identified source-facts-reviewer`, file))
    const reviewedAt = Date.parse(review.reviewed_at)
    if (!Number.isFinite(reviewedAt)) errors.push(issue('REVIEW_TIME', `review ${review?.review_id} has invalid reviewed_at`, file))
    if (!Array.isArray(review.record_results) || !review.record_results.length) errors.push(issue('SOURCE_FACTS_REVIEW', `review ${review?.review_id} needs record_results`, file))
    for (const result of review.record_results ?? []) {
      if (resultsByRecord.has(result.record_id)) errors.push(issue('SOURCE_FACTS_REVIEW', `record ${result.record_id} occurs in more than one review shard`, file))
      resultsByRecord.set(result.record_id, { result, review })
      const record = records.find((r) => r.record_id === result.record_id)
      const source = record && sourceById.get(record.source_id)
      if (!record || result.status !== 'pass') errors.push(issue('SOURCE_FACTS_REVIEW', `review result ${result.record_id} is unknown or not pass`, file))
      if (record && review.reviewer?.id === source?.created_by?.id) errors.push(issue('REVIEW_INDEPENDENCE', `reviewer ${review.reviewer.id} created source ${source.source_id}`, file))
      if (record && reviewedAt < Date.parse(source?.created_by?.created_at)) errors.push(issue('REVIEW_TIME', `review ${review.review_id} predates source creation`, file))
      if (record && result.fact_payload_hash !== evidenceRecordPayloadHash(record)) errors.push(issue('EVIDENCE_HASH', `review result ${record.record_id} has stale fact_payload_hash`, file))
      if (source && result.source_content_hash !== source.source_content_hash) errors.push(issue('SOURCE_ARTIFACT_HASH', `review result ${result.record_id} has stale source_content_hash`, file))
      const risks = record ? candidateRisksForSource(coveragePlan, record.source_id) : []
      const requiredScopes = requiredReviewScopes(risks, coveragePlan.stage4_requested && record?.stack_relevance?.candidate)
      if (!stringArray(result.scope) || requiredScopes.some((scope) => !result.scope.includes(scope))) errors.push(issue('RISK_REVIEW', `review result ${result.record_id} lacks required scopes`, file))
      if (!stringArray(result.risk_class) || duplicateValues(result.risk_class).length || !sameSet(new Set(result.risk_class ?? []), new Set(risks))) errors.push(issue('RISK_REVIEW', `review result ${result.record_id} risk_class does not match coverage`, file))
      if (risks.some((risk) => risk !== 'standard') && result.mode !== 'full') errors.push(issue('RISK_REVIEW', `elevated-risk record ${result.record_id} requires full review`, file))
    }
  }
  if (!sameSet(new Set(resultsByRecord.keys()), new Set(recordIds))) errors.push(issue('SOURCE_FACTS_REVIEW', 'review shards must cover every record exactly once', file))

  const gate = factsCompletenessGate
  if (!isObject(gate) || gate.schema !== 'facts_completeness_gate.v1' || gate.status !== 'pass') errors.push(issue('FACTS_GATE_ARTIFACT', 'a passing facts_completeness_gate.v1 artifact is required', file))
  else {
    if (gate.coverage_plan_id !== coveragePlan.coverage_plan_id || gate.coverage_plan_hash !== coveragePlan.content_hash || gate.evidence_bundle_id !== evidenceBundle.bundle_id || gate.evidence_bundle_content_hash !== evidenceBundle.content_hash) errors.push(issue('FACTS_GATE_ARTIFACT', 'facts gate has stale plan or bundle binding', file))
    for (const ids of [gate.required_record_ids, gate.validated_record_ids]) if (!stringArray(ids) || duplicateValues(ids).length || !sameSet(new Set(ids ?? []), new Set(recordIds))) errors.push(issue('FACTS_GATE_RECORDS', 'gate record sets must exactly match bundle records', file))
    if (!stringArray(gate.source_facts_review_ids) || duplicateValues(gate.source_facts_review_ids ?? []).length || !sameSet(new Set(gate.source_facts_review_ids ?? []), new Set(reviewIds))) errors.push(issue('FACTS_GATE_ARTIFACT', 'gate review IDs must exactly and uniquely match supplied review shards', file))
    const sampling = gate.sampling
    const standardIds = records.filter((r) => candidateRisksForSource(coveragePlan, r.source_id).every((risk) => risk === 'standard')).map((r) => r.record_id).sort()
    if (!isObject(sampling) || sampling.algorithm !== 'sha256_rank_v1' || !isNonEmptyString(sampling.seed) || !stringArray(sampling.eligible_standard_record_ids) || !stringArray(sampling.selected_record_ids) || typeof sampling.expanded_to_full_batch !== 'boolean') errors.push(issue('SAMPLING', 'gate needs a complete deterministic sampling object', file))
    else {
      const selected = deterministicStandardSample(standardIds, sampling.seed, sampling.expanded_to_full_batch)
      if (duplicateValues(sampling.eligible_standard_record_ids).length || duplicateValues(sampling.selected_record_ids).length || !sameSet(new Set(sampling.eligible_standard_record_ids), new Set(standardIds)) || JSON.stringify(sampling.selected_record_ids) !== JSON.stringify(selected)) errors.push(issue('SAMPLING', 'eligible or selected sampling IDs are not deterministic and unique', file))
      for (const id of standardIds) {
        const mode = resultsByRecord.get(id)?.result?.mode
        if (selected.includes(id) ? !['full', 'batch_sample'].includes(mode) : mode !== 'batch_inherited') errors.push(issue('SAMPLING', `record ${id} review mode does not match deterministic selection`, file))
      }
    }
    const requiredChecks = ['exact_record_set', 'schema', 'crossrefs', 'hashes', 'professional_approvals', 'required_clusters']
    if (!isObject(gate.checks) || requiredChecks.some((key) => gate.checks[key] !== 'pass') || Object.values(gate.checks ?? {}).some((value) => value !== 'pass') || !Array.isArray(gate.open_gaps) || gate.open_gaps.length) errors.push(issue('FACTS_GATE_ARTIFACT', 'all required gate checks must pass and open_gaps must be empty', file))
    if (gate.validated_by?.role !== 'evidence-bundle-gate-validator' || !isNonEmptyString(gate.validated_by?.id)) errors.push(issue('FACTS_GATE_ARTIFACT', 'gate validator identity is invalid', file))
    const gateTime = Date.parse(gate.validated_at)
    if (!Number.isFinite(gateTime) || reviews.some((review) => gateTime < Date.parse(review.reviewed_at))) errors.push(issue('REVIEW_TIME', 'facts gate must be created after every review shard', file))
  }
  const planGate = coveragePlan.facts_gate
  if (planGate?.status === 'pass' && (planGate.evidence_bundle_id !== evidenceBundle.bundle_id || planGate.evidence_bundle_content_hash !== evidenceBundle.content_hash || !sameSet(new Set(planGate.source_facts_review_ids ?? []), new Set(reviewIds)) || planGate.gate_artifact_id !== gate?.gate_id)) errors.push(issue('FACTS_GATE_BUNDLE', 'coverage facts_gate pointers do not match supplied artifacts', file))
  return errors
}

export function validateEvidenceBundle(args) {
  return validateEvidencePipeline(args)
}

export function loadSourceArtifactsFromBundle(bundle, options) {
  const legacyBaseDir = typeof options === 'string' ? resolve(options) : options?.bundleDir ? resolve(options.bundleDir) : null
  const repoRoot = resolve(typeof options === 'object' && options?.repoRoot ? options.repoRoot : REPO_ROOT)
  const resolution = bundle?.source_artifact_resolution
  const sourceIds = new Set((bundle?.sources ?? []).map((source) => source.source_id))
  if (resolution) {
    if (resolution.schema !== 'source_artifact_resolution.v1' || !['repo_root', 'absolute'].includes(resolution.base) || !resolution.paths || typeof resolution.paths !== 'object' || Array.isArray(resolution.paths)) throw new Error('invalid source_artifact_resolution metadata')
    const pathIds = Object.keys(resolution.paths)
    if (pathIds.length !== sourceIds.size || pathIds.some((id) => !sourceIds.has(id))) throw new Error('source_artifact_resolution must map exactly the bundle source IDs')
  }
  const artifacts = {}
  for (const source of bundle?.sources ?? []) {
    let path
    if (resolution) {
      const declared = resolution.paths[source.source_id]
      if (!isNonEmptyString(declared)) throw new Error(`source_artifact_resolution path missing for ${source.source_id}`)
      if (resolution.base === 'absolute') {
        if (!isAbsolute(declared)) throw new Error(`absolute source artifact path required for ${source.source_id}`)
        path = resolve(declared)
      } else {
        if (isAbsolute(declared)) throw new Error(`repo-relative source artifact path required for ${source.source_id}`)
        path = resolve(repoRoot, declared)
        const rel = relative(repoRoot, path)
        if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`source artifact path escapes repository for ${source.source_id}`)
      }
    } else if (isNonEmptyString(source.source_artifact_path)) {
      if (isAbsolute(source.source_artifact_path)) path = resolve(source.source_artifact_path)
      else if (legacyBaseDir) path = resolve(legacyBaseDir, source.source_artifact_path)
      else throw new Error(`relative source_artifact_path for ${source.source_id} requires an explicit bundleDir`)
    } else continue
    artifacts[source.source_id] = readFileSync(path)
  }
  return artifacts
}

export function validateJsonArtifact(value, kind, file) {
  const errors = []
  if (kind === 'evidence' && Array.isArray(value)) {
    if (!value.length) return [issue('BUNDLE_SCHEMA', 'evidence record array must not be empty', file)]
    return value.flatMap((record) => validateEvidenceRecord(record, file))
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [issue('JSON_SCHEMA', `${kind} JSON must be an object`, file)]
  if (kind === 'evidence') {
    if (value.schema === 'source_evidence_bundle.v1') {
      if (!Array.isArray(value.records)) errors.push(issue('BUNDLE_SCHEMA', 'source_evidence_bundle.v1 records must be an array', file))
      else for (const record of value.records) errors.push(...validateEvidenceRecord(record, file))
    } else errors.push(...validateEvidenceRecord(value, file))
  } else if (kind === 'coverage') {
    errors.push(...validateCoveragePlan(value, file))
  } else if (kind === 'source-review') {
    if (value.schema !== 'source_facts_review.v1') errors.push(issue('JSON_SCHEMA', 'source review schema must equal source_facts_review.v1', file))
  } else if (kind === 'facts-gate') {
    if (value.schema !== 'facts_completeness_gate.v1') errors.push(issue('JSON_SCHEMA', 'facts gate schema must equal facts_completeness_gate.v1', file))
  } else if (kind === 'extract') {
    if (typeof value.schema !== 'string' || !value.schema.trim()) errors.push(issue('JSON_SCHEMA', 'legacy extract JSON needs a schema string', file))
  } else if (kind === 'relations') {
    const identifiers = collectStringValues(value, new Set(['source_slugs', 'source_slug', 'source_ids', 'source_id', 'article_slugs', 'article_slug', 'slugs', 'slug']))
    if (!identifiers.size) errors.push(issue('JSON_SCHEMA', 'relations JSON needs at least one source/article identifier', file))
  }
  return errors
}

export function parseJsonStrict(path, kind) {
  const decoded = readUtf8Strict(path)
  const issues = decoded.errors.map((message) => issue('UTF8', message, path))
  if (issues.length) return { value: null, issues }
  try {
    const value = JSON.parse(decoded.text)
    return { value, issues: validateJsonArtifact(value, kind, path) }
  } catch (error) {
    return { value: null, issues: [issue('JSON_PARSE', `${kind} JSON cannot be parsed: ${error.message}`, path)] }
  }
}

export function lintArticle({ file, type = 'auto', repoRoot = REPO_ROOT, evidence, coverage, sourceFactsReviews = [], factsCompletenessGate, extract, relations, sourceSlugs = [] }) {
  const absoluteFile = resolve(file)
  const decoded = readUtf8Strict(absoluteFile)
  const issues = decoded.errors.map((message) => issue('UTF8', message, absoluteFile))
  const warnings = []
  if (issues.length) return { file: absoluteFile, type, issues, warnings }
  const body = decoded.text
  const visible = visibleMarkdown(body)

  for (const pattern of MOJIBAKE_PATTERNS) {
    const match = pattern.exec(body)
    if (match) issues.push(issue('MOJIBAKE', `Likely mojibake or replacement character: ${JSON.stringify(match[0])}`, absoluteFile, lineNumber(body, match.index)))
  }
  issues.push(...validateDisclosureStructure(visible, absoluteFile))
  for (const pattern of WORKFLOW_TERMS) {
    const match = pattern.exec(visible)
    if (match) issues.push(issue('WORKFLOW_TERM', `Visible workflow term: ${match[0]}`, absoluteFile, lineNumber(body, match.index)))
  }
  for (const pattern of GRAPHIC_PLACEHOLDERS) {
    const match = pattern.exec(visible)
    if (match) issues.push(issue('GRAPHIC_PLACEHOLDER', `Visible graphic placeholder/briefing: ${match[0]}`, absoluteFile, lineNumber(body, match.index)))
  }
  issues.push(...validateEmptyH2(body, absoluteFile), ...validateLinks(body, absoluteFile), ...validateImageAltText(body, absoluteFile))
  for (const image of localImagePaths(body)) {
    const candidates = resolveLocalAssets(absoluteFile, image.target, repoRoot)
    if (!candidates.some(existsSync)) issues.push(issue('MISSING_IMAGE', `Local image does not exist: ${image.target}`, absoluteFile, lineNumber(body, image.index)))
  }

  const quantityMatches = [...visible.matchAll(QUANTITY_HINTS)]
  const claimMatches = [...visible.matchAll(CLAIM_HINTS)]
  if (quantityMatches.length) warnings.push(warning('RISK_QUANTITY', `${quantityMatches.length} quantity/unit token(s) require source-aware review`, absoluteFile))
  if (claimMatches.length) warnings.push(warning('RISK_CLAIM', `${claimMatches.length} claim-like verb(s) require source-aware review`, absoluteFile))

  const jsonInputs = { coverage, factsCompletenessGate, extract, relations }
  const parsed = {}
  for (const [kind, input] of Object.entries(jsonInputs)) {
    if (!input) continue
    const path = isAbsolute(input) ? input : resolve(dirname(absoluteFile), input)
    if (!existsSync(path)) {
      issues.push(issue('JSON_MISSING', `${kind} JSON does not exist: ${input}`, absoluteFile))
      continue
    }
    const result = parseJsonStrict(path, kind === 'factsCompletenessGate' ? 'facts-gate' : kind)
    issues.push(...result.issues)
    parsed[kind] = result.value
  }

  const evidenceInputs = Array.isArray(evidence) ? evidence : evidence ? [evidence] : []
  const evidenceValues = []
  for (const input of evidenceInputs) {
    const path = isAbsolute(input) ? input : resolve(dirname(absoluteFile), input)
    if (!existsSync(path)) {
      issues.push(issue('JSON_MISSING', `evidence JSON does not exist: ${input}`, absoluteFile))
      continue
    }
    const result = parseJsonStrict(path, 'evidence')
    issues.push(...result.issues)
    if (result.value) evidenceValues.push(result.value)
  }
  const evidenceBundles = evidenceValues.filter((value) => value?.schema === 'source_evidence_bundle.v1')
  if (evidenceBundles.length > 1) issues.push(issue('BUNDLE_SCHEMA', 'only one source_evidence_bundle.v1 may be supplied per artifact', absoluteFile))
  const evidenceRecords = evidenceValues.flatMap(normalizeEvidenceRecords)
  parsed.evidence = evidenceBundles[0] ?? (evidenceRecords.length === 1 ? evidenceRecords[0] : evidenceRecords.length ? evidenceRecords : null)

  const reviewInputs = Array.isArray(sourceFactsReviews) ? sourceFactsReviews : sourceFactsReviews ? [sourceFactsReviews] : []
  parsed.sourceFactsReviews = []
  for (const input of reviewInputs) {
    const path = isAbsolute(input) ? input : resolve(dirname(absoluteFile), input)
    if (!existsSync(path)) { issues.push(issue('JSON_MISSING', `source review JSON does not exist: ${input}`, absoluteFile)); continue }
    const result = parseJsonStrict(path, 'source-review')
    issues.push(...result.issues)
    if (result.value) parsed.sourceFactsReviews.push(result.value)
  }

  if (parsed.coverage && evidenceRecords.length) {
    let sourceArtifacts = {}
    try { sourceArtifacts = loadSourceArtifactsFromBundle(evidenceBundles[0], { bundleDir: evidenceInputs.length ? dirname(isAbsolute(evidenceInputs[0]) ? evidenceInputs[0] : resolve(dirname(absoluteFile), evidenceInputs[0])) : dirname(absoluteFile), repoRoot }) }
    catch (error) { issues.push(issue('SOURCE_ARTIFACT', error.message, absoluteFile)) }
    issues.push(...validateEvidenceBundle({ coveragePlan: parsed.coverage, evidenceBundle: evidenceBundles[0], sourceFactsReviews: parsed.sourceFactsReviews, factsCompletenessGate: parsed.factsCompletenessGate, sourceArtifacts, file: absoluteFile }))
  } else if (evidenceBundles[0]) {
    issues.push(issue('FACTS_GATE_ARTIFACT', 'coverage, review shards and facts gate are required with a canonical bundle', absoluteFile))
  }

  if (parsed.relations && (parsed.evidence || parsed.coverage || parsed.extract || sourceSlugs.length)) {
    const keys = new Set(['source_slugs', 'source_slug', 'source_ids', 'source_id', 'article_slugs', 'article_slug', 'slugs', 'slug'])
    const expected = new Set(sourceSlugs.map(String))
    for (const kind of ['evidence', 'coverage', 'extract']) if (parsed[kind]) collectStringValues(parsed[kind], keys, expected)
    const actual = collectStringValues(parsed.relations, keys)
    const missing = [...expected].filter((slug) => !actual.has(slug))
    const extra = [...actual].filter((slug) => !expected.has(slug))
    if (missing.length || extra.length) issues.push(issue('SOURCE_RELATION_MISMATCH', `Source/relation slug sets differ; missing=[${missing.join(', ')}], extra=[${extra.join(', ')}]`, absoluteFile))
  }

  if (!['auto', 'stage2', 'stage3'].includes(type)) issues.push(issue('TYPE', `Unknown article type: ${type}`, absoluteFile))
  if (!['.md', '.markdown', '.html', '.htm'].includes(extname(absoluteFile).toLowerCase())) warnings.push(warning('FILE_TYPE', 'Article file does not use a recognized Markdown/HTML extension', absoluteFile))
  return { file: absoluteFile, type, issues, warnings }
}

export function summarize(results) {
  return {
    ok: results.every((result) => result.issues.length === 0),
    files: results.length,
    errors: results.reduce((sum, result) => sum + result.issues.length, 0),
    warnings: results.reduce((sum, result) => sum + result.warnings.length, 0),
    results,
  }
}
