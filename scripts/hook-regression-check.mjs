import { existsSync, readdirSync, readFileSync } from 'node:fs'

function readJson(relativePath) {
  const absolutePath = new URL(`../${relativePath}`, import.meta.url)
  const content = readFileSync(absolutePath, 'utf8')
  return JSON.parse(content)
}

function hasHookCommand(config, eventName) {
  if (!config?.hooks?.[eventName]) return false
  return Array.isArray(config.hooks[eventName]) && config.hooks[eventName].length > 0
}

function collectActiveHookFilenames(text) {
  const fileNames = ['error-capture.sh', 'pre-deploy-check.sh']
  return fileNames.filter((name) => text.includes(name))
}

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

// 1) .claude settings must not expose active forbidden events.
const claudeSettingsPath = '.claude/settings.json'
let claudeSettings
try {
  if (existsSync(new URL(`../${claudeSettingsPath}`, import.meta.url))) {
    claudeSettings = readJson(claudeSettingsPath)
  }
} catch (err) {
  failures.push(`Could not read ${claudeSettingsPath}: ${err.message}`)
}

if (claudeSettings) {
  const forbidden = ['PreCompact', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop']
  for (const event of forbidden) {
    const active = hasHookCommand(claudeSettings, event)
    check(!active, `${event} must not be active in .claude/settings.json`)
  }
}

// 2) .claude/hooks must not contain any hook files.
if (existsSync(new URL('../.claude/hooks', import.meta.url))) {
  try {
    const entries = readdirSync(new URL('../.claude/hooks', import.meta.url), {
      withFileTypes: true,
    })
    const hookFiles = entries.filter((entry) => entry.isFile())
    check(
      hookFiles.length === 0,
      `.claude/hooks must not contain hook files (found: ${hookFiles.map((h) => h.name).join(', ') || 'none'})`,
    )
  } catch {
    failures.push('Unable to read .claude/hooks directory.')
  }
} else {
  check(true, '.claude/hooks directory can be absent or empty')
}

// 3) .codex/hooks.json must exist and only wire UserPromptSubmit and Stop.
const codexHooksPath = '.codex/hooks.json'
let codexHooks
try {
  codexHooks = readJson(codexHooksPath)
} catch (err) {
  failures.push(`Could not read ${codexHooksPath}: ${err.message}`)
}

if (codexHooks) {
  const events = codexHooks?.hooks ? Object.keys(codexHooks.hooks) : []
  const allowed = new Set(['UserPromptSubmit', 'Stop'])
  const unexpected = events.filter((event) => !allowed.has(event))
  check(
    unexpected.length === 0,
    `.codex/hooks.json must only contain UserPromptSubmit and Stop (unexpected: ${unexpected.join(', ') || 'none'})`,
  )
  for (const event of allowed) {
    check(
      hasHookCommand(codexHooks, event),
      `${event} must be active in .codex/hooks.json`,
    )
    if (codexHooks?.hooks?.[event]) {
      const entries = codexHooks.hooks[event]
      const serialized = JSON.stringify(entries)
      const referencedFiles = collectActiveHookFilenames(serialized)
      check(
        referencedFiles.length === 0,
        `${event} must not reference removed hook files (${referencedFiles.join(', ')})`,
      )
      const command = entries[0]?.hooks?.[0]?.command || ''
      check(
        command.toLowerCase().includes('./.codex/hooks/agent-protocol.ps1'),
        `${event} must call ./.codex/hooks/agent-protocol.ps1`,
      )
      check(
        command.includes(`-Mode ${event}`),
        `${event} must pass an explicit -Mode ${event}`,
      )
    }
  }

  const allSerialized = JSON.stringify(codexHooks)
  check(
    !collectActiveHookFilenames(allSerialized).length,
    `Legacy hook filenames must not be referenced in .codex/hooks.json`,
  )
  check(
    !allSerialized.includes('PreCompact') && !allSerialized.includes('PreToolUse') && !allSerialized.includes('PostToolUse'),
    'PreCompact/PreToolUse/PostToolUse must not be active in .codex/hooks.json',
  )
}

// 4) agent protocol script and protocol docs must exist.
check(
  existsSync(new URL('../.codex/hooks/agent-protocol.ps1', import.meta.url)),
  '.codex/hooks/agent-protocol.ps1 must exist',
)
const agentProtocol = readFileSync(new URL('../.codex/hooks/agent-protocol.ps1', import.meta.url), 'utf8')
check(
  agentProtocol.includes('Split-Path -Parent (Split-Path -Parent $PSScriptRoot)'),
  'agent-protocol.ps1 must resolve the repository root from .codex/hooks',
)
check(
  existsSync(new URL('../.codex/hooks/README.md', import.meta.url)),
  '.codex/hooks/README.md must exist',
)

// 5) old hook scripts should not exist.
const oldHookNames = [
  '.claude/hooks/error-capture.sh',
  '.claude/hooks/pre-deploy-check.sh',
  'scripts/orchestrator-guard.ps1',
  'scripts/update-agent-handoff.ps1',
]
for (const hookFile of oldHookNames) {
  check(
    !existsSync(new URL(`../${hookFile}`, import.meta.url)),
    `Legacy hook file ${hookFile} must be removed`,
  )
}

if (failures.length > 0) {
  for (const issue of failures) {
    console.error(`[hook-regression-check] ${issue}`)
  }
  process.exit(1)
}

console.log('hook-regression-check passed')
