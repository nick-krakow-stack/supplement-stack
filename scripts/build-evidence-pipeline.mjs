#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildFactsGate,
  buildFactsPackages,
  buildEvidencePipelineLock,
  loadPipelineManifest,
  mergeSourceEvidenceShards,
  resolveFrameworkCatalog,
  resolveCanonicalStyleReferences,
  validatePopulationResolver,
} from './lib/evidence-pipeline-builder.mjs'
import { buildEvidencePipelineV2, loadEvidenceManifestV2 } from './lib/evidence-pipeline-v2.mjs'
import { assertContained } from './lib/safe-paths.mjs'

function manifestSchema(manifestPath) {
  try { return JSON.parse(readFileSync(resolve(manifestPath), 'utf8')).schema }
  catch (error) { throw new Error(`evidence manifest cannot be read: ${error.message}`) }
}

export function buildEvidencePipeline({ manifestPath }) {
  if (manifestSchema(manifestPath) === 'evidence_pipeline_build.v2') {
    throw new Error('evidence_pipeline_build.v2 requires writeEvidencePipeline with an output directory so its review sample can be frozen')
  }
  const input = loadPipelineManifest(manifestPath)
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const frameworkBindings = resolveFrameworkCatalog({ catalog: input.catalog, repoRoot, coveragePlan: input.coveragePlan, catalogPath: input.catalogPath, mode: input.mode })
  const styleResolution = resolveCanonicalStyleReferences({ repoRoot, mode: input.mode })
  const { bundle, extractorIds } = mergeSourceEvidenceShards({
    coveragePlan: input.coveragePlan, shards: input.shards, sourceArtifacts: input.sourceArtifacts, sourceArtifactPaths: input.sourceArtifactPaths,
    merger: input.manifest.merger, bundleId: input.manifest.bundle_id, repoRoot, mode: input.mode,
  })
  validatePopulationResolver({ coveragePlan: input.coveragePlan, evidenceBundle: bundle, resolver: input.populationResolver, mode: input.mode })
  const built = buildFactsGate({
    coveragePlan: input.coveragePlan, evidenceBundle: bundle, sourceFactsReviews: input.sourceFactsReviews,
    sourceArtifacts: input.sourceArtifacts, validator: input.manifest.validator,
    samplingSeed: input.manifest.sampling_seed, extractorIds,
  })
  const packages = buildFactsPackages({
    coveragePlan: built.coveragePlan, evidenceBundle: bundle, gate: built.gate, frameworkBindings,
    styleReferences: styleResolution.references,
  })
  return { coveragePlan: built.coveragePlan, bundle, gate: built.gate, packages, frameworkBindings, styleResolution, expected: built.expected, input }
}

export function writeEvidencePipeline({ manifestPath, outputDir }) {
  if (manifestSchema(manifestPath) === 'evidence_pipeline_build.v2') {
    const input = loadEvidenceManifestV2(manifestPath)
    const dir = assertContained(input.root, isAbsolute(outputDir) ? outputDir : resolve(input.root, outputDir), 'v2 evidence output directory')
    if (dir === resolve(input.root)) throw new Error('v2 evidence output directory must be below the run root')
    mkdirSync(dir, { recursive: true })
    const result = buildEvidencePipelineV2({ input, outputDir: dir })
    const report = {
      schema: 'evidence_pipeline_build_report.v2', status: result.status,
      run_id: input.coveragePlan?.run_id ?? null,
      coverage_plan_id: input.coveragePlan?.coverage_plan_id ?? null,
      bundle_id: result.bundle?.bundle_id ?? null,
      sample_manifest_hash: result.sample?.content_hash ?? null,
      facts_gate_id: result.gate?.gate_id ?? null,
      writers_ready: result.gate?.writers_ready === true,
      lock_hash: result.lock?.lock_hash ?? null,
    }
    writeFileSync(resolve(dir, 'build-report.v2.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    return { result, report, outputDir: dir }
  }
  const result = buildEvidencePipeline({ manifestPath })
  const dir = resolve(outputDir)
  mkdirSync(resolve(dir, 'stage2-packages'), { recursive: true })
  const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  write(resolve(dir, 'coverage-plan.gated.json'), result.coveragePlan)
  write(resolve(dir, 'source-evidence-bundle.json'), result.bundle)
  write(resolve(dir, 'facts-completeness-gate.json'), result.gate)
  write(resolve(dir, 'facts-package-stage3.json'), result.packages.stage3)
  for (const [articleId, value] of Object.entries(result.packages.stage2)) write(resolve(dir, 'stage2-packages', `${articleId}.json`), value)
  const lock = buildEvidencePipelineLock({ input: result.input, outputDir: dir, result, styleResolution: result.styleResolution, createdAt: result.input.manifest.lock_created_at })
  write(resolve(dir, 'evidence-pipeline-lock.json'), lock)
  const report = {
    schema: 'evidence_pipeline_build_report.v1', status: 'PASS',
    coverage_plan_id: result.coveragePlan.coverage_plan_id, bundle_id: result.bundle.bundle_id,
    gate_id: result.gate.gate_id, required_record_count: result.gate.required_record_ids.length,
    stage2_package_count: Object.keys(result.packages.stage2).length,
    pipeline_lock_id: lock.lock_id, pipeline_lock_hash: lock.lock_hash,
    outputs: ['evidence-pipeline-lock.json', 'coverage-plan.gated.json', 'source-evidence-bundle.json', 'facts-completeness-gate.json', 'facts-package-stage3.json', 'stage2-packages/'],
  }
  write(resolve(dir, 'build-report.json'), report)
  return { result, report, outputDir: dir }
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--manifest') args.manifestPath = argv[++index]
    else if (value === '--out') args.outputDir = argv[++index]
    else if (value === '--help' || value === '-h') args.help = true
    else throw new Error(`unknown argument: ${value}`)
  }
  return args
}

function usage() { return 'Usage: node scripts/build-evidence-pipeline.mjs --manifest <evidence-pipeline-build.json> --out <directory>' }

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.help) { console.log(usage()); process.exit(0) }
    if (!args.manifestPath || !args.outputDir) throw new Error(usage())
    const output = writeEvidencePipeline(args)
    console.log(JSON.stringify({ ...output.report, output_dir: relative(process.cwd(), output.outputDir) || basename(output.outputDir) }, null, 2))
  } catch (error) {
    console.error(`Evidence pipeline build failed: ${error.message}`)
    process.exit(1)
  }
}
