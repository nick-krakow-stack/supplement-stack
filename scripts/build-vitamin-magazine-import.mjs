import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const args = process.argv.slice(2)

if (!args.length) {
  console.error('DEPRECATED: use scripts/build-knowledge-magazine-import.mjs with --markdown, --meta and the canonical Stage-3 artifacts. This wrapper is dry-run only.')
  process.exitCode = 1
} else if (args.includes('--out')) {
  console.error('The legacy vitamin wrapper never writes SQL. Run the canonical importer directly after all gates pass.')
  process.exitCode = 1
} else {
  const hasSafeMode = args.includes('--dry-run') || args.includes('--legacy-dry-run')
  const forwarded = hasSafeMode ? args : [...args, '--legacy-dry-run']
  const importer = resolve('scripts/build-knowledge-magazine-import.mjs')
  const result = spawnSync(process.execPath, [importer, ...forwarded], { stdio: 'inherit' })
  if (result.error) {
    console.error(result.error.message)
    process.exitCode = 1
  } else {
    process.exitCode = result.status ?? 1
  }
}
