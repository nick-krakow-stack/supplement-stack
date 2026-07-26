#!/usr/bin/env node
import { resolve } from 'node:path'
import { dispatchNutrientContentMachinesV2 } from './lib/nutrient-content-machine-dispatcher.mjs'
import { buildMachineAdapter, cliFailure, parseMachineCliArgs } from './lib/nutrient-content-machine-cli.mjs'
import { loadNutrientContentRunManifest } from './lib/nutrient-content-runner.mjs'

try {
  const options = parseMachineCliArgs(process.argv.slice(2))
  if (!options.manifest) throw new Error('Usage: node scripts/dispatch-nutrient-content-machines.mjs --manifest <run.json> [--publish] [--activate-framework] [--adapter sqlite --database <db>|--adapter cloudflare-d1]')
  const manifestPath = resolve(options.manifest)
  const context = loadNutrientContentRunManifest(manifestPath)
  const adapter = buildMachineAdapter(options, { publicBaseUrl: context.publish.publicBaseUrl })
  const result = await dispatchNutrientContentMachinesV2({ manifestPath, adapter, publishEnabled: options.publish === true, frameworkActivationEnabled: options.activate_framework === true })
  process.stdout.write(`${JSON.stringify({ state: result.status.state, aggregate_status: result.status.aggregate_status, transitions: result.transitions })}\n`)
  adapter.close?.()
} catch (error) { cliFailure(error) }
