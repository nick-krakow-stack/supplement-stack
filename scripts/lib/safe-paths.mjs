import { isAbsolute, relative, resolve, sep } from 'node:path'
import { dirname } from 'node:path'
import { existsSync, realpathSync } from 'node:fs'

function fail(message) { throw new Error(message) }

export function assertSafeId(value, label = 'id') {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)) {
    fail(`${label} must be a lowercase path-safe identifier`)
  }
  return value
}

export function assertRelativeManifestPath(value, label = 'path') {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty relative path`)
  const input = value.replaceAll('\\', '/')
  if (isAbsolute(value) || /^[a-zA-Z]:/.test(input) || input.startsWith('/') || input.includes('\0')) {
    fail(`${label} must not be absolute`)
  }
  const parts = input.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) fail(`${label} must not contain empty, . or .. segments`)
  return input
}

export function isContained(root, target) {
  const base = resolve(root)
  const absolute = resolve(target)
  const rel = relative(base, absolute)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

export function assertContained(root, target, label = 'path') {
  const absolute = resolve(target)
  if (!isContained(root, absolute)) fail(`${label} escapes its allowed root`)
  const absoluteRoot = resolve(root)
  if (existsSync(absoluteRoot)) {
    const realRoot = realpathSync.native(absoluteRoot)
    let ancestor = absolute
    while (!existsSync(ancestor)) {
      const parent = dirname(ancestor)
      if (parent === ancestor) break
      ancestor = parent
    }
    if (existsSync(ancestor) && !isContained(realRoot, realpathSync.native(ancestor))) fail(`${label} escapes its allowed root through a symlink or junction`)
  }
  return absolute
}

export function resolveManifestPath(root, value, label = 'path') {
  const input = assertRelativeManifestPath(value, label)
  return assertContained(root, resolve(root, input), label)
}

export function portablePath(root, target) {
  const absolute = assertContained(root, target, 'portable path')
  const rel = relative(resolve(root), absolute).replaceAll('\\', '/')
  return rel || '.'
}

export function assertNoPathCollisions(entries) {
  const seen = new Map()
  for (const { path, label, kind = 'path' } of entries) {
    const absolute = resolve(path)
    let ancestor = absolute
    while (!existsSync(ancestor)) {
      const parent = dirname(ancestor)
      if (parent === ancestor) break
      ancestor = parent
    }
    const key = (existsSync(ancestor)
      ? resolve(realpathSync.native(ancestor), relative(ancestor, absolute))
      : absolute).toLowerCase()
    const prior = seen.get(key)
    if (prior) fail(`path collision: ${prior.label} (${prior.kind}) and ${label} (${kind})`)
    seen.set(key, { label, kind })
  }
}

export function assertOwnedPath(ownedRoot, target, label = 'generated path') {
  const absolute = assertContained(ownedRoot, target, label)
  if (absolute === resolve(ownedRoot)) fail(`${label} must be a file below the owned root`)
  return absolute
}
