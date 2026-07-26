import { resolve } from 'node:path'
import { CloudflareD1ContentPublicationAdapter, SqliteContentPublicationAdapter } from './nutrient-content-machine-dispatcher.mjs'

function fail(message) { throw new Error(message) }

export function parseMachineCliArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--publish') { options.publish = true; continue }
    if (token === '--activate-framework') { options.activate_framework = true; continue }
    if (!token.startsWith('--')) fail(`unexpected positional argument ${token}`)
    const key = token.slice(2).replaceAll('-', '_')
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`${token} requires a value`)
    options[key] = value; index += 1
  }
  return options
}

export function buildMachineAdapter(options, { publicBaseUrl = null } = {}) {
  const adapterKind = options.adapter ?? 'sqlite'
  if (adapterKind === 'sqlite') return new SqliteContentPublicationAdapter({ databasePath: options.database ? resolve(options.database) : ':memory:', publicBaseUrl })
  if (adapterKind !== 'cloudflare-d1') fail('--adapter must be sqlite or cloudflare-d1')
  return new CloudflareD1ContentPublicationAdapter({
    accountId: options.account_id ?? process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: options.database_id ?? process.env.CLOUDFLARE_D1_DATABASE_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    publicBaseUrl: options.public_base_url ?? publicBaseUrl,
  })
}

export function cliFailure(error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
