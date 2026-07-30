#!/usr/bin/env node
import { resolve } from 'node:path'
import { dispatchDeterministicWorkOrderV2 } from './lib/nutrient-content-machine-dispatcher.mjs'
import { buildMachineAdapter, cliFailure, parseMachineCliArgs } from './lib/nutrient-content-machine-cli.mjs'
import { loadNutrientContentRunManifest } from './lib/nutrient-content-runner.mjs'
import { decodeUtf8Strict } from './lib/content-validation.mjs'
import { readFileSync } from 'node:fs'

function readJson(path) {
  const decoded = decodeUtf8Strict(readFileSync(path), path)
  if (decoded.errors.length) throw new Error(decoded.errors.join('; '))
  return JSON.parse(decoded.text)
}

try {
  const options = parseMachineCliArgs(process.argv.slice(2))
  if (!options.manifest || !options.work_order) throw new Error('Usage: node scripts/export-site-link-inventory.mjs --manifest <run.json> --work-order <work-order.json> [--adapter sqlite --database <db>|--adapter cloudflare-d1]')
  const context = loadNutrientContentRunManifest(resolve(options.manifest))
  const adapter = buildMachineAdapter(options, { publicBaseUrl: context.publish.publicBaseUrl })
  const result = await dispatchDeterministicWorkOrderV2({ context, workOrder: readJson(resolve(options.work_order)), adapter, publishEnabled: false })
  process.stdout.write(`${JSON.stringify({ schema: result.schema, content_hash: result.content_hash, route_count: result.routes.length })}\n`)
  adapter.close?.()
} catch (error) { cliFailure(error) }
