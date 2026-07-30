#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintArticle, parseJsonStrict, summarize } from './lib/content-validation.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function usage(message) {
  if (message) console.error(message)
  console.error('Usage: node scripts/content-lint.mjs (--file <article.md> [--evidence <bundle.json> --coverage <plan.json> --source-review <review.json>... --facts-gate <gate.json>] | --manifest <manifest.json>) [--json]')
  process.exitCode = 2
}

function parseArgs(argv) {
  const args = { file: '', manifest: '', type: 'auto', evidence: [], coverage: '', sourceFactsReviews: [], factsCompletenessGate: '', extract: '', relations: '', sourceSlugs: [], json: false }
  const valueOptions = new Set(['--file', '--manifest', '--type', '--evidence', '--coverage', '--source-review', '--facts-gate', '--extract', '--relations', '--source-slug'])
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--json') { args.json = true; continue }
    if (!valueOptions.has(token)) throw new Error(`Unknown option: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${token} requires a value`)
    index += 1
    if (token === '--source-slug') args.sourceSlugs.push(value)
    else if (token === '--evidence') args.evidence.push(value)
    else if (token === '--source-review') args.sourceFactsReviews.push(value)
    else if (token === '--facts-gate') args.factsCompletenessGate = value
    else args[token.slice(2).replace('source-slug', 'sourceSlugs')] = value
  }
  return args
}

function manifestEntries(path) {
  const parsed = parseJsonStrict(path, 'manifest')
  if (parsed.issues.length) throw new Error(parsed.issues.map((entry) => entry.message).join('; '))
  const entries = parsed.value?.artifacts
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('manifest needs a non-empty artifacts array')
  const base = dirname(path)
  return entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.file !== 'string') throw new Error(`manifest artifact ${index} needs a file string`)
    const resolveEntry = (value) => value ? (isAbsolute(value) ? value : resolve(base, value)) : ''
    const resolveMany = (value) => (Array.isArray(value) ? value : value ? [value] : []).map(resolveEntry)
    return {
      ...entry,
      file: resolveEntry(entry.file),
      evidence: resolveMany(entry.evidence ?? entry.evidence_paths),
      coverage: resolveEntry(entry.coverage),
      sourceFactsReviews: resolveMany(entry.sourceFactsReviews ?? entry.source_facts_reviews),
      factsCompletenessGate: resolveEntry(entry.factsCompletenessGate ?? entry.facts_gate),
      extract: resolveEntry(entry.extract),
      relations: resolveEntry(entry.relations),
    }
  })
}

function printHuman(report) {
  for (const result of report.results) {
    for (const entry of [...result.issues, ...result.warnings]) {
      const location = entry.line ? `${entry.file}:${entry.line}` : entry.file
      console[entry.severity === 'error' ? 'error' : 'warn'](`${entry.severity.toUpperCase()} ${entry.code} ${location} — ${entry.message}`)
    }
  }
  console.log(`content-lint: ${report.ok ? 'PASS' : 'FAIL'} (${report.files} file(s), ${report.errors} error(s), ${report.warnings} warning(s))`)
}

let args
try {
  args = parseArgs(process.argv.slice(2))
  if (Boolean(args.file) === Boolean(args.manifest)) throw new Error('Choose exactly one of --file or --manifest')
  const entries = args.file ? [args] : manifestEntries(resolve(args.manifest))
  for (const entry of entries) if (!existsSync(resolve(entry.file))) throw new Error(`Article file does not exist: ${entry.file}`)
  const report = summarize(entries.map((entry) => lintArticle({ ...entry, repoRoot })))
  if (args.json) console.log(JSON.stringify(report, null, 2))
  else printHuman(report)
  process.exitCode = report.ok ? 0 : 1
} catch (error) {
  usage(error.message)
}
