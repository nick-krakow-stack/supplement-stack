#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decodeUtf8Strict } from './lib/content-validation.mjs'
import { dispatchDeterministicWorkOrderV2 } from './lib/nutrient-content-machine-dispatcher.mjs'
import { buildMachineAdapter, cliFailure, parseMachineCliArgs } from './lib/nutrient-content-machine-cli.mjs'
import { loadNutrientContentRunManifest } from './lib/nutrient-content-runner.mjs'

function readJson(path) {
  const decoded = decodeUtf8Strict(readFileSync(path), path)
  if (decoded.errors.length) throw new Error(decoded.errors.join('; '))
  return JSON.parse(decoded.text)
}

try {
  const options = parseMachineCliArgs(process.argv.slice(2))
  if (!options.manifest || !options.work_order) throw new Error('Usage: node scripts/apply-content-release.mjs --manifest <run.json> --work-order <work-order.json> --publish [--adapter sqlite --database <db>|--adapter cloudflare-d1]')
  const context = loadNutrientContentRunManifest(resolve(options.manifest))
  const adapter = buildMachineAdapter(options, { publicBaseUrl: context.publish.publicBaseUrl })
  const receipt = await dispatchDeterministicWorkOrderV2({ context, workOrder: readJson(resolve(options.work_order)), adapter, publishEnabled: options.publish === true })
  process.stdout.write(`${JSON.stringify({ schema: receipt.schema, content_hash: receipt.content_hash, release_hash: receipt.release_hash, article_count: receipt.article_results.length, retired_article_count: receipt.retirement_results?.length ?? 0 })}\n`)
  adapter.close?.()
} catch (error) { cliFailure(error) }
