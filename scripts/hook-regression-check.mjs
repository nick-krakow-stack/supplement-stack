import { existsSync, readdirSync, readFileSync } from 'node:fs'

function readJson(relativePath) {
  const absolutePath = new URL(`../${relativePath}`, import.meta.url)
  const content = readFileSync(absolutePath, 'utf8')
  return JSON.parse(content)
}

function readText(relativePath) {
  const absolutePath = new URL(`../${relativePath}`, import.meta.url)
  return readFileSync(absolutePath, 'utf8')
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
  const activeEvents = Object.entries(claudeSettings?.hooks || {})
  check(activeEvents.length === 0, '.claude/settings.json must not define active hooks')
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

// 4) AGENTS protocol must encode Orchestrator-only and checklist/feedback rules.
const agentsDoc = readText('AGENTS.md')
check(
  agentsDoc.match(/Orchestrator-only|Codex .*Orchestrator|Codex .*operates as Orchestrator/i),
  'AGENTS.md must state Orchestrator-only operation with Codex as coordinator.',
)
check(
  agentsDoc.match(/Sub-Agent/i),
  'AGENTS.md must mention Sub-Agent delegation.',
)
check(
  agentsDoc.match(/current-task\.md|checklist/i),
  'AGENTS.md must define a checklist rule for current tasks.',
)
check(
  agentsDoc.match(/Sub-Agent.*(Final|final|Ergebnis|ergebnis).*current-task\.md|current-task\.md.*Sub-Agent.*(Final|final|Ergebnis|ergebnis)/i),
  'AGENTS.md must require updating current-task.md after each Sub-Agent final response.',
)
check(
  agentsDoc.match(/Browser-Feedback|Browser feedback/i),
  'AGENTS.md must define Browser-Feedback capture policy.',
)
check(
  agentsDoc.match(/Stop|handoff|status update/i),
  'AGENTS.md must require Stop/handoff status updates.',
)

// 5) agent protocol script and protocol docs must exist.
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
  agentProtocol.includes('feedback.md') && !agentProtocol.includes('feedback.txt'),
  'agent-protocol.ps1 must write owner feedback to .agent-memory/feedback.md, not feedback.txt',
)
check(
  agentProtocol.includes('current-task.md'),
  'agent-protocol.ps1 must include current-task.md for checklist persistence.',
)
check(
  agentProtocol.includes('Browser-Feedback') && agentProtocol.includes('Diff-Kommentar'),
  'agent-protocol.ps1 must support Browser-Feedback and Diff-Kommentar capture.',
)
check(
  agentProtocol.includes('current-task.md') && agentProtocol.includes('feedback.md'),
  'agent-protocol.ps1 must keep handoff tied to task checklist and feedback memory.',
)
check(
  agentProtocol.includes('Test-IsInternalSignal') && agentProtocol.includes('Du bist nicht allein im Codebase'),
  'agent-protocol.ps1 must filter internal sub-agent prompts from feedback capture.',
)
check(
  existsSync(new URL('../.codex/hooks/README.md', import.meta.url)),
  '.codex/hooks/README.md must exist',
)

// 6) current task checklist must exist.
check(
  existsSync(new URL('../.agent-memory/current-task.md', import.meta.url)),
  '.agent-memory/current-task.md must exist.',
)

// 7) old hook scripts should not exist.
const oldHookNames = [
  '.claude/hooks/error-capture.sh',
  '.claude/hooks/pre-deploy-check.sh',
  'scripts/orchestrator-guard.ps1',
  'scripts/update-agent-handoff.ps1',
  '.agent-memory/feedback.txt',
]
for (const hookFile of oldHookNames) {
  check(
    !existsSync(new URL(`../${hookFile}`, import.meta.url)),
    `Legacy hook file ${hookFile} must be removed`,
  )
}

// 8) AGENTS protocol is canonical; CLAUDE.md must not be listed in startup instructions.
check(
  !agentsDoc.match(/Read\\s+`?CLAUDE\\.md`?/i),
  'AGENTS.md startup list must not require CLAUDE.md',
)
const handoffDoc = readText('.agent-memory/handoff.md')
check(
  !handoffDoc.match(/Read\\s+CLAUDE\\.md/i),
  'handoff required startup list must not require CLAUDE.md',
)

if (failures.length > 0) {
  for (const issue of failures) {
    console.error(`[hook-regression-check] ${issue}`)
  }
  process.exit(1)
}

console.log('hook-regression-check passed')
