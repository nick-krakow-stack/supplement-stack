import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'

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

function hookEntries(settings, eventName) {
  return settings.hooks?.[eventName] ?? []
}

function hookFiles(settings) {
  return hookCommands(settings)
    .map((command) => command.match(/-File\s+(.+?\.ps1)(?:\s|$)/i)?.[1] ?? '')
    .filter(Boolean)
}

function eventCommands(settings, eventName) {
  return hookEntries(settings, eventName)
    .flatMap((entry) => entry.hooks ?? [])
    .map((hook) => hook.command ?? '')
}

function eventMatchers(settings, eventName) {
  return hookEntries(settings, eventName).map((entry) => entry.matcher ?? '')
}

function assertCentralEvent(settings, eventName, expectedEventArgs) {
  const commands = eventCommands(settings, eventName)
  assert.ok(commands.length > 0, `${eventName} must be actively wired`)
  for (const expectedEventArg of expectedEventArgs) {
    assert.ok(
      commands.some(
        (command) =>
          command.includes('./.codex/hooks/agent-protocol.ps1') &&
          command.includes(`-Event ${expectedEventArg}`),
      ),
      `${eventName} must run centralized agent-protocol.ps1 with -Event ${expectedEventArg}`,
    )
  }
}

const codexHooks = readJson('.codex/hooks.json')
const claudeHooks = readJson('.claude/settings.json')
const codexCommands = hookCommands(codexHooks)
const claudeCommands = hookCommands(claudeHooks)
const allCommands = [...codexCommands, ...claudeCommands]

for (const settings of [codexHooks, claudeHooks]) {
  assert.equal(
    (settings.hooks?.PreToolUse ?? []).length,
    0,
    'PreToolUse must stay disabled so Codex does not require unreviewable tool-hook approvals',
  )
  assert.equal(
    (settings.hooks?.PostToolUse ?? []).length,
    0,
    'PostToolUse must stay disabled so Codex does not require unreviewable tool-hook approvals',
  )
  assert.equal(
    (settings.hooks?.PreCompact ?? []).length,
    2,
    'PreCompact must be wired for both auto and manual snapshots',
  )
  assert.deepEqual(
    eventMatchers(settings, 'PreCompact').sort(),
    ['auto', 'manual'],
    'PreCompact must have explicit auto and manual matchers',
  )
  assertCentralEvent(settings, 'UserPromptSubmit', ['UserPromptSubmit'])
  assertCentralEvent(settings, 'Stop', ['Stop'])
  assertCentralEvent(settings, 'PreCompact', ['PreCompactAuto', 'PreCompactManual'])
}

