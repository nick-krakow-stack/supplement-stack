import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = dirname(fileURLToPath(import.meta.url));

export const KNOWLEDGE_MAGAZINE_FIXTURE_PATH = 'src/render-snapshot/canonicalKnowledgeMagazineRouteFixture.v2.json';

const KNOWLEDGE_MAGAZINE_STATIC_FILES = Object.freeze([
  'index.html',
  'knowledge-magazine-contract-hash.mjs',
  'validate-knowledge-magazine-style.mjs',
  'render-knowledge-magazine-snapshot.mjs',
  KNOWLEDGE_MAGAZINE_FIXTURE_PATH,
  'vite.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'package.json',
  'package-lock.json',
]);

const FRONTEND_SOURCE_EXTENSIONS = Object.freeze(new Set(['.ts', '.tsx', '.css']));

export const KNOWLEDGE_MAGAZINE_RESOLVED_PACKAGES = Object.freeze([
  '@vitejs/plugin-react',
  'autoprefixer',
  'axios',
  'lucide-react',
  'postcss',
  'react',
  'react-dom',
  'react-router-dom',
  'tailwindcss',
  'typescript',
  'vite',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function sha256Bytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function canonicalJsonHash(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(canonicalize(value)), 'utf8'));
}

function compareCanonicalPaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sourceExtension(path) {
  const dotIndex = path.lastIndexOf('.');
  return dotIndex >= 0 ? path.slice(dotIndex).toLowerCase() : '';
}

async function collectFrontendSourceFiles(root, relativeDirectory = 'src') {
  const absoluteDirectory = join(root, ...relativeDirectory.split('/'));
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  entries.sort((left, right) => compareCanonicalPaths(left.name, right.name));
  const files = [];

  for (const entry of entries) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      throw new Error(`Frontend-Fingerprint akzeptiert keinen Symlink unter src/: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...await collectFrontendSourceFiles(root, relativePath));
      continue;
    }
    if (entry.isFile() && FRONTEND_SOURCE_EXTENSIONS.has(sourceExtension(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

export async function listKnowledgeMagazineRouteFiles({ root = DEFAULT_ROOT } = {}) {
  const sourceFiles = await collectFrontendSourceFiles(root);
  return [...new Set([...sourceFiles, ...KNOWLEDGE_MAGAZINE_STATIC_FILES])].sort(compareCanonicalPaths);
}

export async function computeKnowledgeMagazineContractHashes({ root = DEFAULT_ROOT } = {}) {
  const routeFiles = await listKnowledgeMagazineRouteFiles({ root });
  const files = [];
  for (const path of routeFiles) {
    files.push({ path, byte_hash: sha256Bytes(await readFile(join(root, path))) });
  }

  const packageLock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  const resolvedVersions = {};
  for (const packageName of KNOWLEDGE_MAGAZINE_RESOLVED_PACKAGES) {
    const version = packageLock.packages?.[`node_modules/${packageName}`]?.version;
    if (typeof version !== 'string' || !version) {
      throw new Error(`package-lock.json enthält keine aufgelöste Version für ${packageName}.`);
    }
    resolvedVersions[packageName] = version;
  }

  const routeFingerprintParts = {
    schema: 'knowledge_magazine_route_fingerprint_parts.v2',
    files,
    resolved_versions: resolvedVersions,
  };
  const rendererStyleHash = canonicalJsonHash(routeFingerprintParts);
  const fixture = JSON.parse(await readFile(join(root, KNOWLEDGE_MAGAZINE_FIXTURE_PATH), 'utf8'));
  const fixtureHash = canonicalJsonHash(fixture);

  return {
    renderer_style_hash: rendererStyleHash,
    fixture_hash: fixtureHash,
    route_fingerprint: rendererStyleHash,
    route_fingerprint_parts: routeFingerprintParts,
    fixture,
  };
}
