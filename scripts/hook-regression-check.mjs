import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function readJson(path) {
  return JSON.parse(read(path))
}

function hookCommands(settings) {
  const commands = []
  for (const entries of Object.values(settings.hooks ?? {})) {
    for (const entry of entries) {
      for (const hook of entry.hooks ?? []) {
        if (hook.command) {
          commands.push(hook.command)
        }
      }
    }
  }
  return commands
}

function hookFiles(settings) {
  return hookCommands(settings)
    .map((command) => command.match(/-File\s+(.+?\.ps1)(?:\s|$)/i)?.[1] ?? '')
    .filter(Boolean)
}

function eventCommands(settings, eventName) {
  return (settings.hooks?.[eventName] ?? [])
    .flatMap((entry) => entry.hooks ?? [])
    .map((hook) => hook.command ?? '')
}

const codexHooks = readJson('.codex/hooks.json')
const claudeHooks = readJson('.claude/settings.json')
const codexCommands = hookCommands(codexHooks)
const claudeCommands = hookCommands(claudeHooks)
const allCommands = [...codexCommands, ...claudeCommands]

for (const command of allCommands) {
  assert.match(command, /^powershell\b/i, `hook command must be PowerShell-compatible: ${command}`)
  assert.match(command, /\.\/\.codex\/hooks\//, `hook command must use centralized .codex/hooks scripts: ${command}`)
  assert.match(command, /agent-protocol\.ps1/, `hook command must use the single dispatcher: ${command}`)
  assert.doesNotMatch(command, /\.\/\.claude\/hooks\//, `hook command must not use .claude/hooks: ${command}`)
  assert.doesNotMatch(command, /\.sh\b/, `hook command must not reintroduce Bash scripts: ${command}`)
}

for (const file of [...hookFiles(codexHooks), ...hookFiles(claudeHooks)]) {
  assert.equal(file, './.codex/hooks/agent-protocol.ps1', `only agent-protocol.ps1 may be wired as a hook file: ${file}`)
}

for (const settings of [codexHooks, claudeHooks]) {
  const feedbackCommands = eventCommands(settings, 'UserPromptSubmit')
  assert.ok(
    feedbackCommands.some((command) => command.includes('./.codex/hooks/agent-protocol.ps1') && command.includes('UserPromptSubmit')),
    'UserPromptSubmit must run centralized agent-protocol.ps1',
  )
}

assert.equal(
  eventCommands(claudeHooks, 'PostToolUse').some((command) => command.includes('update-agent-handoff.ps1')),
  false,
  'PostToolUse must not run update-agent-handoff.ps1 on every shell command',
)

for (const path of [
  '.codex/hooks/agent-protocol.ps1',
  'scripts/append-owner-feedback.ps1',
  '.agent-memory/owner-feedback.md',
]) {
  assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} must exist`)
}

const protocolHook = read('.codex/hooks/agent-protocol.ps1')
assert.match(protocolHook, /owner-feedback\.md/, 'protocol hook must write to owner-feedback.md')
assert.match(protocolHook, /ConvertFrom-Json/, 'protocol hook must parse hook JSON payloads')
assert.match(protocolHook, /prompt/i, 'protocol hook must extract prompt text when available')
assert.match(protocolHook, /browser|diff|website|admin/i, 'protocol hook must identify feedback-style prompts')
assert.match(protocolHook, /agent-protocol\.log/, 'protocol hook must record orchestrator guard reminders')
assert.match(protocolHook, /pre-deploy-check\.log/, 'protocol hook must record pre-deploy checks without stdout')
assert.match(protocolHook, /deploy-errors\.log/, 'protocol hook must record deploy errors')
assert.match(protocolHook, /Update-Handoff/, 'protocol hook must update handoff on PreCompact')

const manualFeedbackScript = read('scripts/append-owner-feedback.ps1')
assert.match(manualFeedbackScript, /owner-feedback\.md/, 'manual feedback script must append to owner-feedback.md')
assert.match(manualFeedbackScript, /param\(/, 'manual feedback script must accept explicit feedback text')

const ownerFeedbackMemory = read('.agent-memory/owner-feedback.md')
assert.match(ownerFeedbackMemory, /Pending Owner Feedback/i, 'owner-feedback.md must be a pending feedback log')
assert.match(ownerFeedbackMemory, /UserPromptSubmit/i, 'owner-feedback.md must document automatic prompt capture')
assert.match(ownerFeedbackMemory, /append-owner-feedback\.ps1/i, 'owner-feedback.md must document manual fallback capture')

for (const phrase of [
  'Orchestrator plans/delegates/reviews',
  'implementation must be delegated',
  'responsible Sub-Agent',
  'Dev-Agent',
]) {
  assert.match(
    protocolHook,
    new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    `protocol hook must remind agents: ${phrase}`,
  )
}

const preToolPayload = JSON.stringify({
  tool_name: 'Bash',
  tool_input: {
    command: 'git status --short',
  },
})

for (const command of eventCommands(codexHooks, 'PreToolUse')) {
  const match = command.match(/-File\s+(.+?\.ps1)(?:\s|$)/i)
  assert.ok(match, `PreToolUse hook command must call a PowerShell file: ${command}`)
  const scriptPath = match[1].replaceAll('/', '\\')
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    {
      cwd: new URL('..', import.meta.url),
      input: preToolPayload,
      encoding: 'utf8',
    },
  )
  assert.equal(result.status, 0, `PreToolUse hook must exit 0 for normal commands: ${scriptPath}\n${result.stderr}`)
  assert.equal(
    result.stdout.trim(),
    '',
    `PreToolUse hook must not write plain text stdout because Codex expects JSON-compatible output: ${scriptPath}`,
  )
  assert.equal(
    result.stderr.trim(),
    '',
    `PreToolUse hook must not write stderr because the Codex App surfaces hook output as failures/noise: ${scriptPath}`,
  )
}

const ownerFeedbackUrl = new URL('../.agent-memory/owner-feedback.md', import.meta.url)
const ownerFeedbackBefore = readFileSync(ownerFeedbackUrl, 'utf8')
try {
  const feedbackPayload = JSON.stringify({
    prompt: 'Browser Feedback:\\n1. Dashboard umbenennen\\n2. Admin Button verschieben',
  })
  const feedbackResult = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '.\\.codex\\hooks\\agent-protocol.ps1', '-Event', 'UserPromptSubmit'],
    {
      cwd: new URL('..', import.meta.url),
      input: feedbackPayload,
      encoding: 'utf8',
    },
  )
  assert.equal(feedbackResult.status, 0, `UserPromptSubmit hook must exit 0\n${feedbackResult.stderr}`)
  assert.equal(feedbackResult.stdout.trim(), '', 'UserPromptSubmit hook must not write plain text stdout')
  assert.equal(feedbackResult.stderr.trim(), '', 'UserPromptSubmit hook must not write stderr')
  const ownerFeedbackAfter = readFileSync(ownerFeedbackUrl, 'utf8')
  assert.match(ownerFeedbackAfter, /Dashboard umbenennen/, 'UserPromptSubmit hook must append feedback when prompt text matches')
} finally {
  writeFileSync(ownerFeedbackUrl, ownerFeedbackBefore)
}

console.log('Hook regression checks passed.')