for (const command of allCommands) {
  assert.match(command, /^powershell\b/i, `hook command must be PowerShell-compatible: ${command}`)
  assert.match(command, /\.\/\.codex\/hooks\//, `hook command must use centralized .codex/hooks scripts: ${command}`)
  assert.match(command, /agent-protocol\.ps1/, `hook command must use the single dispatcher: ${command}`)
  assert.doesNotMatch(command, /\.sh\b/, `hook command must not reintroduce Bash scripts: ${command}`)
}

for (const file of [...hookFiles(codexHooks), ...hookFiles(claudeHooks)]) {
  assert.equal(file, './.codex/hooks/agent-protocol.ps1', `only agent-protocol.ps1 may be wired as a hook file: ${file}`)
}

const hookDirectoryFiles = readdirSync(new URL('../.codex/hooks', import.meta.url)).sort()
assert.deepEqual(
  hookDirectoryFiles,
  ['README.md', 'agent-protocol.ps1'],
  '.codex/hooks must contain only README.md and the single central dispatcher',
)

for (const path of [
  '.codex/hooks/agent-protocol.ps1',
  'scripts/append-owner-feedback.ps1',
  '.agent-memory/owner-feedback.md',
  '.agent-memory/progress-snapshots.md',
]) {
  assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} must exist`)
}

const protocolHook = read('.codex/hooks/agent-protocol.ps1')
assert.match(protocolHook, /owner-feedback\.md/, 'protocol hook must write to owner-feedback.md')
assert.match(protocolHook, /ConvertFrom-Json/, 'protocol hook must parse hook JSON payloads')
assert.match(protocolHook, /prompt/i, 'protocol hook must extract prompt text when available')
assert.match(protocolHook, /browser|diff|website|admin/i, 'protocol hook must identify feedback-style prompts')
assert.match(protocolHook, /internalDelegationPattern/i, 'protocol hook must exclude internal sub-agent delegation prompts')
assert.match(protocolHook, /agent-protocol\.log/, 'protocol hook must record orchestrator guard reminders')
assert.match(protocolHook, /pre-deploy-check\.log/, 'protocol hook must retain manual/future pre-deploy check logic')
assert.match(protocolHook, /deploy-errors\.log/, 'protocol hook must retain manual/future deploy error capture logic')
assert.match(protocolHook, /Update-Handoff/, 'protocol hook must retain manual/future handoff update logic')
assert.match(protocolHook, /progress-snapshots\.md/, 'protocol hook must write progress snapshots')
assert.match(protocolHook, /current-state\.md/, 'protocol hook must know current-state memory')
assert.match(protocolHook, /next-steps\.md/, 'protocol hook must know next-steps memory')
assert.match(protocolHook, /Completed/i, 'snapshot must document completed work')
assert.match(protocolHook, /Open/i, 'snapshot must document open work')
assert.match(protocolHook, /Next Steps/i, 'snapshot must document next steps')
assert.match(protocolHook, /Checks\/Status/i, 'snapshot must document checks/status')

const manualFeedbackScript = read('scripts/append-owner-feedback.ps1')
assert.match(manualFeedbackScript, /owner-feedback\.md/, 'manual feedback script must append to owner-feedback.md')
assert.match(manualFeedbackScript, /param\(/, 'manual feedback script must accept explicit feedback text')
assert.match(manualFeedbackScript, /PassThru/, 'manual feedback script stdout must be opt-in only')

const ownerFeedbackMemory = read('.agent-memory/owner-feedback.md')
assert.match(ownerFeedbackMemory, /Pending Owner Feedback/i, 'owner-feedback.md must be a pending feedback log')
assert.match(ownerFeedbackMemory, /UserPromptSubmit/i, 'owner-feedback.md must document automatic prompt capture')
assert.match(ownerFeedbackMemory, /append-owner-feedback\.ps1/i, 'owner-feedback.md must document manual fallback capture')

const progressMemory = read('.agent-memory/progress-snapshots.md')
assert.match(progressMemory, /Progress Snapshots/i, 'progress-snapshots.md must document turn/task snapshots')
assert.match(progressMemory, /Stop/i, 'progress-snapshots.md must document Stop snapshots')
assert.match(progressMemory, /PreCompact/i, 'progress-snapshots.md must document PreCompact snapshots')
assert.match(progressMemory, /completed work/i, 'progress-snapshots.md must describe completed work snapshots')
assert.match(progressMemory, /next steps/i, 'progress-snapshots.md must describe next step snapshots')
assert.doesNotMatch(
  progressMemory,
  /Regression simulation completed|Owner QA remains open|silent simulation/,
  'progress-snapshots.md must not ship with redundant regression/worker snapshots',
)

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

const ownerFeedbackUrl = new URL('../.agent-memory/owner-feedback.md', import.meta.url)
const handoffUrl = new URL('../.agent-memory/handoff.md', import.meta.url)
const progressUrl = new URL('../.agent-memory/progress-snapshots.md', import.meta.url)
const ownerFeedbackBefore = readFileSync(ownerFeedbackUrl, 'utf8')
const handoffBefore = readFileSync(handoffUrl, 'utf8')
const progressBefore = readFileSync(progressUrl, 'utf8')
try {
  const manualFeedbackResult = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      '.\\scripts\\append-owner-feedback.ps1',
      '-Text',
      'Manual fallback regression capture',
      '-Source',
      'hook-regression-check',
    ],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    },
  )
  assert.equal(manualFeedbackResult.status, 0, `Manual feedback fallback must exit 0\n${manualFeedbackResult.stderr}`)
  assert.equal(manualFeedbackResult.stdout.trim(), '', 'Manual feedback fallback must not write stdout by default')
  assert.equal(manualFeedbackResult.stderr.trim(), '', 'Manual feedback fallback must not write stderr')
  assert.match(
    readFileSync(ownerFeedbackUrl, 'utf8'),
    /Manual fallback regression capture/,
    'Manual feedback fallback must append feedback text',
  )

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

  const delegationPayload = JSON.stringify({
    prompt:
      'Workspace: C:\\Users\\email\\supplement-stack. Du bist Dev-Agent. Du bist nicht allein im Codebase; aendere nur die notwendigen Dateien.\\n\\nAufgabe:\\n1. Passe das Admin Dashboard an.\\n2. Fuehre Tests aus.',
  })
  const ownerFeedbackBeforeDelegation = readFileSync(ownerFeedbackUrl, 'utf8')
  const delegationResult = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '.\\.codex\\hooks\\agent-protocol.ps1', '-Event', 'UserPromptSubmit'],
    {
      cwd: new URL('..', import.meta.url),
      input: delegationPayload,
      encoding: 'utf8',
    },
  )
  assert.equal(delegationResult.status, 0, `Internal delegation prompt hook must exit 0\n${delegationResult.stderr}`)
  assert.equal(delegationResult.stdout.trim(), '', 'Internal delegation prompt hook must not write plain text stdout')
  assert.equal(delegationResult.stderr.trim(), '', 'Internal delegation prompt hook must not write stderr')
  assert.equal(
    readFileSync(ownerFeedbackUrl, 'utf8'),
    ownerFeedbackBeforeDelegation,
    'UserPromptSubmit hook must ignore internal Dev-Agent delegation prompts',
  )

  for (const [eventName, marker] of [
    ['Stop', 'Stop'],
    ['PreCompactAuto', 'PreCompactAuto'],
    ['PreCompactManual', 'PreCompactManual'],
  ]) {
    const result = spawnSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '.\\.codex\\hooks\\agent-protocol.ps1', '-Event', eventName],
      {
        cwd: new URL('..', import.meta.url),
        input: JSON.stringify({
          completed: ['Regression simulation completed'],
          open: ['Owner QA remains open'],
          next_steps: ['Run hook regression check'],
          checks_status: ['silent simulation'],
        }),
        encoding: 'utf8',
      },
    )
    assert.equal(result.status, 0, `${eventName} hook must exit 0\n${result.stderr}`)
    assert.equal(result.stdout.trim(), '', `${eventName} hook must not write plain text stdout`)
    assert.equal(result.stderr.trim(), '', `${eventName} hook must not write stderr`)
    assert.match(readFileSync(handoffUrl, 'utf8'), new RegExp(marker), `${eventName} must update handoff mode`)
    assert.match(
      readFileSync(progressUrl, 'utf8'),
      /Regression simulation completed/,
      `${eventName} must update progress snapshot memory`,
    )
  }
} finally {
  writeFileSync(ownerFeedbackUrl, ownerFeedbackBefore)
  writeFileSync(handoffUrl, handoffBefore)
  writeFileSync(progressUrl, progressBefore)
}

console.log('Hook regression checks passed.')
