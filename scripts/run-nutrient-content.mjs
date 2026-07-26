#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNutrientContent } from './lib/nutrient-content-runner.mjs'

function fail(message) { throw new Error(message) }
function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--manifest') args.manifestPath = argv[++index]
    else if (token === '--help' || token === '-h') args.help = true
    else fail(`unknown argument: ${token}`)
  }
  return args
}
function usage() { return 'Usage: node scripts/run-nutrient-content.mjs --manifest <nutrient-content-run.v2.json>' }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.help) { console.log(usage()); process.exit(0) }
    if (!args.manifestPath) fail(usage())
    console.log(JSON.stringify(runNutrientContent({ manifestPath: args.manifestPath }), null, 2))
  } catch (error) {
    console.error(JSON.stringify({ schema: 'nutrient_content_run_status.v2', state: 'BLOCKED', reason: error.message, success_claimed: false }, null, 2))
    process.exitCode = 1
  }
}
