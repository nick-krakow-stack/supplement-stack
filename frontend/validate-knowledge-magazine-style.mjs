#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildVite } from 'vite';
import { JSDOM } from 'jsdom';
import {
  canonicalJsonHash,
  computeKnowledgeMagazineContractHashes,
} from './knowledge-magazine-contract-hash.mjs';

const EXIT = Object.freeze({ PASS: 0, STYLE_FAIL: 1, INPUT: 2, INTERNAL: 3 });
const ROOT = dirname(fileURLToPath(import.meta.url));
const VALIDATOR_VERSION = 'knowledge-magazine-route-browser-contract.v2.2.0';
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ width: 1440, height: 1000, device_scale_factor: 1, mobile: false }),
  mobile: Object.freeze({ width: 390, height: 844, device_scale_factor: 1, mobile: true }),
});
const CRAWLER_USER_AGENT = 'Googlebot';

function publicViewport(viewport) {
  return {
    width: viewport.width,
    height: viewport.height,
    device_scale_factor: viewport.device_scale_factor,
  };
}

export class StyleContractError extends Error {
  constructor(code, message, exitCode = EXIT.INPUT) {
    super(message);
    this.name = 'StyleContractError';
    this.code = code;
    this.exit_code = exitCode;
  }
}

function usage() {
  return [
    'Usage:',
    '  node frontend/validate-knowledge-magazine-style.mjs --input <request.json> [--out <receipt.json>]',
    '  node frontend/validate-knowledge-magazine-style.mjs --print-contract-hash',
    '',
    'Accepted inputs: renderer_style_validation_request.v2 or renderer_public_readback_request.v2.',
    'Exit codes: 0 PASS, 1 route/style FAIL, 2 input/browser unavailable, 3 internal/resource error.',
  ].join('\n');
}

function parseArgs(argv) {
  const result = { input: null, out: null, help: false, printContractHash: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      result.help = true;
      continue;
    }
    if (argument === '--print-contract-hash') {
      result.printContractHash = true;
      continue;
    }
    if (argument !== '--input' && argument !== '--out') {
      throw new StyleContractError('USAGE_INVALID', `Unbekanntes Argument: ${argument}`);
    }
    if (seen.has(argument)) throw new StyleContractError('USAGE_INVALID', `Argument doppelt angegeben: ${argument}`);
    seen.add(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new StyleContractError('USAGE_INVALID', `Wert für ${argument} fehlt.`);
    result[argument === '--input' ? 'input' : 'out'] = value;
    index += 1;
  }
  if (result.printContractHash && (result.input || result.out)) {
    throw new StyleContractError('USAGE_INVALID', '--print-contract-hash darf nicht mit --input/--out kombiniert werden.');
  }
  if (!result.help && !result.printContractHash && !result.input) {
    throw new StyleContractError('USAGE_INVALID', '--input ist erforderlich.');
  }
  return result;
}

function requireHash(value, path) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw new StyleContractError('INPUT_HASH_INVALID', `${path} muss sha256:<64 lowercase hex> entsprechen.`);
  }
  return value;
}

async function readJsonStrict(path) {
  let bytes;
  try {
    bytes = await readFile(resolve(path));
  } catch (error) {
    throw new StyleContractError('INPUT_READ_FAILED', `Input konnte nicht gelesen werden: ${error.message}`);
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new StyleContractError('INPUT_UTF8_INVALID', 'Input ist kein valides UTF-8.');
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new StyleContractError('INPUT_JSON_INVALID', `Input ist kein valides JSON: ${error.message}`);
  }
}

function requireRecord(value, path) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path} muss ein Objekt sein.`);
  }
  return value;
}

function requireExactKeys(value, allowedKeys, path) {
  const unexpectedKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  const missingKeys = [...allowedKeys].filter((key) => !Object.hasOwn(value, key));
  if (unexpectedKeys.length || missingKeys.length) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path} hat unerwartete (${unexpectedKeys.join(', ') || 'keine'}) oder fehlende Felder (${missingKeys.join(', ') || 'keine'}).`);
  }
}

function requireNonEmptyString(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path} muss ein nicht-leerer String sein.`);
  return value;
}

function normalizeStyleInput(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', 'Style-Request muss ein Objekt sein.');
  }
  if (value.schema !== 'renderer_style_validation_request.v2') {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', 'schema muss renderer_style_validation_request.v2 sein.');
  }
  const allowedKeys = new Set(['schema', 'renderer_style_hash', 'fixture_hash']);
  const unexpectedKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpectedKeys.length) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `Style-Request enthält redundante oder artikelabhängige Felder: ${unexpectedKeys.join(', ')}.`);
  }
  return {
    schema: 'renderer_style_validation_request.v2',
    renderer_style_hash: requireHash(value.renderer_style_hash, 'renderer_style_hash'),
    fixture_hash: requireHash(value.fixture_hash, 'fixture_hash'),
  };
}

const PUBLIC_CHECKS = Object.freeze({
  stage2: Object.freeze(['assets', 'canonical', 'fazit', 'h1_dek', 'indexability', 'internal_links', 'json_ld', 'projection', 'robots', 'sources']),
  stage3: Object.freeze(['assets', 'canonical', 'controls', 'fazit', 'h1_dek', 'indexability', 'internal_links', 'json_ld', 'left_navigation', 'projection', 'robots', 'sources', 'toc', 'ui']),
});

function normalizePublicArticle(value, index) {
  const path = `articles[${index}]`;
  const article = requireRecord(value, path);
  requireExactKeys(article, new Set([
    'article_id', 'stage', 'slug', 'public_url', 'desired_status', 'compiled_payload_hash', 'visible_payload_hash',
    'relation_hash', 'asset_hashes', 'projection_hash', 'expected_projection', 'seo_hash', 'expected_seo', 'required_checks',
  ]), path);
  const articleId = requireNonEmptyString(article.article_id, `${path}.article_id`);
  const stage = article.stage;
  if (!Object.hasOwn(PUBLIC_CHECKS, stage)) throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.stage muss stage2 oder stage3 sein.`);
  const slug = requireNonEmptyString(article.slug, `${path}.slug`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.slug ist ungültig.`);
  const publicUrl = requireNonEmptyString(article.public_url, `${path}.public_url`);
  let parsedPublicUrl;
  try { parsedPublicUrl = new URL(publicUrl); } catch { throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.public_url ist keine absolute URL.`); }
  if (!['http:', 'https:'].includes(parsedPublicUrl.protocol) || parsedPublicUrl.username || parsedPublicUrl.password || parsedPublicUrl.hash || parsedPublicUrl.pathname !== `/wissen/${slug}`) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.public_url bindet nicht exakt /wissen/${slug}.`);
  }
  if (article.desired_status !== 'published') throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.desired_status muss published sein.`);
  const hashFields = ['compiled_payload_hash', 'visible_payload_hash', 'relation_hash', 'projection_hash', 'seo_hash'];
  for (const field of hashFields) requireHash(article[field], `${path}.${field}`);
  if (!Array.isArray(article.asset_hashes) || article.asset_hashes.some((hash) => !HASH_PATTERN.test(hash)) || new Set(article.asset_hashes).size !== article.asset_hashes.length) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.asset_hashes muss eine eindeutige Hashliste sein.`);
  }
  const expectedProjection = requireRecord(article.expected_projection, `${path}.expected_projection`);
  if (expectedProjection.schema !== 'article_render_projection.v2'
    || expectedProjection.article_id !== articleId
    || expectedProjection.route !== `/wissen/${slug}`
    || expectedProjection.template !== (stage === 'stage3' ? 'magazine' : 'study_article_v2')
    || canonicalJsonHash(expectedProjection) !== article.projection_hash) {
    throw new StyleContractError('INPUT_PROJECTION_BINDING_INVALID', `${path}.expected_projection/Hash/Identität ist inkonsistent.`);
  }
  const expectedSeo = requireRecord(article.expected_seo, `${path}.expected_seo`);
  requireExactKeys(expectedSeo, new Set(['meta_title', 'meta_description', 'canonical_url', 'canonical_path', 'robots', 'indexable', 'json_ld']), `${path}.expected_seo`);
  if (canonicalJsonHash(expectedSeo) !== article.seo_hash
    || expectedSeo.canonical_url !== publicUrl
    || expectedSeo.canonical_path !== `/wissen/${slug}`
    || expectedSeo.robots !== 'index,follow'
    || expectedSeo.indexable !== true) {
    throw new StyleContractError('INPUT_SEO_BINDING_INVALID', `${path}.expected_seo/Hash/Canonical/Indexierbarkeit ist inkonsistent.`);
  }
  if (!Array.isArray(article.required_checks) || canonicalJsonHash(article.required_checks) !== canonicalJsonHash(PUBLIC_CHECKS[stage])) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.required_checks weicht vom kanonischen ${stage}-Set ab.`);
  }
  return {
    article_id: articleId,
    stage,
    slug,
    public_url: parsedPublicUrl.href,
    desired_status: 'published',
    compiled_payload_hash: article.compiled_payload_hash,
    visible_payload_hash: article.visible_payload_hash,
    relation_hash: article.relation_hash,
    asset_hashes: [...article.asset_hashes],
    projection_hash: article.projection_hash,
    expected_projection: expectedProjection,
    seo_hash: article.seo_hash,
    expected_seo: expectedSeo,
    required_checks: [...article.required_checks],
  };
}

const BADGE_EXPECTATION_RULES = Object.freeze({
  studies: Object.freeze(new Set(['REQUIRE_TRUE', 'PRESERVE', 'API_DOM_PARITY'])),
  dge: Object.freeze(new Set(['PRESERVE', 'API_DOM_PARITY'])),
});

function normalizeAffectedIngredientIds(value) {
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', 'affected_ingredient_ids muss eine nicht-leere Liste positiver Integer sein.');
  }
  if (new Set(value).size !== value.length || canonicalJsonHash(value) !== canonicalJsonHash([...value].sort((left, right) => left - right))) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', 'affected_ingredient_ids muss eindeutig und numerisch sortiert sein.');
  }
  return [...value];
}

function normalizeBadgeExpectation(value, index) {
  const path = `badge_expectations[${index}]`;
  const expectation = requireRecord(value, path);
  requireExactKeys(expectation, new Set([
    'ingredient_id', 'studies_rule', 'expected_has_studies', 'dge_rule', 'expected_has_dge',
  ]), path);
  if (!Number.isInteger(expectation.ingredient_id) || expectation.ingredient_id <= 0) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.ingredient_id muss ein positiver Integer sein.`);
  }
  if (!BADGE_EXPECTATION_RULES.studies.has(expectation.studies_rule)) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.studies_rule ist ungültig.`);
  }
  if (!BADGE_EXPECTATION_RULES.dge.has(expectation.dge_rule)) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.dge_rule ist ungültig.`);
  }
  const studiesNeedsExpected = expectation.studies_rule !== 'API_DOM_PARITY';
  const dgeNeedsExpected = expectation.dge_rule === 'PRESERVE';
  if ((studiesNeedsExpected && typeof expectation.expected_has_studies !== 'boolean')
    || (!studiesNeedsExpected && expectation.expected_has_studies !== null)
    || (expectation.studies_rule === 'REQUIRE_TRUE' && expectation.expected_has_studies !== true)) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.expected_has_studies passt nicht zur Regel.`);
  }
  if ((dgeNeedsExpected && typeof expectation.expected_has_dge !== 'boolean')
    || (!dgeNeedsExpected && expectation.expected_has_dge !== null)) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', `${path}.expected_has_dge passt nicht zur Regel.`);
  }
  return {
    ingredient_id: expectation.ingredient_id,
    studies_rule: expectation.studies_rule,
    expected_has_studies: expectation.expected_has_studies,
    dge_rule: expectation.dge_rule,
    expected_has_dge: expectation.expected_has_dge,
  };
}

function normalizePublicReadbackInput(value) {
  const request = requireRecord(value, 'Public-Readback-Request');
  requireExactKeys(request, new Set([
    'schema', 'release_hash', 'publish_target', 'generated_at', 'affected_ingredient_ids', 'badge_expectations', 'articles', 'content_hash',
  ]), 'Public-Readback-Request');
  if (request.schema !== 'renderer_public_readback_request.v2') throw new StyleContractError('INPUT_SCHEMA_INVALID', 'schema muss renderer_public_readback_request.v2 sein.');
  const releaseHash = requireHash(request.release_hash, 'release_hash');
  const publishTarget = requireNonEmptyString(request.publish_target, 'publish_target');
  const generatedAt = requireNonEmptyString(request.generated_at, 'generated_at');
  if (!Number.isFinite(Date.parse(generatedAt))) throw new StyleContractError('INPUT_SCHEMA_INVALID', 'generated_at muss ISO-8601 sein.');
  const affectedIngredientIds = normalizeAffectedIngredientIds(request.affected_ingredient_ids);
  if (!Array.isArray(request.badge_expectations) || request.badge_expectations.length !== affectedIngredientIds.length) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', 'badge_expectations muss jede betroffene Ingredient-ID genau einmal binden.');
  }
  const badgeExpectations = request.badge_expectations.map(normalizeBadgeExpectation);
  const expectationIds = badgeExpectations.map((expectation) => expectation.ingredient_id);
  if (canonicalJsonHash(expectationIds) !== canonicalJsonHash(affectedIngredientIds)) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', 'badge_expectations muss nach affected_ingredient_ids sortiert und identisch gescopt sein.');
  }
  if (!Array.isArray(request.articles) || request.articles.length === 0) throw new StyleContractError('INPUT_SCHEMA_INVALID', 'articles muss eine nicht-leere Liste sein.');
  const articles = request.articles.map(normalizePublicArticle);
  const articleIds = articles.map((article) => article.article_id);
  if (new Set(articleIds).size !== articleIds.length || canonicalJsonHash(articleIds) !== canonicalJsonHash([...articleIds].sort())) {
    throw new StyleContractError('INPUT_SCHEMA_INVALID', 'articles muss nach eindeutiger article_id sortiert sein.');
  }
  const contentHash = requireHash(request.content_hash, 'content_hash');
  const base = {
    schema: 'renderer_public_readback_request.v2',
    release_hash: releaseHash,
    publish_target: publishTarget,
    generated_at: generatedAt,
    affected_ingredient_ids: affectedIngredientIds,
    badge_expectations: badgeExpectations,
    articles,
  };
  if (canonicalJsonHash(base) !== contentHash) throw new StyleContractError('INPUT_CONTENT_HASH_MISMATCH', 'content_hash bindet den normalisierten Public-Readback-Request nicht.');
  return { ...base, content_hash: contentHash };
}

function normalizeInput(value) {
  if (value?.schema === 'renderer_public_readback_request.v2') return normalizePublicReadbackInput(value);
  return normalizeStyleInput(value);
}

function browserCandidates() {
  const explicit = process.env.KNOWLEDGE_STYLE_BROWSER_PATH || process.env.ADMIN_QA_BROWSER_PATH;
  if (explicit) return [explicit];
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return [
      ...roots.map((root) => join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
      ...roots.map((root) => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')),
    ];
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

function findBrowserExecutable() {
  const executable = browserCandidates().find((candidate) => candidate && existsSync(candidate));
  if (!executable) {
    throw new StyleContractError('BROWSER_UNAVAILABLE', 'Kein lokales Chrome/Edge gefunden; KNOWLEDGE_STYLE_BROWSER_PATH kann den Browserpfad setzen.');
  }
  return executable;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = net.createServer();
    server.unref();
    server.once('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => {
        if (error) rejectPort(error);
        else if (!address || typeof address === 'string') rejectPort(new Error('Kein TCP-Port verfügbar.'));
        else resolvePort(address.port);
      });
    });
  });
}

async function waitForJson(url, timeoutMs = 12_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new StyleContractError('BROWSER_LAUNCH_FAILED', `Browser-Debug-Port blieb unerreichbar: ${lastError?.message ?? 'Timeout'}`, EXIT.INTERNAL);
}

async function createBrowserTarget(port) {
  const url = `http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`;
  let response = await fetch(url, { method: 'PUT' });
  if (response.status === 405) response = await fetch(url);
  if (!response.ok) throw new StyleContractError('BROWSER_LAUNCH_FAILED', `Browser-Target konnte nicht erstellt werden (HTTP ${response.status}).`, EXIT.INTERNAL);
  return response.json();
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.lastMainFrameNavigationAt = 0;
  }

  async connect() {
    if (typeof WebSocket === 'undefined') {
      throw new StyleContractError('BROWSER_UNAVAILABLE', 'Der Routen-Nachweis benötigt Node mit globalem WebSocket (Node 22+).');
    }
    await new Promise((resolveConnect, rejectConnect) => {
      const timeout = setTimeout(() => rejectConnect(new StyleContractError('BROWSER_LAUNCH_FAILED', 'CDP-Verbindung hat das Zeitlimit überschritten.', EXIT.INTERNAL)), 10_000);
      this.webSocket = new WebSocket(this.webSocketUrl);
      this.webSocket.addEventListener('open', () => {
        clearTimeout(timeout);
        resolveConnect();
      });
      this.webSocket.addEventListener('error', (event) => {
        clearTimeout(timeout);
        rejectConnect(new StyleContractError('BROWSER_LAUNCH_FAILED', `CDP-Verbindung fehlgeschlagen: ${event.type}`, EXIT.INTERNAL));
      });
      this.webSocket.addEventListener('message', (event) => this.handleMessage(event.data));
      this.webSocket.addEventListener('close', () => {
        for (const pending of this.pending.values()) pending.reject(new Error('CDP-Verbindung geschlossen.'));
        this.pending.clear();
      });
    });
    return this;
  }

  handleMessage(data) {
    const message = JSON.parse(data);
    if (!message.id) {
      if (message.method === 'Page.frameNavigated' && !message.params?.frame?.parentId) {
        this.lastMainFrameNavigationAt = Date.now();
      }
      return;
    }
    if (!this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result ?? {});
  }

  send(method, params = {}) {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP-Verbindung ist nicht offen.'));
    const id = this.nextId++;
    return new Promise((resolveMessage, rejectMessage) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectMessage(new Error(`CDP ${method} hat das Zeitlimit überschritten.`));
      }, 12_000);
      this.pending.set(id, { resolve: resolveMessage, reject: rejectMessage, timeout });
      this.webSocket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.webSocket?.close();
  }
}

export async function createTemporaryBrowserProfile(mkdtempImplementation = mkdtemp) {
  try {
    return await mkdtempImplementation(join(tmpdir(), 'knowledge-route-contract-'));
  } catch (error) {
    throw new StyleContractError('BROWSER_TEMP_FAILED', `Temporäres Browserprofil konnte nicht erstellt werden: ${error.message}`, EXIT.INTERNAL);
  }
}

export async function spawnBrowserProcess(executable, args, spawnImplementation = spawn) {
  let child;
  try {
    child = spawnImplementation(executable, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  } catch (error) {
    throw new StyleContractError('BROWSER_SPAWN_FAILED', `Browserprozess konnte nicht gestartet werden: ${error.message}`, EXIT.INTERNAL);
  }
  if (!(child instanceof EventEmitter) && typeof child?.once !== 'function') {
    throw new StyleContractError('BROWSER_SPAWN_FAILED', 'Browser-Spawn lieferte keinen Prozess.', EXIT.INTERNAL);
  }
  await new Promise((resolveSpawn, rejectSpawn) => {
    child.once('spawn', resolveSpawn);
    child.once('error', (error) => rejectSpawn(new StyleContractError('BROWSER_SPAWN_FAILED', `Browserprozess konnte nicht gestartet werden: ${error.message}`, EXIT.INTERNAL)));
  });
  return child;
}

async function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return Promise.race([
    new Promise((resolveExit) => child.once('exit', () => resolveExit(true))),
    delay(timeoutMs).then(() => false),
  ]);
}

async function terminateWindowsProcessTree(pid, timeoutMs = 5_000, spawnImplementation = spawn) {
  await new Promise((resolveTree, rejectTree) => {
    let killer;
    let settled = false;
    let timeout;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) rejectTree(error);
      else resolveTree();
    };
    try {
      killer = spawnImplementation('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
        shell: false,
      });
    } catch (error) {
      finish(error);
      return;
    }
    timeout = setTimeout(() => {
      try { killer.kill(); } catch {}
      finish(new Error(`taskkill.exe überschritt ${timeoutMs} ms.`));
    }, timeoutMs);
    killer.once('error', finish);
    killer.once('exit', (code) => {
      if (code === 0) finish();
      else finish(new Error(`taskkill.exe endete mit Exit-Code ${code}.`));
    });
  });
}

export async function terminateBrowserProcess(child, {
  platform = process.platform,
  treeKill = terminateWindowsProcessTree,
  treeKillTimeoutMs = 5_000,
} = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
      try {
        await treeKill(child.pid, treeKillTimeoutMs);
      } catch (error) {
        if (await waitForProcessExit(child, 250)) return;
        throw error;
      }
      if (await waitForProcessExit(child, 2_000)) return;
      throw new Error('Browserprozessbaum blieb nach taskkill.exe aktiv.');
    }
    child.kill();
    if (await waitForProcessExit(child, 2_000)) return;
    child.kill('SIGKILL');
    if (await waitForProcessExit(child, 2_000)) return;
  } catch (error) {
    throw new StyleContractError('BROWSER_CLOSE_FAILED', `Browserprozess konnte nicht beendet werden: ${error.message}`, EXIT.INTERNAL);
  }
  throw new StyleContractError('BROWSER_CLOSE_FAILED', 'Browserprozess blieb nach SIGKILL aktiv.', EXIT.INTERNAL);
}

export async function removeBrowserProfile(path, rmImplementation = rm) {
  if (!path) return;
  try {
    await rmImplementation(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  } catch (error) {
    throw new StyleContractError('BROWSER_TEMP_CLEANUP_FAILED', `Temporäres Browserprofil konnte nicht entfernt werden: ${error.message}`, EXIT.INTERNAL);
  }
}

async function listenHttp(server) {
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Lokaler Route-Server hat keinen TCP-Port erhalten.');
  return address.port;
}

async function closeHttp(server) {
  if (!server?.listening) return;
  await new Promise((resolveClose, rejectClose) => server.close((error) => (error ? rejectClose(error) : resolveClose())));
}

function withHarnessScript(indexHtml) {
  const harness = `<script>(()=>{const ready=async()=>{try{if(document.fonts?.ready)await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1500))]);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));document.documentElement.dataset.knowledgeStyleContract='ready'}catch(error){document.documentElement.dataset.knowledgeStyleContract='error';document.documentElement.dataset.knowledgeStyleContractError=error instanceof Error?error.message:String(error)}};void ready()})()</script>`;
  return indexHtml.replace('</body>', `${harness}</body>`);
}

export async function startActualRouteServer(route, {
  articles = [],
  knowledgeOverview = null,
  productionApiFetch = null,
  publicRoutes = [],
  robotsText = 'User-agent: *\nAllow: /\n',
  robotsStatus = 200,
  sitemapText = '',
  sitemapStatus = 404,
  assets = [],
} = {}) {
  const articleBySlug = new Map(articles.map((article) => [article.slug, article]));
  const assetByPath = new Map(assets.map((asset) => [asset.path, asset]));
  const servedRoutes = new Set([
    route,
    ...articles.map((article) => `/wissen/${article.slug}`),
    ...(knowledgeOverview ? ['/wissen'] : []),
    ...publicRoutes,
  ]);
  const requestLog = [];
  const buildDirectory = await mkdtemp(join(tmpdir(), 'knowledge-route-build-'));
  const outputDirectory = join(buildDirectory, 'dist');
  let buildReady = false;
  try {
    await buildVite({
      root: ROOT,
      mode: 'production',
      envDir: buildDirectory,
      logLevel: 'silent',
      define: {
        'import.meta.env.DEV': 'false',
        'import.meta.env.PROD': 'true',
        'import.meta.env.VITE_API_BASE_URL': 'undefined',
      },
      build: { outDir: outputDirectory, emptyOutDir: true },
    });
    buildReady = true;
  } catch (error) {
    await rm(buildDirectory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
    throw new StyleContractError('STYLE_BUILD_FAILED', `Produktiver Frontend-Build für den Route-Vertrag schlug fehl: ${error.message}`, EXIT.INTERNAL);
  }
  let rawIndexHtml;
  try {
    rawIndexHtml = await readFile(join(outputDirectory, 'index.html'), 'utf8');
  } catch (error) {
    await rm(buildDirectory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
    throw new StyleContractError('STYLE_BUILD_ARTIFACT_FAILED', `Produktiver Frontend-Build enthält keine lesbare index.html: ${error.message}`, EXIT.INTERNAL);
  }
  const contentTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.webp', 'image/webp'],
    ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2'],
  ]);
  const vite = {
    close: async () => {
      if (buildReady) await rm(buildDirectory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
      buildReady = false;
    },
  };
  const server = createHttpServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost');
      const pathname = requestUrl.pathname;
      requestLog.push(`${pathname}${requestUrl.search}`);
      if (pathname === '/api/me') {
        response.statusCode = 401;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end('{"error":"fixture unauthenticated"}');
        return;
      }
      if (pathname === '/api/analytics/pageview') {
        response.statusCode = 204;
        response.end();
        return;
      }
      if (pathname === '/robots.txt') {
        response.statusCode = robotsStatus;
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(robotsText);
        return;
      }
      if (pathname === '/sitemap.xml') {
        response.statusCode = sitemapStatus;
        response.setHeader('Content-Type', 'application/xml; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        const publicOrigin = `http://${request.headers.host}`;
        response.end(typeof sitemapText === 'function' ? sitemapText(publicOrigin) : sitemapText);
        return;
      }
      if (typeof productionApiFetch === 'function'
        && (pathname === '/api/knowledge' || pathname.startsWith('/api/knowledge/') || pathname.startsWith('/api/r2/'))) {
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
          if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
          else if (typeof value === 'string') headers.set(name, value);
        }
        const origin = `http://${request.headers.host ?? '127.0.0.1'}`;
        const productionResponse = await productionApiFetch(new Request(new URL(request.url ?? '/', origin), {
          method: request.method,
          headers,
        }));
        response.statusCode = productionResponse.status;
        productionResponse.headers.forEach((value, name) => response.setHeader(name, value));
        response.end(Buffer.from(await productionResponse.arrayBuffer()));
        return;
      }
      if (assetByPath.has(pathname)) {
        const asset = assetByPath.get(pathname);
        response.statusCode = 200;
        response.setHeader('Content-Type', asset.content_type);
        response.setHeader('Cache-Control', 'no-store');
        response.end(asset.bytes);
        return;
      }
      if (pathname.startsWith('/api/knowledge/')) {
        const slug = decodeURIComponent(pathname.slice('/api/knowledge/'.length));
        const article = articleBySlug.get(slug);
        response.statusCode = article ? 200 : 404;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify(article ? { article } : { error: 'Artikel nicht gefunden.' }));
        return;
      }
      if (pathname === '/api/knowledge' && knowledgeOverview) {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify(knowledgeOverview));
        return;
      }
      if (servedRoutes.has(pathname)) {
        const html = withHarnessScript(rawIndexHtml);
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(html);
        return;
      }
      const decodedPath = decodeURIComponent(pathname);
      const filePath = resolve(outputDirectory, `.${decodedPath}`);
      const outputPrefix = `${resolve(outputDirectory)}${sep}`;
      if (!filePath.startsWith(outputPrefix)) {
        response.statusCode = 403;
        response.end('Forbidden');
        return;
      }
      try {
        const bytes = await readFile(filePath);
        response.statusCode = 200;
        response.setHeader('Content-Type', contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream');
        response.setHeader('Cache-Control', 'no-store');
        response.end(bytes);
      } catch {
        response.statusCode = 404;
        response.end('Not found');
      }
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error));
    }
  });
  try {
    const port = await listenHttp(server);
    return { vite, server, url: `http://127.0.0.1:${port}${route}`, base_url: `http://127.0.0.1:${port}`, request_log: requestLog };
  } catch (error) {
    try {
      await closeActualRouteServer({ vite, server });
    } catch (cleanupError) {
      throw new StyleContractError(
        'STYLE_SERVER_START_CLEANUP_FAILED',
        `Route-Server-Start schlug fehl und Ressourcen konnten nicht sauber geschlossen werden: ${cleanupError.message}`,
        EXIT.INTERNAL,
      );
    }
    throw new StyleContractError('STYLE_SERVER_START_FAILED', `Echter Route-Server konnte nicht gestartet werden: ${error.message}`, EXIT.INTERNAL);
  }
}

export async function closeActualRouteServer(resources, closeHttpImplementation = closeHttp) {
  if (!resources) return;
  const errors = [];
  try {
    await closeHttpImplementation(resources.server);
  } catch (error) {
    errors.push(`HTTP: ${error.message}`);
  }
  try {
    await resources.vite.close();
  } catch (error) {
    errors.push(`Vite: ${error.message}`);
  }
  if (errors.length) {
    throw new StyleContractError('STYLE_SERVER_CLOSE_FAILED', `Route-Server konnte nicht sauber geschlossen werden: ${errors.join('; ')}`, EXIT.INTERNAL);
  }
}

function fixtureInjectionSource(fixture, route) {
  const serializedFixture = JSON.stringify(fixture).replace(/[\u2028\u2029]/g, (character) => (character === '\u2028' ? '\\u2028' : '\\u2029'));
  const knowledgePath = `/api/knowledge/${encodeURIComponent(fixture.article.slug)}`;
  return `(() => {
    window.localStorage.setItem('supplement-stack-analytics-consent', 'declined');
    const fixture = ${serializedFixture};
    const originalFetch = window.fetch.bind(window);
    window.__knowledgeRouteFixture = { route: ${JSON.stringify(route)}, knowledgeFetchCount: 0 };
    window.fetch = (input, init) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(raw, window.location.origin);
      if (url.pathname === ${JSON.stringify(knowledgePath)}) {
        window.__knowledgeRouteFixture.knowledgeFetchCount += 1;
        return Promise.resolve(new Response(JSON.stringify({ article: fixture.article }), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }));
      }
      return originalFetch(input, init);
    };
  })();`;
}

async function waitForHydratedRoute(page, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const article = document.querySelector('article[data-testid="knowledge-magazine-article"]');
        return document.readyState === 'complete'
          && document.documentElement.dataset.knowledgeStyleContract === 'ready'
          && article?.getAttribute('data-ui-contract') === 'knowledge-magazine-ui.v2'
          && (window.__knowledgeRouteFixture?.knowledgeFetchCount ?? 0) >= 1;
      })()`,
      returnByValue: true,
    }).catch(() => ({ result: { value: false } }));
    if (result.result?.value === true && Date.now() - page.lastMainFrameNavigationAt >= 500) return;
    await delay(100);
  }
  throw new StyleContractError('ROUTE_HYDRATION_FAILED', 'Die echte /wissen/:slug-Route wurde nicht rechtzeitig hydriert.', EXIT.INTERNAL);
}

async function waitForPublicRoute(page, article, timeoutMs = 25_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const root = document.querySelector('article[data-template]');
        const images = root ? Array.from(root.querySelectorAll('img')) : [];
        return document.readyState === 'complete'
          && location.pathname === ${JSON.stringify(`/wissen/${article.slug}`)}
          && root?.getAttribute('data-template') === ${JSON.stringify(article.expected_projection.template)}
          && Boolean(root.querySelector('h1'))
          && Boolean(document.head.querySelector('meta[name="description"]'))
          && Boolean(document.head.querySelector('meta[name="robots"]'))
          && Boolean(document.head.querySelector('link[rel="canonical"]'))
          && Boolean(document.head.querySelector('script[data-knowledge-article-json-ld="true"]'))
          && images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      })()`,
      returnByValue: true,
    }).catch(() => ({ result: { value: false } }));
    if (result.result?.value === true && Date.now() - page.lastMainFrameNavigationAt >= 500) return;
    await delay(100);
  }
  const diagnostics = await runtimeValue(page, `(() => ({
    ready_state: document.readyState,
    route: location.pathname,
    template: document.querySelector('article[data-template]')?.getAttribute('data-template') ?? null,
    body_text: document.body.innerText.slice(0, 300),
    description: Boolean(document.head.querySelector('meta[name="description"]')),
    robots: Boolean(document.head.querySelector('meta[name="robots"]')),
    canonical: Boolean(document.head.querySelector('link[rel="canonical"]')),
    json_ld: Boolean(document.head.querySelector('script[data-knowledge-article-json-ld="true"]')),
    images: Array.from(document.querySelectorAll('article[data-template] img')).map((image) => ({ complete: image.complete, width: image.naturalWidth, height: image.naturalHeight, src: image.getAttribute('src') })),
    resources: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => name.includes('knowledge') || name.includes('/api/')),
  }))()`);
  throw new StyleContractError('PUBLIC_ROUTE_HYDRATION_FAILED', `Die öffentliche Route /wissen/${article.slug} wurde nicht vollständig hydriert: ${JSON.stringify(diagnostics)}.`, EXIT.INTERNAL);
}

async function runtimeValue(page, expression, awaitPromise = false) {
  const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (!result.result || !Object.hasOwn(result.result, 'value')) {
    throw new StyleContractError('ROUTE_EVALUATION_FAILED', 'Browser lieferte keinen auswertbaren Runtime-Wert.', EXIT.INTERNAL);
  }
  return result.result.value;
}

async function waitForDisclosureExpansion(page, triggerId, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const expanded = await runtimeValue(page, `(() => {
      const trigger = document.getElementById(${JSON.stringify(triggerId)});
      const panel = document.getElementById(trigger?.getAttribute('aria-controls') || '');
      if (!trigger || !panel) return null;
      const rect = panel.getBoundingClientRect();
      const style = getComputedStyle(panel);
      return {
        expanded: trigger.getAttribute('aria-expanded') === 'true',
        panel_hidden: panel.hasAttribute('hidden'),
        panel_exposed: !panel.hasAttribute('hidden') && style.display !== 'none'
          && style.visibility !== 'hidden' && style.visibility !== 'collapse'
          && Number.parseFloat(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0,
      };
    })()`);
    if (expanded?.expanded && expanded.panel_hidden === false && expanded.panel_exposed) return expanded;
    await delay(75);
  }
  const eventTrace = await runtimeValue(page, 'window.__knowledgePointerTrace ?? []');
  throw new StyleContractError('ROUTE_INTERACTION_FAILED', `Disclosure ${triggerId} ließ sich per echtem Pointer-Input nicht öffnen; Event-Trace: ${JSON.stringify(eventTrace)}.`, EXIT.INTERNAL);
}

async function expandDisclosures(page, timeoutMs = 8_000) {
  const triggerIds = await runtimeValue(page, `Array.from(document.querySelectorAll('[data-knowledge-disclosure="trigger"]')).map((trigger) => trigger.id)`);
  if (!Array.isArray(triggerIds) || triggerIds.length === 0 || triggerIds.some((id) => typeof id !== 'string' || !id)) {
    throw new StyleContractError('ROUTE_INTERACTION_FAILED', 'Disclosure-Trigger fehlen oder besitzen keine stabilen IDs.', EXIT.INTERNAL);
  }

  const interactions = [];
  for (const triggerId of triggerIds) {
    const target = await runtimeValue(page, `(async () => {
      const trigger = document.getElementById(${JSON.stringify(triggerId)});
      if (!trigger) return { error: 'trigger-missing' };
      let previousRect = null;
      let stableFrames = 0;
      let geometrySamples = 0;
      const geometryDeadline = performance.now() + 2500;
      while (stableFrames < 3 && performance.now() < geometryDeadline) {
        trigger.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        await new Promise((resolve) => setTimeout(resolve, 60));
        const sample = trigger.getBoundingClientRect();
        geometrySamples += 1;
        const stable = previousRect
          && Math.abs(sample.left - previousRect.left) < 0.25
          && Math.abs(sample.top - previousRect.top) < 0.25
          && Math.abs(sample.width - previousRect.width) < 0.25
          && Math.abs(sample.height - previousRect.height) < 0.25;
        stableFrames = stable ? stableFrames + 1 : 0;
        previousRect = { left: sample.left, top: sample.top, width: sample.width, height: sample.height };
      }
      const rect = trigger.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const chain = [];
      for (let current = trigger; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        chain.push({
          tag: current.tagName.toLowerCase(),
          id: current.id || null,
          hidden: current.hasAttribute('hidden'),
          inert: current.hasAttribute('inert'),
          aria_hidden: current.getAttribute('aria-hidden') === 'true',
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointer_events: style.pointerEvents,
        });
      }
      const hit = document.elementFromPoint(x, y);
      const withinViewport = rect.width > 0 && rect.height > 0 && x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
      const exposureChainClear = chain.every((entry) => !entry.hidden && !entry.inert && !entry.aria_hidden
        && entry.display !== 'none' && entry.visibility !== 'hidden' && entry.visibility !== 'collapse'
        && Number.parseFloat(entry.opacity || '1') > 0);
      const pointerChainClear = chain.every((entry) => entry.pointer_events !== 'none');
      const hitTest = Boolean(hit && (hit === trigger || trigger.contains(hit)));
      window.__knowledgePointerTrace = [];
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        document.addEventListener(type, (event) => {
          window.__knowledgePointerTrace.push({
            type: event.type,
            trusted: event.isTrusted,
            target_id: event.target?.id || null,
            target_tag: event.target?.tagName?.toLowerCase() || null,
          });
        }, { capture: true, once: true });
      }
      return {
        trigger_id: trigger.id,
        scroll_into_view: true,
        geometry_stable: stableFrames >= 3,
        geometry_samples: geometrySamples,
        x,
        y,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        within_viewport: withinViewport,
        exposure_chain_clear: exposureChainClear,
        pointer_chain_clear: pointerChainClear,
        pointer_events: getComputedStyle(trigger).pointerEvents,
        hit_test: hitTest,
        hit_tag: hit?.tagName?.toLowerCase() ?? null,
        hit_id: hit?.id || null,
      };
    })()`, true);

    if (
      target?.error
      || !target?.geometry_stable
      || !target?.within_viewport
      || !target?.exposure_chain_clear
      || !target?.pointer_chain_clear
      || target?.pointer_events === 'none'
      || !target?.hit_test
    ) {
      throw new StyleContractError('ROUTE_POINTER_TARGET_INVALID', `Disclosure ${triggerId} ist kein echter Pointer-Treffer: ${JSON.stringify(target)}.`, EXIT.INTERNAL);
    }

    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: target.x, y: target.y, button: 'none', buttons: 0, pointerType: 'mouse' });
    const armedTarget = await runtimeValue(page, `(() => {
      const trigger = document.getElementById(${JSON.stringify(triggerId)});
      if (!trigger) return { error: 'trigger-missing-after-move' };
      const rect = trigger.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        hit_test: Boolean(hit && (hit === trigger || trigger.contains(hit))),
        hit_tag: hit?.tagName?.toLowerCase() ?? null,
        hit_id: hit?.id || null,
      };
    })()`);
    if (armedTarget?.error || !armedTarget?.hit_test || !(armedTarget?.rect?.width > 0) || !(armedTarget?.rect?.height > 0)) {
      throw new StyleContractError('ROUTE_POINTER_TARGET_INVALID', `Disclosure ${triggerId} verlor den Pointer-Treffer nach mouseMoved: ${JSON.stringify(armedTarget)}.`, EXIT.INTERNAL);
    }
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: armedTarget.x, y: armedTarget.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: armedTarget.x, y: armedTarget.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
    const expanded = await waitForDisclosureExpansion(page, triggerId, timeoutMs);
    const eventTrace = await runtimeValue(page, 'window.__knowledgePointerTrace ?? []');
    interactions.push({
      ...target,
      ...armedTarget,
      dispatched_via: 'CDP.Input.dispatchMouseEvent',
      event_trace: eventTrace,
      trusted_click: eventTrace.some((event) => event.type === 'click' && event.trusted === true),
      expanded: expanded.expanded,
      panel_hidden: expanded.panel_hidden,
      panel_exposed: expanded.panel_exposed,
    });
  }

  return interactions;
}

async function toggleMobileNavigation(page, expectedOpen, timeoutMs = 5_000) {
  const selector = 'body > #root nav button[aria-label="Menü öffnen"], body > #root nav button[aria-label="Menü schließen"]';
  const target = await runtimeValue(page, `(async () => {
    const trigger = document.querySelector(${JSON.stringify(selector)});
    if (!trigger) return { error: 'mobile-menu-trigger-missing' };
    let previousRect = null;
    let stableFrames = 0;
    let geometrySamples = 0;
    const geometryDeadline = performance.now() + 2500;
    while (stableFrames < 3 && performance.now() < geometryDeadline) {
      trigger.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 60));
      const sample = trigger.getBoundingClientRect();
      geometrySamples += 1;
      const stable = previousRect
        && Math.abs(sample.left - previousRect.left) < 0.25
        && Math.abs(sample.top - previousRect.top) < 0.25
        && Math.abs(sample.width - previousRect.width) < 0.25
        && Math.abs(sample.height - previousRect.height) < 0.25;
      stableFrames = stable ? stableFrames + 1 : 0;
      previousRect = { left: sample.left, top: sample.top, width: sample.width, height: sample.height };
    }
    const rect = trigger.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    const chain = [];
    for (let current = trigger; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      chain.push({
        hidden: current.hasAttribute('hidden'),
        inert: current.hasAttribute('inert'),
        aria_hidden: current.getAttribute('aria-hidden') === 'true',
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointer_events: style.pointerEvents,
      });
    }
    window.__knowledgeMobileNavPointerTrace = [];
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      document.addEventListener(type, (event) => {
        window.__knowledgeMobileNavPointerTrace.push({ type: event.type, trusted: event.isTrusted });
      }, { capture: true, once: true });
    }
    return {
      geometry_stable: stableFrames >= 3,
      geometry_samples: geometrySamples,
      x,
      y,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      within_viewport: rect.width > 0 && rect.height > 0 && x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
      exposure_chain_clear: chain.every((entry) => !entry.hidden && !entry.inert && !entry.aria_hidden
        && entry.display !== 'none' && entry.visibility !== 'hidden' && entry.visibility !== 'collapse'
        && Number.parseFloat(entry.opacity || '1') > 0),
      pointer_chain_clear: chain.every((entry) => entry.pointer_events !== 'none'),
      hit_test: Boolean(hit && (hit === trigger || trigger.contains(hit))),
    };
  })()`, true);
  if (target?.error || !target?.geometry_stable || !target?.within_viewport || !target?.exposure_chain_clear || !target?.pointer_chain_clear || !target?.hit_test) {
    throw new StyleContractError('ROUTE_MOBILE_NAV_POINTER_INVALID', `Mobile Navigation ist kein echter Pointer-Treffer: ${JSON.stringify(target)}.`, EXIT.INTERNAL);
  }
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: target.x, y: target.y, button: 'none', buttons: 0, pointerType: 'mouse' });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });

  const startedAt = Date.now();
  let menuState = null;
  while (Date.now() - startedAt < timeoutMs) {
    menuState = await runtimeValue(page, `(() => {
      const nav = document.querySelector('body > #root nav');
      const menu = nav ? Array.from(nav.children).find((child, index) => index > 0 && child.querySelector('a[href="/wissen"]')) : null;
      if (!menu) return { present: false, exposed: false, link_count: 0 };
      const rect = menu.getBoundingClientRect();
      const style = getComputedStyle(menu);
      return {
        present: true,
        exposed: style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0,
        link_count: menu.querySelectorAll('a').length,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      };
    })()`);
    if ((expectedOpen && menuState?.exposed && menuState.link_count > 0) || (!expectedOpen && menuState?.present === false)) break;
    await delay(75);
  }
  const eventTrace = await runtimeValue(page, 'window.__knowledgeMobileNavPointerTrace ?? []');
  const stateMatches = expectedOpen
    ? menuState?.exposed === true && menuState?.link_count > 0
    : menuState?.present === false;
  if (!stateMatches) {
    throw new StyleContractError('ROUTE_MOBILE_NAV_INTERACTION_FAILED', `Mobile Navigation erreichte den erwarteten Zustand nicht: ${JSON.stringify(menuState)}.`, EXIT.INTERNAL);
  }
  return {
    ...target,
    dispatched_via: 'CDP.Input.dispatchMouseEvent',
    trusted_click: eventTrace.some((event) => event.type === 'click' && event.trusted === true),
    expected_open: expectedOpen,
    menu: menuState,
    event_trace: eventTrace,
  };
}

const ROUTE_STATE_EXPRESSION = `(async () => {
  const round = (value) => Math.round(value * 1000) / 1000;
  const normalizeText = (value) => value?.normalize('NFC').replace(/\\u00a0/g, ' ').replace(/[\\p{White_Space}]+/gu, ' ').trim() ?? '';
  const normalizeUrl = (value) => {
    if (typeof value !== 'string' || !value || value !== value.trim()) return null;
    for (const character of value) {
      const codePoint = character.codePointAt(0);
      if (codePoint === undefined || codePoint <= 0x20 || (codePoint >= 0x7f && codePoint <= 0xa0)
        || codePoint === 0x1680 || (codePoint >= 0x2000 && codePoint <= 0x200f)
        || (codePoint >= 0x2028 && codePoint <= 0x202f) || codePoint === 0x205f
        || codePoint === 0x2060 || codePoint === 0x3000 || codePoint === 0xfeff || character === '\\\\') return null;
    }
    try {
      if (value.startsWith('/')) {
        const parsed = new URL(value, 'https://supplementstack.invalid');
        if (parsed.origin !== 'https://supplementstack.invalid') return null;
        return parsed.pathname + parsed.search + parsed.hash;
      }
      if (value.startsWith('//')) return new URL('https:' + value).href;
      const parsed = new URL(value);
      if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null;
      return parsed.href;
    } catch { return null; }
  };
  const exposureEntry = (element) => {
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      hidden: element.hasAttribute('hidden'),
      inert: element.hasAttribute('inert'),
      aria_hidden: element.getAttribute('aria-hidden') === 'true',
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      pointer_events: style.pointerEvents,
    };
  };
  const exposureEntryIsClear = (entry) => !entry.hidden && !entry.inert && !entry.aria_hidden
    && entry.display !== 'none' && entry.visibility !== 'hidden' && entry.visibility !== 'collapse'
    && Number.parseFloat(entry.opacity || '1') > 0;
  const inspect = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const exposureChain = [];
    for (let current = element; current; current = current.parentElement) exposureChain.push(exposureEntry(current));
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      hidden: element.hasAttribute('hidden'),
      inert: element.hasAttribute('inert'),
      aria_hidden: element.getAttribute('aria-hidden') === 'true',
      pointer_events: style.pointerEvents,
      position: style.position,
      font_family: style.fontFamily,
      font_size: style.fontSize,
      background_color: style.backgroundColor,
      border_radius: style.borderRadius,
      rect: { left: round(rect.left), top: round(rect.top), right: round(rect.right), bottom: round(rect.bottom), width: round(rect.width), height: round(rect.height) },
      exposure_chain: exposureChain,
      exposed: exposureChain.every(exposureEntryIsClear) && rect.width > 0 && rect.height > 0,
    };
  };
  const text = (selector, root = document) => normalizeText(root.querySelector(selector)?.textContent);
  const article = document.querySelector('article[data-testid="knowledge-magazine-article"], article[data-testid="knowledge-study-article"]');
  const layout = article?.querySelector('.layout') ?? null;
  const toc = article?.querySelector('aside[aria-label="Inhaltsverzeichnis"]') ?? null;
  const content = article?.querySelector('.content') ?? null;
  const primaryNav = document.querySelector('body > #root nav');
  const mobileMenuButton = primaryNav?.querySelector('button[aria-label="Menü öffnen"], button[aria-label="Menü schließen"]') ?? null;
  const directChildren = content ? Array.from(content.children) : [];
  const semanticLeaves = article ? Array.from(article.querySelectorAll('[data-knowledge-leaf], [data-knowledge-disclosure], [data-knowledge-table-presentation], [data-knowledge-ui]'))
    .filter((element) => !element.closest('.nice-mobile')) : [];
  const tocLinks = toc ? Array.from(toc.querySelectorAll('a')) : [];
  const figures = article ? Array.from(article.querySelectorAll('figure')) : [];
  const images = article ? Array.from(article.querySelectorAll('img')) : [];
  const sectionIdFor = (element) => element.closest('.content > section')?.id ?? (element.closest('.hero') ? 'hero' : null);
  const projectionLeafTypes = new Set(['dek', 'paragraph', 'list-item', 'subheading', 'control-heading', 'faq-question']);
  const projectionLeaves = article ? Array.from(article.querySelectorAll('[data-knowledge-leaf]'))
    .filter((element) => projectionLeafTypes.has(element.getAttribute('data-knowledge-leaf')) && !element.closest('.nice-mobile'))
    .map((element) => ({
      section_id: sectionIdFor(element),
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('data-knowledge-leaf'),
      text: normalizeText(element.textContent),
    })) : [];
  const projectionSections = directChildren.map((section) => {
    const id = section.id;
    const controlType = section.getAttribute('data-knowledge-control-block');
    const kind = id === 'ueberblick' ? 'overview'
      : id === 'quellen' ? 'sources'
        : controlType ? 'control'
          : section.classList.contains('fazit') ? 'fazit'
            : 'content';
    return {
      section_id: id,
      kind,
      control_type: controlType || null,
      heading: kind === 'sources' ? text('[data-knowledge-ui="sources-label"]', section) : text('h2', section),
      number: normalizeText(section.querySelector('.sec-head > .num')?.textContent) || null,
    };
  });
  const projectionToc = tocLinks.map((link) => ({
    label: normalizeText(link.textContent),
    href: link.getAttribute('href') ?? '',
  }));
  const projectionLinks = article ? Array.from(article.querySelectorAll('a[href]'))
    .filter((link) => !link.closest('.toc') && !link.closest('[data-projection-additive-navigation="true"]'))
    .map((link) => ({
      section_id: sectionIdFor(link),
      role: link.closest('#quellen') ? 'source' : 'content',
      tag: link.tagName.toLowerCase(),
      label: normalizeText(link.textContent),
      href: link.getAttribute('href') ?? '',
    })) : [];
  const tableContainers = article ? Array.from(article.querySelectorAll('[data-knowledge-table-presentation]')) : [];
  const projectionTables = tableContainers.map((container) => {
    const presentation = container.getAttribute('data-knowledge-table-presentation');
    if (presentation === 'food_grid') {
      return {
        section_id: sectionIdFor(container),
        presentation,
        headers: Array.from(container.querySelectorAll(':scope > [data-knowledge-table-header-row] > [role="columnheader"]')).map((cell) => normalizeText(cell.textContent)),
        rows: Array.from(container.querySelectorAll(':scope > [data-knowledge-table-row][role="row"]')).map((row) => Array.from(row.querySelectorAll(':scope > [role="cell"]')).map((cell) => normalizeText(cell.textContent))),
      };
    }
    const table = container.querySelector('table.nice');
    return {
      section_id: sectionIdFor(container),
      presentation,
      headers: table ? Array.from(table.querySelectorAll('thead th')).map((cell) => normalizeText(cell.textContent)) : [],
      rows: table ? Array.from(table.querySelectorAll('tbody tr')).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => normalizeText(cell.textContent))) : [],
    };
  });
  const projectionAssets = figures.map((figure) => {
    const image = figure.querySelector(':scope > img');
    return {
      section_id: sectionIdFor(figure),
      tag: image?.tagName.toLowerCase() ?? null,
      src: image?.getAttribute('src') ?? '',
      alt: image?.getAttribute('alt') ?? '',
      caption: normalizeText(figure.querySelector(':scope > figcaption')?.textContent),
    };
  });
  const projectionFaq = article ? Array.from(article.querySelectorAll('.faq-item')).map((item) => {
    const question = item.querySelector('.faq-q');
    return {
      section_id: sectionIdFor(item),
      question: {
        tag: question?.tagName.toLowerCase() ?? null,
        type: question?.getAttribute('data-knowledge-leaf') ?? null,
        text: normalizeText(question?.textContent),
      },
      answers: Array.from(item.querySelectorAll('.faq-a__in [data-knowledge-leaf]'))
        .filter((element) => projectionLeafTypes.has(element.getAttribute('data-knowledge-leaf')))
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute('data-knowledge-leaf'),
          text: normalizeText(element.textContent),
        })),
    };
  }) : [];
  const uiProjection = {
    eyebrow: text('[data-knowledge-ui="eyebrow"]', article ?? document),
    toc_title: text('[data-knowledge-ui="toc-title"]', article ?? document),
    ingredient_chip: text('[data-knowledge-ui="ingredient-chip"]', article ?? document),
    reviewed_date: text('[data-knowledge-ui="reviewed-date"]', article ?? document),
    reading_time: text('[data-knowledge-ui="reading-time"]', article ?? document),
    sources_label: text('[data-knowledge-ui="sources-label"]', article ?? document),
    sources_count: text('[data-knowledge-ui="sources-count"]', article ?? document),
  };
  const template = article?.getAttribute('data-template') ?? '';
  const releaseSectionElements = template === 'magazine'
    ? directChildren
    : article ? Array.from(article.querySelectorAll('[data-study-section]')) : [];
  const releaseSectionKind = (section) => {
    if (section.id === 'ueberblick') return { kind: 'overview', control_type: null };
    if (section.id === 'quellen' || section.getAttribute('data-study-kind') === 'sources') return { kind: 'sources', control_type: null };
    if (section.id === 'fazit' || section.classList.contains('fazit') || section.getAttribute('data-study-kind') === 'fazit') return { kind: 'fazit', control_type: null };
    const controlType = section.getAttribute('data-knowledge-control-block');
    if (controlType) return { kind: 'control', control_type: ['merkkasten', 'legal_notice'].includes(controlType) ? controlType : null };
    return { kind: 'content', control_type: null };
  };
  const releaseSectionHeading = (section, kind) => kind === 'sources'
    ? text('[data-knowledge-ui="sources-label"]', section)
    : text(template === 'magazine' ? '.sec-head h2, h2' : ':scope > h2', section);
  const semanticSectionText = (section) => {
    const clone = section.cloneNode(true);
    clone.querySelectorAll('.sec-head, .takeaways > h2, .callout-title, .src-toggle, .nice-mobile, [data-projection-duplicate="true"], [data-projection-additive-navigation="true"], .sr-only, .food-card .ic, .pm, svg, [aria-hidden="true"]')
      .forEach((element) => element.remove());
    if (template === 'study_article_v2') clone.querySelector(':scope > h2')?.remove();
    clone.querySelectorAll('p, li, h3, h4, th, td, tr, figcaption, [role="columnheader"], [role="cell"], .src-list__in > div, .faq-q')
      .forEach((element) => element.append(clone.ownerDocument.createTextNode(' ')));
    return normalizeText(clone.textContent);
  };
  const releaseSectionLinks = (section) => Array.from(section.querySelectorAll('a[href]'))
    .filter((link) => !link.closest('[data-projection-additive-navigation="true"]'))
    .map((link) => ({
      label: normalizeText(link.textContent),
      url: normalizeUrl(link.getAttribute('href')) ?? '',
    }));
  const releaseSectionTables = (section) => Array.from(section.querySelectorAll('[data-knowledge-table-presentation]'))
    .filter((container) => !container.closest('[data-projection-duplicate="true"]'))
    .map((container) => {
      const presentation = container.getAttribute('data-knowledge-table-presentation');
      if (presentation === 'food_grid') {
        return {
          presentation: 'food_grid',
          headers: Array.from(container.querySelectorAll(':scope > [data-knowledge-table-header-row] > [role="columnheader"]')).map((cell) => normalizeText(cell.textContent)),
          rows: Array.from(container.querySelectorAll(':scope > [data-knowledge-table-row][role="row"]')).map((row) => Array.from(row.querySelectorAll(':scope > [role="cell"]')).map((cell) => normalizeText(cell.textContent))),
        };
      }
      const table = container.querySelector('table.nice, table');
      return {
        presentation: 'data_table',
        headers: table ? Array.from(table.querySelectorAll('thead th')).map((cell) => normalizeText(cell.textContent)) : [],
        rows: table ? Array.from(table.querySelectorAll('tbody tr')).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => normalizeText(cell.textContent))) : [],
      };
    });
  const releaseSectionAssets = (section) => Array.from(section.querySelectorAll('figure')).flatMap((figure) => {
    const image = figure.querySelector('img');
    if (!image) return [];
    return [{
      src: normalizeUrl(image.getAttribute('src')) ?? '',
      alt: normalizeText(image.getAttribute('alt')),
      caption: normalizeText(figure.querySelector('figcaption')?.textContent),
    }];
  });
  const releaseSections = releaseSectionElements.map((section, order) => {
    const identity = releaseSectionKind(section);
    return {
      section_id: section.id,
      kind: identity.kind,
      control_type: identity.control_type,
      heading: releaseSectionHeading(section, identity.kind),
      order,
      number: normalizeText(section.querySelector('.sec-head > .num')?.textContent) || null,
      normalized_text: semanticSectionText(section),
      links: releaseSectionLinks(section),
      tables: releaseSectionTables(section),
      assets: releaseSectionAssets(section),
    };
  });
  const integerFromLabel = (label) => {
    const match = label.match(/\\b(\\d+)\\b/);
    return match ? Number.parseInt(match[1], 10) : -1;
  };
  const releaseUi = template === 'magazine' ? {
    contract_version: article?.getAttribute('data-ui-contract') ?? '',
    eyebrow: uiProjection.eyebrow,
    toc_title: uiProjection.toc_title,
    ingredient_chip: uiProjection.ingredient_chip,
    reviewed_date: uiProjection.reviewed_date || null,
    reading_time: { minutes: integerFromLabel(uiProjection.reading_time), label: uiProjection.reading_time },
    sources_label: uiProjection.sources_label,
    sources_count: { count: integerFromLabel(uiProjection.sources_count), label: uiProjection.sources_count },
  } : {
    contract_version: article?.getAttribute('data-ui-contract') ?? '',
    eyebrow: null,
    toc_title: null,
    ingredient_chip: uiProjection.ingredient_chip || null,
    reviewed_date: uiProjection.reviewed_date || null,
    reading_time: null,
    sources_label: uiProjection.sources_label,
    sources_count: { count: integerFromLabel(uiProjection.sources_count), label: uiProjection.sources_count },
  };
  const releaseToc = template === 'magazine' ? tocLinks.map((link) => ({
    section_id: (link.getAttribute('href') ?? '').replace(/^#/, ''),
    label: normalizeText(link.textContent),
    href: link.getAttribute('href') ?? '',
  })) : [];
  const sourceEntries = article ? Array.from(article.querySelectorAll('[data-source-id]')) : [];
  const releaseSources = sourceEntries.map((entry, order) => {
    const link = entry.querySelector('a.source-link');
    const labelElement = link?.querySelector('span:last-of-type') ?? entry.querySelector('.source-label') ?? link;
    return {
      source_id: entry.getAttribute('data-source-id') ?? '',
      label: normalizeText(labelElement?.textContent),
      url: normalizeUrl(link?.getAttribute('href')) ?? '',
      order,
    };
  });
  const releaseFazit = releaseSections.find((section) => section.kind === 'fazit');
  const releaseProjection = {
    schema: 'article_render_projection.v2',
    article_id: null,
    route: location.pathname,
    template,
    h1: text('h1', article ?? document),
    dek: text('[data-knowledge-ui="dek"]', article ?? document),
    ui: releaseUi,
    sections: releaseSections,
    toc: releaseToc,
    fazit: { section_id: releaseFazit?.section_id ?? '', normalized_text: releaseFazit?.normalized_text ?? '' },
    sources: releaseSources,
  };
  const canonicalElement = document.head.querySelector('link[rel="canonical"]');
  const canonicalUrl = canonicalElement?.href ?? '';
  const robots = normalizeText(document.head.querySelector('meta[name="robots"]')?.getAttribute('content'));
  const robotsTokens = robots.toLowerCase().split(',').map((token) => token.trim()).filter(Boolean);
  let jsonLd = null;
  let jsonLdParseError = null;
  const jsonLdElement = document.head.querySelector('script[data-knowledge-article-json-ld="true"][type="application/ld+json"]');
  try { jsonLd = jsonLdElement ? JSON.parse(jsonLdElement.textContent || '') : null; } catch (error) { jsonLdParseError = String(error); }
  const seo = {
    meta_title: normalizeText(document.title),
    meta_description: normalizeText(document.head.querySelector('meta[name="description"]')?.getAttribute('content')),
    canonical_url: canonicalUrl,
    canonical_path: (() => { try { return new URL(canonicalUrl).pathname; } catch { return ''; } })(),
    robots,
    indexable: robotsTokens.includes('index') && !robotsTokens.includes('noindex'),
    json_ld: jsonLd,
  };
  const releaseAssetUrls = [...new Set(releaseSections.flatMap((section) => section.assets.map((asset) => asset.src)).filter(Boolean))];
  const assetReadbacks = await Promise.all(releaseAssetUrls.map(async (src) => {
    try {
      const response = await fetch(new URL(src, location.origin).href, { cache: 'no-store' });
      if (!response.ok) return { src, byte_hash: null, error: 'HTTP ' + response.status };
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      return { src, byte_hash: 'sha256:' + hex, error: null };
    } catch (error) { return { src, byte_hash: null, error: String(error) }; }
  }));
  const disclosures = article ? Array.from(article.querySelectorAll('[data-knowledge-disclosure="trigger"]')).map((trigger) => {
    const panel = document.getElementById(trigger.getAttribute('aria-controls') || '');
    return {
      trigger_id: trigger.id,
      trigger: inspect(trigger),
      expanded: trigger.getAttribute('aria-expanded'),
      panel_id: panel?.id ?? null,
      panel_hidden: panel?.hasAttribute('hidden') ?? null,
      panel: inspect(panel),
      relation_back: panel?.getAttribute('aria-labelledby') ?? null,
      links: panel ? Array.from(panel.querySelectorAll('a')).map((link) => ({ label: normalizeText(link.textContent), href: link.getAttribute('href') ?? '', ...inspect(link) })) : [],
    };
  }) : [];
  const food = article?.querySelector('[data-knowledge-table-presentation="food_grid"]') ?? null;
  const responsiveTables = article ? Array.from(article.querySelectorAll('[data-knowledge-table-presentation]')).map((container) => ({
    presentation: container.getAttribute('data-knowledge-table-presentation'),
    container: inspect(container),
    desktop_table: inspect(container.querySelector('table.nice, table')),
    mobile_cards_container: inspect(container.querySelector('.nice-mobile, [data-projection-duplicate="true"]')),
    mobile_cards: Array.from(container.querySelectorAll('.nice-mobile-card, [data-testid="knowledge-table-mobile-card"]')).map(inspect),
    food_cards: Array.from(container.querySelectorAll('.food-card')).map(inspect),
  })) : [];
  const documentWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body?.scrollWidth ?? 0,
    document.documentElement.offsetWidth,
    document.body?.offsetWidth ?? 0,
  );
  return {
    route: location.pathname,
    public_api: window.__knowledgePublicApiReadback ?? null,
    harness_state: document.documentElement.dataset.knowledgeStyleContract ?? null,
    fixture_fetch_count: window.__knowledgeRouteFixture?.knowledgeFetchCount ?? 0,
    viewport: { width: innerWidth, height: innerHeight, device_scale_factor: devicePixelRatio },
    stylesheet_count: document.styleSheets.length,
    shell: {
      root: inspect(document.querySelector('#root')),
      primary_nav: inspect(primaryNav),
      mobile_menu_button: inspect(mobileMenuButton),
      footer: inspect(document.querySelector('body > #root footer')),
      back_link: inspect(Array.from(document.querySelectorAll('a[href="/wissen"]')).find((link) => !link.closest('nav')) ?? null),
    },
    document_metrics: {
      viewport_width: innerWidth,
      document_width: documentWidth,
      horizontal_overflow: documentWidth > innerWidth + 1,
    },
    article: inspect(article),
    template: article?.getAttribute('data-template') ?? null,
    ui_contract: article?.getAttribute('data-ui-contract') ?? null,
    magazine_green: article ? getComputedStyle(article).getPropertyValue('--km-green').trim() : '',
    h1: { text: text('h1', article ?? document), ...inspect(article?.querySelector('h1') ?? null) },
    dek: { text: text('[data-knowledge-ui="dek"]', article ?? document), ...inspect(article?.querySelector('[data-knowledge-ui="dek"]') ?? null) },
    ui: uiProjection,
    layout: { ...inspect(layout), grid_template_columns: layout ? getComputedStyle(layout).gridTemplateColumns : '' },
    toc: inspect(toc),
    content: inspect(content),
    direct_children: directChildren.map((element) => ({ tag: element.tagName.toLowerCase(), id: element.id, ...inspect(element) })),
    toc_links: tocLinks.map((link) => ({ label: normalizeText(link.textContent), href: link.getAttribute('href') ?? '', target_id: (link.getAttribute('href') ?? '').replace(/^#/, ''), ...inspect(link) })),
    semantic_leaves: semanticLeaves.map((element) => ({ tag: element.tagName.toLowerCase(), leaf: element.getAttribute('data-knowledge-leaf'), text: normalizeText(element.textContent).slice(0, 160), ...inspect(element) })),
    disclosures,
    controls: article ? Array.from(article.querySelectorAll('[data-knowledge-control-block]')).map((section) => ({ section_id: section.id, control_type: section.getAttribute('data-knowledge-control-block'), heading: text('h2', section), ...inspect(section) })) : [],
    images: images.map((image) => ({ src: image.getAttribute('src') ?? '', current_src: image.currentSrc, alt: image.getAttribute('alt') ?? '', complete: image.complete, natural_width: image.naturalWidth, natural_height: image.naturalHeight, figure_index: figures.findIndex((figure) => figure.contains(image)), caption: image.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ?? '', ...inspect(image) })),
    figures: figures.map((figure) => ({ image_count: figure.querySelectorAll(':scope > img').length, caption_count: figure.querySelectorAll(':scope > figcaption').length, ...inspect(figure) })),
    images_outside_figures: images.filter((image) => !image.closest('figure')).length,
    food: food ? {
      ...inspect(food),
      headers: Array.from(food.querySelectorAll(':scope > [data-knowledge-table-header-row] > [role="columnheader"]')).map((cell) => cell.textContent?.trim() ?? ''),
      rows: Array.from(food.querySelectorAll(':scope > [data-knowledge-table-row][role="row"]')).map((row) => Array.from(row.querySelectorAll(':scope > [role="cell"]')).map((cell) => cell.textContent?.trim() ?? '')),
    } : null,
    responsive_tables: responsiveTables,
    release_projection: releaseProjection,
    release_section_exposure: releaseSectionElements.map((section) => ({ section_id: section.id, ...inspect(section) })),
    seo,
    seo_diagnostics: { json_ld_parse_error: jsonLdParseError },
    asset_readbacks: assetReadbacks,
    projection: {
      template: article?.getAttribute('data-template') ?? null,
      ui_contract: article?.getAttribute('data-ui-contract') ?? null,
      h1: text('h1', article ?? document),
      dek: text('[data-knowledge-ui="dek"]', article ?? document),
      sections: projectionSections,
      leaves: projectionLeaves,
      toc: projectionToc,
      links: projectionLinks,
      tables: projectionTables,
      assets: projectionAssets,
      faq: projectionFaq,
      ui: uiProjection,
    },
  };
})()`;

function exposureEntryIsClear(entry) {
  return entry
    && entry.hidden === false
    && entry.inert === false
    && entry.aria_hidden === false
    && entry.display !== 'none'
    && entry.visibility !== 'hidden'
    && entry.visibility !== 'collapse'
    && Number.parseFloat(entry.opacity || '1') > 0;
}

function exposed(value) {
  return value?.exposed === true
    && value?.rect?.width > 0
    && value?.rect?.height > 0
    && Array.isArray(value?.exposure_chain)
    && value.exposure_chain.length > 0
    && value.exposure_chain.every(exposureEntryIsClear);
}

function addFailure(checks, errors, id, code, message, expected, actual) {
  checks.push({ id, result: 'FAIL', error_codes: [code] });
  errors.push({ code, message, ...(expected === undefined ? {} : { expected }), ...(actual === undefined ? {} : { actual }) });
}

function addPass(checks, id) {
  checks.push({ id, result: 'PASS', error_codes: [] });
}

function fixtureProjectionIsBound(fixture) {
  const expected = fixture?.expected;
  const projection = expected?.projection;
  const releaseProjection = expected?.release_projection;
  if (!projection || typeof projection !== 'object' || !releaseProjection || typeof releaseProjection !== 'object') return false;
  const projectedSources = Array.isArray(projection.links) ? projection.links
    .filter((link) => link.role === 'source')
    .map(({ label, href }) => ({ label, href })) : [];
  const fixtureSources = Array.isArray(fixture?.article?.sources) ? fixture.article.sources
    .map((source) => ({ label: source.label, href: source.url })) : [];
  const projectionSectionIds = Array.isArray(projection.sections) ? projection.sections.map((section) => section.section_id) : [];
  const projectionTocIds = Array.isArray(projection.toc) ? projection.toc.map((entry) => entry.href.replace(/^#/, '')) : [];
  const projectionFood = Array.isArray(projection.tables) ? projection.tables.find((table) => table.presentation === 'food_grid') : null;
  const projectionAsset = Array.isArray(projection.assets) ? projection.assets[0] : null;
  const ingredientNames = Array.isArray(fixture?.article?.ingredients) ? fixture.article.ingredients.map((ingredient) => ingredient.name).filter(Boolean) : [];
  return projection.template === expected.template
    && projection.ui_contract === expected.ui_contract
    && projection.h1 === fixture?.article?.title
    && projection.dek === fixture?.article?.summary
    && releaseProjection.route === fixture?.route
    && releaseProjection.h1 === fixture?.article?.title
    && releaseProjection.dek === fixture?.article?.summary
    && canonicalJsonHash(releaseProjection.sources) === canonicalJsonHash((fixture?.article?.sources ?? []).map((source, order) => ({ source_id: source.source_id, label: source.label, url: source.url, order })))
    && projection.ui?.ingredient_chip === `Wirkstoff: ${ingredientNames.join(', ') || 'Wissensartikel'}`
    && canonicalJsonHash(projectedSources) === canonicalJsonHash(fixtureSources)
    && canonicalJsonHash(projectionSectionIds) === canonicalJsonHash(expected.direct_section_ids)
    && canonicalJsonHash(projectionTocIds) === canonicalJsonHash(expected.toc_section_ids)
    && canonicalJsonHash(projectionFood?.headers) === canonicalJsonHash(expected.food_headers)
    && canonicalJsonHash(projectionFood?.rows) === canonicalJsonHash(expected.food_rows)
    && projectionAsset?.src === expected.image_src
    && projectionAsset?.alt === expected.image_alt
    && projectionAsset?.caption === expected.image_caption;
}

export function assessHydratedRouteState(state, fixture, viewportName = 'desktop') {
  const viewport = VIEWPORTS[viewportName];
  if (!viewport) throw new StyleContractError('STYLE_VIEWPORT_UNKNOWN', `Unbekannter Viewport: ${viewportName}.`, EXIT.INTERNAL);
  const expectedViewport = publicViewport(viewport);
  const isMobile = viewportName === 'mobile';
  const expected = fixture.expected;
  const checks = [];
  const errors = [];
  const probe = (id, code, message, condition, expectedValue, actualValue) => {
    if (condition) addPass(checks, id);
    else addFailure(checks, errors, id, code, message, expectedValue, actualValue);
  };

  probe('actual-route-and-fixture', 'ROUTE_IDENTITY_INVALID', 'Der Browser prüft nicht die kanonische echte Wissensroute mit injizierter Fetch-Fixture.',
    state?.route === fixture.route && state?.fixture_fetch_count >= 1 && state?.harness_state === 'ready',
    { route: fixture.route, fixture_fetch_min: 1, harness_state: 'ready' },
    { route: state?.route, fixture_fetch_count: state?.fixture_fetch_count, harness_state: state?.harness_state });
  probe('fixture-projection-binding', 'ROUTE_FIXTURE_PROJECTION_BINDING_INVALID', 'Die kanonische Fixture-Projektion bindet Artikel, Quellen, Sections, TOC, Tabellen, Assets oder UI nicht exakt.',
    fixtureProjectionIsBound(fixture), true, { article: fixture?.article, expected: fixture?.expected });
  probe('canonical-route-projection', 'ROUTE_PROJECTION_INVALID', 'Die hydrierte Route weicht in Text, Leaves, TOC, Links, Tabellen, Assets, FAQ oder UI von der kanonischen Fixture-Projektion ab.',
    canonicalJsonHash(state?.projection) === canonicalJsonHash(expected.projection), expected.projection, state?.projection);
  probe('release-route-projection', 'ROUTE_RELEASE_PROJECTION_INVALID', 'Der gemeinsame Public-Readback-DOM-Adapter weicht von der unabhängigen article_render_projection.v2-Fixture ab.',
    canonicalJsonHash(state?.release_projection) === canonicalJsonHash(expected.release_projection), expected.release_projection, state?.release_projection);
  probe('hydrated-app-shell', 'ROUTE_SHELL_INVALID', 'App, Layout, Wissensseite oder Rücknavigation sind auf der echten Route nicht sichtbar.',
    exposed(state?.shell?.root) && exposed(state?.shell?.primary_nav) && exposed(state?.shell?.footer) && exposed(state?.shell?.back_link) && exposed(state?.article),
    { all_exposed: true }, state?.shell);
  probe(`${viewportName}-viewport`, 'STYLE_VIEWPORT_INVALID', `Der Route-Vertrag lief nicht im kanonischen ${viewportName}-Viewport.`,
    canonicalJsonHash(state?.viewport) === canonicalJsonHash(expectedViewport), expectedViewport, state?.viewport);
  probe('productive-styles', 'STYLE_SHEET_MISSING', 'Produktive CSS-Variablen und Stylesheets sind auf der echten Route nicht wirksam.',
    Number.isInteger(state?.stylesheet_count) && state.stylesheet_count > 0 && Boolean(state?.magazine_green),
    { stylesheet_count_min: 1, magazine_green_nonempty: true },
    { stylesheet_count: state?.stylesheet_count, magazine_green: state?.magazine_green });
  probe('fixed-ui-contract', 'ROUTE_UI_CONTRACT_INVALID', 'Der versionierte UI-Vertrag stimmt nicht exakt.',
    state?.template === expected.template
      && state?.ui_contract === expected.ui_contract
      && state?.h1?.text === expected.h1
      && canonicalJsonHash(state?.ui) === canonicalJsonHash({
        eyebrow: expected.eyebrow,
        toc_title: expected.toc_title,
        ingredient_chip: expected.ingredient_chip,
        reviewed_date: expected.reviewed_date,
        reading_time: expected.reading_time,
        sources_label: expected.sources_label,
        sources_count: expected.sources_count,
      })
      && exposed(state?.h1),
    expected, { template: state?.template, ui_contract: state?.ui_contract, h1: state?.h1, ui: state?.ui });
  if (isMobile) {
    probe('mobile-responsive-layout', 'STYLE_MOBILE_LAYOUT_INVALID', 'Das Magazinlayout ist mobil nicht einspaltig oder das Desktop-TOC bleibt sichtbar.',
      exposed(state?.layout) && state.layout.display === 'block' && exposed(state?.content)
        && state?.toc?.display === 'none' && !exposed(state?.toc),
      { layout_display: 'block', content_exposed: true, toc_display: 'none' },
      { layout: state?.layout, toc: state?.toc, content: state?.content });
    probe('mobile-horizontal-overflow', 'STYLE_MOBILE_HORIZONTAL_OVERFLOW', 'Die Wissensroute erzeugt im kanonischen Mobile-Viewport horizontalen Seitenüberlauf.',
      state?.document_metrics?.horizontal_overflow === false
        && state?.document_metrics?.document_width <= state?.document_metrics?.viewport_width + 1,
      { horizontal_overflow: false, viewport_width: viewport.width }, state?.document_metrics);
    const mobileNavInteractions = Array.isArray(state?.mobile_nav_interactions) ? state.mobile_nav_interactions : [];
    probe('mobile-navigation-pointer', 'ROUTE_MOBILE_NAV_INVALID', 'Das responsive Hauptmenü wurde nicht per echtem Pointer geöffnet und wieder geschlossen.',
      exposed(state?.shell?.mobile_menu_button)
        && mobileNavInteractions.length === 2
        && mobileNavInteractions[0]?.expected_open === true
        && mobileNavInteractions[0]?.menu?.exposed === true
        && mobileNavInteractions[0]?.menu?.link_count > 0
        && mobileNavInteractions[0]?.trusted_click === true
        && mobileNavInteractions[1]?.expected_open === false
        && mobileNavInteractions[1]?.menu?.present === false
        && mobileNavInteractions[1]?.trusted_click === true,
      { pointer: true, sequence: ['open', 'close'], trusted: true }, mobileNavInteractions);
  } else {
    probe('desktop-layout', 'STYLE_LAYOUT_INVALID', 'Magazinlayout, TOC und Content bilden keine sichtbare zweispaltige Desktopstruktur.',
      exposed(state?.layout) && state.layout.display === 'grid'
        && state.layout.grid_template_columns.split(/\s+/).filter(Boolean).length >= 2
        && exposed(state?.toc) && state.toc.position === 'sticky' && exposed(state?.content)
        && state.toc.rect.right <= state.content.rect.left,
      { grid: true, toc_sticky_left_of_content: true }, { layout: state?.layout, toc: state?.toc, content: state?.content });
    probe('desktop-responsive-navigation', 'ROUTE_DESKTOP_NAV_INVALID', 'Desktop-Navigation oder Desktop-TOC sind nicht responsiv sichtbar.',
      exposed(state?.shell?.primary_nav) && !exposed(state?.shell?.mobile_menu_button) && exposed(state?.toc),
      { primary_nav_exposed: true, mobile_button_exposed: false, toc_exposed: true }, state?.shell);
  }
  const directIds = Array.isArray(state?.direct_children) ? state.direct_children.map((entry) => entry.id) : [];
  const invalidDirectChildren = Array.isArray(state?.direct_children) ? state.direct_children.filter((entry) => entry.tag !== 'section' || !exposed(entry)) : [];
  probe('closed-content-children', 'ROUTE_CONTENT_CHILDREN_INVALID', 'Direkte Content-Kinder entsprechen nicht exakt den kanonischen Sections.',
    canonicalJsonHash(directIds) === canonicalJsonHash(expected.direct_section_ids) && invalidDirectChildren.length === 0,
    expected.direct_section_ids, { ids: directIds, invalid: invalidDirectChildren });
  const tocIds = Array.isArray(state?.toc_links) ? state.toc_links.map((entry) => entry.target_id) : [];
  const invalidToc = Array.isArray(state?.toc_links) ? state.toc_links.filter((entry) => !documentSafeTarget(expected.direct_section_ids, entry.target_id) || (!isMobile && !exposed(entry))) : [];
  probe('toc-links-and-geometry', 'ROUTE_TOC_INVALID', 'TOC-Links, Ziele, Reihenfolge oder responsive Sichtbarkeit sind nicht exakt.',
    canonicalJsonHash(tocIds) === canonicalJsonHash(expected.toc_section_ids) && invalidToc.length === 0
      && (isMobile ? state.toc_links.every((entry) => !exposed(entry)) : true),
    { ids: expected.toc_section_ids, exposed: !isMobile }, { ids: tocIds, invalid: invalidToc, links: state?.toc_links });
  if (!isMobile) {
    const hiddenLeaves = Array.isArray(state?.semantic_leaves) ? state.semantic_leaves.filter((leaf) => !exposed(leaf)) : [];
    probe('semantic-leaf-exposure', 'ROUTE_SEMANTIC_LEAF_INVALID', 'Ein erwartetes semantisches Blatt ist per DOM- oder Computed-Style verborgen.',
      Array.isArray(state?.semantic_leaves) && state.semantic_leaves.length > 0 && hiddenLeaves.length === 0,
      { min_count: 1, all_exposed: true }, { count: state?.semantic_leaves?.length ?? 0, hidden: hiddenLeaves });
  }
  const invalidDisclosures = Array.isArray(state?.disclosures) ? state.disclosures.filter((entry) => (
    !exposed(entry.trigger) || entry.expanded !== 'true' || entry.panel_hidden !== false || !exposed(entry.panel)
    || entry.relation_back !== entry.trigger_id
  )) : [];
  const pointerInteractions = Array.isArray(state?.pointer_interactions) ? state.pointer_interactions : [];
  const invalidPointerInteractions = pointerInteractions.filter((entry) => (
    entry.dispatched_via !== 'CDP.Input.dispatchMouseEvent'
    || entry.scroll_into_view !== true
    || entry.geometry_stable !== true
    || entry.within_viewport !== true
    || entry.exposure_chain_clear !== true
    || entry.pointer_chain_clear !== true
    || entry.pointer_events === 'none'
    || entry.hit_test !== true
    || entry.trusted_click !== true
    || entry.expanded !== true
    || entry.panel_hidden !== false
    || entry.panel_exposed !== true
    || !(entry.rect?.width > 0)
    || !(entry.rect?.height > 0)
  ));
  const disclosureTriggerIds = Array.isArray(state?.disclosures) ? state.disclosures.map((entry) => entry.trigger_id) : [];
  const pointerTriggerIds = pointerInteractions.map((entry) => entry.trigger_id);
  probe('cdp-pointer-interactions', 'ROUTE_POINTER_INTERACTION_INVALID', 'FAQ und Quellen wurden nicht per geometrisch verifiziertem echtem CDP-Pointer-Input geöffnet.',
    pointerInteractions.length === expected.faq_count + 1
      && canonicalJsonHash(pointerTriggerIds) === canonicalJsonHash(disclosureTriggerIds)
      && invalidPointerInteractions.length === 0,
    { trigger_ids: disclosureTriggerIds, method: 'CDP.Input.dispatchMouseEvent', all_pointer_checks: true },
    { interactions: pointerInteractions, invalid: invalidPointerInteractions });
  probe('hydrated-disclosures', 'ROUTE_DISCLOSURE_INVALID', 'FAQ-/Quellen-Disclosure wurde nicht echt hydriert, geöffnet oder geometrisch sichtbar.',
    state?.disclosures?.length === expected.faq_count + 1 && invalidDisclosures.length === 0,
    { count: expected.faq_count + 1, all_expanded_and_exposed: true }, { disclosures: state?.disclosures, invalid: invalidDisclosures });
  const controls = Array.isArray(state?.controls) ? state.controls.map(({ section_id, control_type, heading }) => ({ section_id, control_type, heading })) : [];
  probe('control-blocks', 'ROUTE_CONTROL_BLOCK_INVALID', 'Merkkasten und Rechtlicher Hinweis bleiben nicht als exakte sichtbare Kontrollblöcke erhalten.',
    canonicalJsonHash(controls) === canonicalJsonHash(expected.control_blocks) && state.controls.every(exposed),
    expected.control_blocks, state?.controls);
  const invalidImages = Array.isArray(state?.images) ? state.images.filter((image) => (
    !exposed(image) || !image.complete || image.natural_width <= 0 || image.natural_height <= 0 || image.figure_index < 0
    || image.src !== expected.image_src || image.alt !== expected.image_alt || image.caption !== expected.image_caption
  )) : [];
  const invalidFigures = Array.isArray(state?.figures) ? state.figures.filter((figure) => !exposed(figure) || figure.image_count !== 1 || figure.caption_count !== 1) : [];
  probe('loaded-image-inventory', 'ROUTE_IMAGE_INVALID', 'Artikelbilder sind nicht vollständig geladen oder verlieren Figure, Asset, Alt-Text oder Caption.',
    state?.images?.length === expected.image_count && state?.figures?.length === expected.image_count
      && state?.images_outside_figures === 0 && invalidImages.length === 0 && invalidFigures.length === 0,
    { count: expected.image_count, src: expected.image_src, alt: expected.image_alt, caption: expected.image_caption, loaded: true },
    { images: state?.images, figures: state?.figures, images_outside_figures: state?.images_outside_figures });
  probe('food-grid-tuples', 'ROUTE_FOOD_GRID_INVALID', 'Food-grid verliert Header, Zellen, Reihenfolge oder zugängliche Geometrie.',
    exposed(state?.food) && canonicalJsonHash(state.food.headers) === canonicalJsonHash(expected.food_headers) && canonicalJsonHash(state.food.rows) === canonicalJsonHash(expected.food_rows),
    { headers: expected.food_headers, rows: expected.food_rows, exposed: true }, state?.food);
  const responsiveTables = Array.isArray(state?.responsive_tables) ? state.responsive_tables : [];
  const invalidResponsiveTables = responsiveTables.filter((table) => {
    if (!exposed(table.container)) return true;
    if (table.presentation === 'data_table') {
      return isMobile
        ? exposed(table.desktop_table) || !exposed(table.mobile_cards_container) || table.mobile_cards.length === 0 || table.mobile_cards.some((card) => !exposed(card))
        : !exposed(table.desktop_table) || exposed(table.mobile_cards_container);
    }
    return table.presentation !== 'food_grid' || table.food_cards.length === 0 || table.food_cards.some((card) => !exposed(card));
  });
  probe(`${viewportName}-responsive-tables`, 'ROUTE_RESPONSIVE_TABLE_INVALID', 'Datentabellen oder Karten besitzen im aktiven Viewport keine sichtbare responsive Darstellung.',
    responsiveTables.length >= 2 && invalidResponsiveTables.length === 0,
    { data_table_and_food_grid: true, responsive_representation_exposed: true },
    { tables: responsiveTables, invalid: invalidResponsiveTables });
  return { checks, errors, result: errors.length === 0 ? 'PASS' : 'FAIL' };
}

function sameHashSet(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && canonicalJsonHash([...left].sort()) === canonicalJsonHash([...right].sort());
}

function projectionInternalLinks(projection) {
  return (projection?.sections ?? []).flatMap((section) => (section.links ?? [])
    .filter((link) => typeof link.url === 'string' && link.url.startsWith('/wissen/'))
    .map((link) => ({ section_id: section.section_id, label: link.label, url: link.url })));
}

function publicReviewedDateLabel(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return `Geprüft am ${new Intl.DateTimeFormat('de-DE', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(parsed)}`;
}

function publicApiProjectionMatches(state, expected, releaseHash) {
  const capture = state?.public_api;
  const article = capture?.payload?.article;
  if (!HASH_PATTERN.test(releaseHash ?? '')) return false;
  let expectedRequestUrl;
  try {
    expectedRequestUrl = new URL(`/api/knowledge/${encodeURIComponent(expected.slug)}`, expected.public_url);
    expectedRequestUrl.searchParams.set('cfcheck', releaseHash);
  } catch {
    return false;
  }
  if (capture?.request_url !== expectedRequestUrl.href) return false;
  if (capture?.status !== 200 || !article || article.slug !== expected.slug) return false;
  if (!Number.isFinite(Date.parse(article.created_at)) || !Number.isFinite(Date.parse(article.updated_at))) return false;
  if (article.published_at !== article.created_at || article.modified_at !== article.updated_at) return false;
  if (article.published_at !== expected.expected_seo.json_ld?.datePublished
    || article.modified_at !== expected.expected_seo.json_ld?.dateModified
    || Date.parse(article.modified_at) < Date.parse(article.published_at)) return false;
  const ingredients = Array.isArray(article.ingredients) ? article.ingredients : [];
  if (ingredients.length !== 1 || !Number.isInteger(ingredients[0]?.ingredient_id) || ingredients[0].ingredient_id <= 0) return false;
  const ingredientName = typeof ingredients[0]?.name === 'string' ? ingredients[0].name.trim() : '';
  if (!ingredientName) return false;
  const expectedPrefix = expected.stage === 'stage3' ? 'Wirkstoff' : 'Wirkstoffe';
  if (expected.expected_projection.ui?.ingredient_chip !== `${expectedPrefix}: ${ingredientName}`) return false;
  if (publicReviewedDateLabel(article.reviewed_at) !== expected.expected_projection.ui?.reviewed_date) return false;
  if (article.featured_image_url !== null || article.featured_image_r2_key !== null) return false;
  if (expected.stage === 'stage3') return article.article_layer === 'main_article';
  return article.article_layer === 'single_study'
    && article.dose_min === null
    && article.dose_max === null
    && article.dose_unit === null
    && article.product_note === null;
}

function publicResponsiveStateMatches(state, expected, viewportName) {
  const responsiveTables = Array.isArray(state?.responsive_tables) ? state.responsive_tables : [];
  if (expected.stage === 'stage2') {
    const baseMatch = exposed(state?.article)
      && state?.document_metrics?.horizontal_overflow === false
      && state?.document_metrics?.document_width <= state?.document_metrics?.viewport_width + 1
      && (state?.images ?? []).every(exposed)
      && responsiveTables.every((table) => exposed(table.container));
    if (!baseMatch) return false;
    if (viewportName === 'desktop') {
      return responsiveTables.every((table) => table.presentation === 'data_table'
        && exposed(table.desktop_table)
        && !exposed(table.mobile_cards_container));
    }
    return responsiveTables.every((table) => table.presentation === 'data_table'
      && !exposed(table.desktop_table)
      && exposed(table.mobile_cards_container)
      && table.mobile_cards.length > 0
      && table.mobile_cards.every(exposed));
  }
  if (viewportName === 'desktop') {
    return exposed(state?.layout)
      && state.layout.display === 'grid'
      && exposed(state?.toc)
      && responsiveTables.every((table) => table.presentation === 'data_table'
        ? exposed(table.desktop_table) && !exposed(table.mobile_cards_container)
        : table.food_cards.length > 0 && table.food_cards.every(exposed));
  }
  return exposed(state?.layout)
    && state.layout.display === 'block'
    && state?.toc?.display === 'none'
    && !exposed(state?.toc)
    && state?.document_metrics?.horizontal_overflow === false
    && state?.document_metrics?.document_width <= state?.document_metrics?.viewport_width + 1
    && responsiveTables.every((table) => table.presentation === 'data_table'
      ? !exposed(table.desktop_table)
        && exposed(table.mobile_cards_container)
        && table.mobile_cards.length > 0
        && table.mobile_cards.every(exposed)
      : table.food_cards.length > 0 && table.food_cards.every(exposed))
    && (state?.images ?? []).every(exposed)
    && (state?.controls ?? []).every(exposed);
}

export function assessPublicRouteState(state, expected, viewportName = 'desktop', releaseHash = null) {
  if (!VIEWPORTS[viewportName]) throw new StyleContractError('STYLE_VIEWPORT_UNKNOWN', `Unbekannter Viewport: ${viewportName}.`, EXIT.INTERNAL);
  const isMobile = viewportName === 'mobile';
  const projection = state?.release_projection;
  const seo = state?.seo;
  const actualAssetHashes = (state?.asset_readbacks ?? []).map((asset) => asset.byte_hash).filter(Boolean);
  const assetReadbackFailed = (state?.asset_readbacks ?? []).some((asset) => asset.error || !HASH_PATTERN.test(asset.byte_hash ?? ''));
  const exposureBySection = new Map((state?.release_section_exposure ?? []).map((section) => [section.section_id, section]));
  const expectedControls = (expected.expected_projection.sections ?? []).filter((section) => section.kind === 'control');
  const actualControls = (projection?.sections ?? []).filter((section) => section.kind === 'control');
  const expectedAssets = (expected.expected_projection.sections ?? []).flatMap((section) => section.assets ?? []);
  const actualAssets = (projection?.sections ?? []).flatMap((section) => section.assets ?? []);
  const expectedSourceSection = (expected.expected_projection.sections ?? []).find((section) => section.kind === 'sources');
  const actualSourceSection = (projection?.sections ?? []).find((section) => section.kind === 'sources');
  const expectedFazit = (expected.expected_projection.sections ?? []).find((section) => section.kind === 'fazit');
  const actualFazit = (projection?.sections ?? []).find((section) => section.kind === 'fazit');
  const conditions = {
    assets: canonicalJsonHash(actualAssets) === canonicalJsonHash(expectedAssets)
      && !assetReadbackFailed && sameHashSet(actualAssetHashes, expected.asset_hashes),
    canonical: seo?.canonical_url === expected.expected_seo.canonical_url
      && seo?.canonical_path === expected.expected_seo.canonical_path,
    controls: canonicalJsonHash(actualControls) === canonicalJsonHash(expectedControls)
      && actualControls.every((section) => exposed(exposureBySection.get(section.section_id))),
    fazit: canonicalJsonHash(projection?.fazit) === canonicalJsonHash(expected.expected_projection.fazit)
      && canonicalJsonHash(actualFazit) === canonicalJsonHash(expectedFazit)
      && exposed(exposureBySection.get(actualFazit?.section_id)),
    h1_dek: projection?.h1 === expected.expected_projection.h1
      && projection?.dek === expected.expected_projection.dek
      && seo?.meta_title === expected.expected_seo.meta_title
      && seo?.meta_description === expected.expected_seo.meta_description
      && exposed(state?.h1) && exposed(state?.dek),
    indexability: seo?.indexable === expected.expected_seo.indexable,
    internal_links: canonicalJsonHash(projectionInternalLinks(projection)) === canonicalJsonHash(projectionInternalLinks(expected.expected_projection)),
    json_ld: state?.seo_diagnostics?.json_ld_parse_error === null
      && canonicalJsonHash(seo?.json_ld) === canonicalJsonHash(expected.expected_seo.json_ld),
    left_navigation: isMobile ? state?.toc?.display === 'none' && !exposed(state?.toc) : exposed(state?.toc),
    projection: state?.route === expected.expected_projection.route
      && state?.fixture_fetch_count === 0
      && publicApiProjectionMatches(state, expected, releaseHash)
      && canonicalJsonHash(projection) === expected.projection_hash,
    robots: seo?.robots === expected.expected_seo.robots,
    sources: canonicalJsonHash(projection?.sources) === canonicalJsonHash(expected.expected_projection.sources)
      && canonicalJsonHash(actualSourceSection) === canonicalJsonHash(expectedSourceSection)
      && exposed(exposureBySection.get(actualSourceSection?.section_id)),
    toc: canonicalJsonHash(projection?.toc) === canonicalJsonHash(expected.expected_projection.toc)
      && Array.isArray(state?.toc_links) && state.toc_links.every((entry) => isMobile ? !exposed(entry) : exposed(entry)),
    ui: canonicalJsonHash(projection?.ui) === canonicalJsonHash(expected.expected_projection.ui),
  };
  const responsiveMatch = publicResponsiveStateMatches(state, expected, viewportName);
  const checked = [...expected.required_checks, 'responsive_layout'];
  const mismatches = [
    ...expected.required_checks.filter((check) => conditions[check] !== true),
    ...(responsiveMatch ? [] : ['responsive_layout']),
  ];
  const seoMatch = ['canonical', 'h1_dek', 'indexability', 'json_ld', 'robots']
    .every((check) => !expected.required_checks.includes(check) || conditions[check] === true);
  return {
    projection,
    projection_hash: canonicalJsonHash(projection),
    seo,
    seo_hash: canonicalJsonHash(seo),
    asset_hashes: actualAssetHashes,
    checked,
    mismatches,
    seo_match: seoMatch ? 'MATCH' : 'MISMATCH',
    result: mismatches.length === 0 ? 'MATCH' : 'MISMATCH',
  };
}

function documentSafeTarget(expectedIds, targetId) {
  return typeof targetId === 'string' && expectedIds.includes(targetId);
}

function robotsRuleMatches(pathname, pattern) {
  if (!pattern) return false;
  const anchored = pattern.endsWith('$');
  const rawPattern = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = rawPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  try {
    return new RegExp(`^${escaped}${anchored ? '$' : ''}`).test(pathname);
  } catch {
    return false;
  }
}

export function interpretRobotsTxt(body, articleUrl, userAgent = CRAWLER_USER_AGENT) {
  const groups = [];
  let group = null;
  let groupHasRules = false;
  for (const rawLine of String(body ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) {
      if (groupHasRules) {
        group = null;
        groupHasRules = false;
      }
      continue;
    }
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (directive === 'user-agent') {
      if (!group || groupHasRules) {
        group = { agents: [], rules: [] };
        groups.push(group);
        groupHasRules = false;
      }
      group.agents.push(value.toLowerCase());
      continue;
    }
    if ((directive === 'allow' || directive === 'disallow') && group) {
      group.rules.push({ directive, value });
      groupHasRules = true;
    }
  }

  const normalizedUserAgent = userAgent.toLowerCase();
  const candidates = groups.flatMap((candidate) => candidate.agents
    .filter((agent) => agent === '*' || normalizedUserAgent.includes(agent))
    .map((agent) => ({ group: candidate, specificity: agent === '*' ? 0 : agent.length })));
  if (candidates.length === 0) return { global_rule: 'ALLOW', matched_rule: null };
  const specificity = Math.max(...candidates.map((candidate) => candidate.specificity));
  const selectedGroups = [...new Set(candidates.filter((candidate) => candidate.specificity === specificity).map((candidate) => candidate.group))];
  const pathname = new URL(articleUrl).pathname;
  const matchingRules = selectedGroups
    .flatMap((candidate) => candidate.rules)
    .filter((rule) => rule.value && robotsRuleMatches(pathname, rule.value))
    .sort((left, right) => right.value.replace(/[*$]/g, '').length - left.value.replace(/[*$]/g, '').length
      || (left.directive === 'allow' ? -1 : 1));
  if (matchingRules.length === 0) return { global_rule: 'ALLOW', matched_rule: null };
  const matched = matchingRules[0];
  return {
    global_rule: matched.directive === 'disallow' ? 'DISALLOW' : 'ALLOW',
    matched_rule: `${matched.directive === 'disallow' ? 'Disallow' : 'Allow'}: ${matched.value}`,
  };
}

function sha256Bytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function fetchReadbackResource(url) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': `${CRAWLER_USER_AGENT} SupplementStack-PublicReadback/2.2` },
      redirect: 'follow',
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      url,
      fetch_status: response.ok ? 'FETCHED' : ([404, 410].includes(response.status) ? 'NOT_FOUND' : 'HTTP_ERROR'),
      http_status: response.status,
      content_type: response.headers.get('content-type'),
      body_hash: sha256Bytes(bytes),
      body: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
    };
  } catch {
    return {
      url,
      fetch_status: 'NETWORK_ERROR',
      http_status: null,
      content_type: null,
      body_hash: null,
      body: '',
    };
  }
}

function normalizedDocumentText(value) {
  return String(value ?? '').normalize('NFC').replace(/\u00a0/g, ' ').replace(/[\p{White_Space}]+/gu, ' ').trim();
}

function articleJsonLdDocuments(document) {
  const values = [];
  for (const element of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(element.textContent || '');
      values.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {}
  }
  return values.flatMap((value) => Array.isArray(value?.['@graph']) ? value['@graph'] : [value])
    .filter((value) => value && (value['@type'] === 'Article' || (Array.isArray(value['@type']) && value['@type'].includes('Article'))));
}

export function assessRawHtmlReadback(readback, expected) {
  const fetchStatus = readback.fetch_status === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : 'FETCHED';
  const httpStatus = fetchStatus === 'NETWORK_ERROR' ? null : (Number.isInteger(readback.http_status) ? readback.http_status : null);
  const contentType = fetchStatus === 'NETWORK_ERROR' ? null : (readback.content_type ?? null);
  const bodyHash = fetchStatus === 'NETWORK_ERROR' ? null : (readback.body_hash ?? null);
  const htmlTransportMatches = fetchStatus === 'FETCHED'
    && httpStatus === 200
    && String(contentType ?? '').split(';')[0].trim().toLowerCase() === 'text/html'
    && HASH_PATTERN.test(bodyHash ?? '');
  let document = null;
  if (htmlTransportMatches) {
    try { document = new JSDOM(readback.body, { url: readback.url }).window.document; } catch {}
  }
  const rawText = normalizedDocumentText(document?.body?.textContent);
  const expectedTextSegments = [
    expected.expected_projection.h1,
    expected.expected_projection.dek,
    ...(expected.expected_projection.sections ?? []).map((section) => section.normalized_text),
  ].map(normalizedDocumentText).filter(Boolean);
  const titleMatch = normalizedDocumentText(document?.title) === normalizedDocumentText(expected.expected_seo.meta_title);
  const articleTextMatch = Boolean(document) && expectedTextSegments.every((segment) => rawText.includes(segment));
  const articleJsonLdMatch = Boolean(document) && articleJsonLdDocuments(document)
    .some((value) => canonicalJsonHash(value) === canonicalJsonHash(expected.expected_seo.json_ld));
  const seoDeliveryState = htmlTransportMatches && titleMatch && articleTextMatch && articleJsonLdMatch
    ? 'RAW_HTML_MATCH'
    : 'CLIENT_RENDERED_ONLY';
  return {
    url: readback.url,
    fetch_status: fetchStatus,
    http_status: httpStatus,
    content_type: contentType,
    body_hash: bodyHash,
    title_match: titleMatch,
    article_text_match: articleTextMatch,
    article_json_ld_match: articleJsonLdMatch,
    seo_delivery_state: seoDeliveryState,
  };
}

function sitemapUrlFromRobots(readback, origin) {
  if (readback.fetch_status === 'FETCHED') {
    for (const line of readback.body.split(/\r?\n/)) {
      const match = /^\s*sitemap\s*:\s*(\S+)\s*$/i.exec(line.replace(/#.*$/, ''));
      if (!match) continue;
      try {
        const candidate = new URL(match[1], origin);
        if (candidate.origin === origin) return candidate.href;
      } catch {}
    }
  }
  return new URL('/sitemap.xml', origin).href;
}

async function fetchSitemapDiscovery(origin, robotsReadback) {
  const sitemapUrl = sitemapUrlFromRobots(robotsReadback, origin);
  const readback = await fetchReadbackResource(sitemapUrl);
  return {
    discovery_url: robotsReadback.url,
    sitemap_url: sitemapUrl,
    fetch_status: readback.fetch_status,
    http_status: readback.http_status,
    body_hash: readback.body_hash,
    body: readback.body,
  };
}

function sitemapLocations(body, sitemapUrl) {
  try {
    const document = new JSDOM(body, { contentType: 'text/xml', url: sitemapUrl }).window.document;
    return [...document.querySelectorAll('loc')].map((element) => normalizedDocumentText(element.textContent)).filter(Boolean);
  } catch {
    return [];
  }
}

export function buildSitemapReceipt(discovery, articleUrl) {
  const locations = discovery.fetch_status === 'FETCHED' && discovery.http_status === 200
    ? sitemapLocations(discovery.body, discovery.sitemap_url)
    : [];
  const articleUrlMatch = locations.some((location) => {
    try { return new URL(location).href === new URL(articleUrl).href; } catch { return false; }
  });
  return {
    state: discovery.fetch_status === 'FETCHED' && discovery.http_status === 200
      ? (articleUrlMatch ? 'INCLUDED' : 'NOT_INCLUDED')
      : 'NOT_AVAILABLE',
    discovery_url: discovery.discovery_url,
    sitemap_url: discovery.sitemap_url,
    fetch_status: discovery.fetch_status,
    http_status: discovery.http_status,
    body_hash: discovery.body_hash,
    article_url_match: articleUrlMatch,
  };
}

export async function buildDeploymentFingerprint(rawReadback, origin) {
  const normalizedOrigin = new URL(origin).origin;
  let urls = [];
  if (rawReadback.fetch_status === 'FETCHED' && rawReadback.http_status === 200) {
    try {
      const document = new JSDOM(rawReadback.body, { url: rawReadback.url }).window.document;
      urls = [
        ...[...document.querySelectorAll('script[src]')].map((element) => element.getAttribute('src')),
        ...[...document.querySelectorAll('link[rel~="stylesheet"][href]')].map((element) => element.getAttribute('href')),
      ].flatMap((value) => {
        try {
          const url = new URL(value, rawReadback.url);
          return url.origin === normalizedOrigin ? [url.href] : [];
        } catch { return []; }
      });
    } catch {}
  }
  const delivered = await Promise.all([...new Set(urls)].sort().map(async (url) => {
    const result = await fetchReadbackResource(url);
    return result.fetch_status === 'FETCHED' && result.http_status === 200 && HASH_PATTERN.test(result.body_hash ?? '')
      ? { url, body_hash: result.body_hash }
      : null;
  }));
  const assets = delivered.filter(Boolean).sort((left, right) => left.url.localeCompare(right.url));
  const base = {
    representative_url: rawReadback.url,
    raw_html_body_hash: rawReadback.body_hash,
    assets,
  };
  return { ...base, fingerprint: canonicalJsonHash(base) };
}

export function buildRobotsReceipt(readback, articleUrl, userAgent = CRAWLER_USER_AGENT) {
  let interpreted;
  if (readback.fetch_status === 'FETCHED') {
    interpreted = interpretRobotsTxt(readback.body, articleUrl, userAgent);
  } else if (readback.fetch_status === 'NOT_FOUND') {
    interpreted = { global_rule: 'ALLOW', matched_rule: null };
  } else {
    interpreted = { global_rule: 'UNKNOWN', matched_rule: null };
  }
  return {
    url: readback.url,
    fetch_status: readback.fetch_status,
    http_status: readback.http_status,
    body_hash: readback.body_hash,
    user_agent: userAgent,
    global_rule: interpreted.global_rule,
    matched_rule: interpreted.matched_rule,
  };
}

export function deriveIndexabilityState(seo, robotsTxt) {
  if (seo?.indexable !== true) return 'BLOCKED_BY_PAGE_META';
  return deriveOriginIndexabilityState(robotsTxt);
}

export function deriveOriginIndexabilityState(robotsTxt) {
  if (robotsTxt.global_rule === 'DISALLOW') return 'BLOCKED_BY_SITE_POLICY';
  if (robotsTxt.global_rule === 'ALLOW') return 'INDEXABLE';
  if (robotsTxt.fetch_status === 'HTTP_ERROR') return 'BLOCKED_BY_HTTP';
  return 'UNKNOWN';
}

async function prepareOriginReadback(origin, articles, releaseHash) {
  const representative = articles[0];
  const robotsReadback = await fetchReadbackResource(new URL('/robots.txt', origin).href);
  const robotsTxt = buildRobotsReceipt(robotsReadback, representative.public_url);
  const rawByArticleId = new Map();
  for (const article of articles) {
    const rawUrl = new URL(article.public_url);
    rawUrl.searchParams.set('cfcheck', releaseHash);
    const readback = await fetchReadbackResource(rawUrl.href);
    rawByArticleId.set(article.article_id, { readback, receipt: assessRawHtmlReadback(readback, article) });
  }
  const sitemapDiscovery = await fetchSitemapDiscovery(origin, robotsReadback);
  const representativeRaw = rawByArticleId.get(representative.article_id);
  const deploymentFingerprint = await buildDeploymentFingerprint(representativeRaw.readback, origin);
  const publicSitemapDiscovery = {
    discovery_url: sitemapDiscovery.discovery_url,
    sitemap_url: sitemapDiscovery.sitemap_url,
    fetch_status: sitemapDiscovery.fetch_status,
    http_status: sitemapDiscovery.http_status,
    body_hash: sitemapDiscovery.body_hash,
  };
  const indexabilityState = deriveOriginIndexabilityState(robotsTxt);
  const sitePolicyFingerprint = canonicalJsonHash({
    origin,
    robots_txt: robotsTxt,
    sitemap_discovery: publicSitemapDiscovery,
    raw_delivery_capability: representativeRaw.receipt.seo_delivery_state,
    indexability_state: indexabilityState,
  });
  return {
    originResult: {
      origin,
      indexability_state: indexabilityState,
      robots_txt: robotsTxt,
      sitemap_discovery: publicSitemapDiscovery,
      deployment_fingerprint: deploymentFingerprint,
      site_policy_fingerprint: sitePolicyFingerprint,
    },
    robotsReadback,
    rawByArticleId,
    sitemapDiscovery,
  };
}

async function evaluateRouteState(page) {
  const result = await page.send('Runtime.evaluate', { expression: ROUTE_STATE_EXPRESSION, returnByValue: true, awaitPromise: true });
  if (!result.result || !Object.hasOwn(result.result, 'value')) throw new StyleContractError('ROUTE_EVALUATION_FAILED', 'Browser lieferte keinen auswertbaren Routenzustand.', EXIT.INTERNAL);
  return result.result.value;
}

async function cleanupBrowserResources({ page, browserProcess, userDataDirectory }) {
  const errors = [];
  try {
    if (page) {
      await Promise.race([
        page.send('Browser.close').catch(() => undefined),
        delay(2_000),
      ]);
    }
    page?.close();
  } catch (error) {
    errors.push(`CDP: ${error.message}`);
  }
  try {
    await terminateBrowserProcess(browserProcess);
  } catch (error) {
    errors.push(`Browser: ${error.message}`);
  }
  try {
    await removeBrowserProfile(userDataDirectory);
  } catch (error) {
    errors.push(`Profil: ${error.message}`);
  }
  if (errors.length) throw new StyleContractError('BROWSER_RESOURCE_CLEANUP_FAILED', `Browserressourcen konnten nicht sauber geschlossen werden: ${errors.join('; ')}`, EXIT.INTERNAL);
}

async function applyViewport(page, viewport) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.device_scale_factor,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
}

async function runHydratedRouteContract(url, fixture) {
  const browserPath = findBrowserExecutable();
  const debugPort = await getFreePort();
  const userDataDirectory = await createTemporaryBrowserProfile();
  let browserProcess;
  let page;
  let primaryError;
  let result;
  try {
    browserProcess = await spawnBrowserProcess(browserPath, [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDirectory}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      '--hide-scrollbars',
      'about:blank',
    ]);
    const browserVersion = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
    const target = await createBrowserTarget(debugPort);
    page = await new CdpClient(target.webSocketDebuggerUrl).connect();
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: fixtureInjectionSource(fixture, fixture.route) });
    const viewports = {};
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      await applyViewport(page, viewport);
      await page.send('Page.navigate', { url });
      await waitForHydratedRoute(page);
      const mobileNavInteractions = viewportName === 'mobile'
        ? [await toggleMobileNavigation(page, true), await toggleMobileNavigation(page, false)]
        : [];
      const pointerInteractions = await expandDisclosures(page);
      const routeState = await evaluateRouteState(page);
      routeState.pointer_interactions = pointerInteractions;
      routeState.mobile_nav_interactions = mobileNavInteractions;
      routeState.release_projection.article_id = fixture.expected.release_projection.article_id;
      viewports[viewportName] = {
        viewport: publicViewport(viewport),
        routeState,
        assessment: assessHydratedRouteState(routeState, fixture, viewportName),
      };
    }
    result = {
      browser: {
        product: browserVersion.Browser ?? 'unknown',
        revision: browserVersion['WebKit-Version'] ?? 'unknown',
        user_agent: browserVersion['User-Agent'] ?? 'unknown',
        protocol_version: browserVersion['Protocol-Version'] ?? 'unknown',
      },
      viewports,
      routeState: viewports.desktop.routeState,
      assessment: viewports.desktop.assessment,
    };
  } catch (error) {
    primaryError = error;
  }
  try {
    await cleanupBrowserResources({ page, browserProcess, userDataDirectory });
  } catch (cleanupError) {
    if (primaryError) {
      throw new StyleContractError('BROWSER_RESOURCE_CLEANUP_FAILED', `${primaryError.message}; zusätzlich Cleanup: ${cleanupError.message}`, EXIT.INTERNAL);
    }
    throw cleanupError;
  }
  if (primaryError) throw primaryError;
  return result;
}

const PUBLIC_API_CAPTURE_SOURCE = `(() => {
  try { window.localStorage.setItem('supplement-stack-analytics-consent', 'declined'); } catch {}
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    try {
      const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
      const url = new URL(rawUrl, location.origin);
      if (url.origin === location.origin && url.pathname.startsWith('/api/knowledge/')) {
        window.__knowledgePublicApiReadback = {
          request_url: url.href,
          status: response.status,
          payload: response.ok ? await response.clone().json() : null,
        };
      } else if (url.origin === location.origin && url.pathname === '/api/knowledge') {
        window.__knowledgeOverviewApiReadback = {
          request_url: url.href,
          status: response.status,
          payload: response.ok ? await response.clone().json() : null,
        };
      }
    } catch {}
    return response;
  };
})()`;

async function waitForPublicOverview(page, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await page.send('Runtime.evaluate', {
      expression: `(() => document.readyState === 'complete'
        && location.pathname === '/wissen'
        && Boolean(document.querySelector('.knowledge-overview'))
        && Boolean(window.__knowledgeOverviewApiReadback)
        && !document.querySelector('.knowledge-overview .db-state'))()`,
      returnByValue: true,
    }).then((result) => result.result?.value === true).catch(() => false);
    if (ready && Date.now() - page.lastMainFrameNavigationAt >= 500) return true;
    await delay(100);
  }
  return false;
}

function badgeExpectationMatches(rule, expected, actual) {
  return rule === 'API_DOM_PARITY' || actual === expected;
}

function buildBadgeApiReceipt(readback, expectations) {
  let payload = null;
  try {
    payload = readback.fetch_status === 'FETCHED' && readback.http_status === 200
      ? JSON.parse(readback.body)
      : null;
  } catch {}
  const rawStatuses = Array.isArray(payload?.nutrient_statuses) ? payload.nutrient_statuses : [];
  const payloadValid = readback.fetch_status === 'FETCHED'
    && readback.http_status === 200
    && payload
    && Array.isArray(payload.nutrient_statuses);
  const mismatches = [];
  if (!payloadValid) {
    mismatches.push('api_fetch');
  }

  const statuses = expectations.map((expectation) => {
    const matches = rawStatuses.filter((status) => Number(status?.ingredient_id) === expectation.ingredient_id);
    const status = matches[0] ?? null;
    const valid = matches.length <= 1
      && (status === null || (typeof status.has_studies === 'boolean' && typeof status.has_dge === 'boolean'));
    if (!valid || status === null) mismatches.push(`${expectation.ingredient_id}:status_missing`);
    const hasStudies = status?.has_studies === true;
    const hasDge = status?.has_dge === true;
    if (!badgeExpectationMatches(expectation.studies_rule, expectation.expected_has_studies, hasStudies)) {
      mismatches.push(`${expectation.ingredient_id}:studies_expected`);
    }
    if (!badgeExpectationMatches(expectation.dge_rule, expectation.expected_has_dge, hasDge)) {
      mismatches.push(`${expectation.ingredient_id}:dge_expected`);
    }
    return {
      ingredient_id: expectation.ingredient_id,
      status_present: status !== null && valid,
      studies_rule: expectation.studies_rule,
      expected_has_studies: expectation.expected_has_studies,
      has_studies: hasStudies,
      dge_rule: expectation.dge_rule,
      expected_has_dge: expectation.expected_has_dge,
      has_dge: hasDge,
    };
  });
  return {
    receipt: {
      url: readback.url,
      fetch_status: payloadValid ? 'OK' : (readback.fetch_status === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : 'HTTP_ERROR'),
      http_status: readback.http_status,
      content_type: readback.content_type,
      body_hash: readback.body_hash,
      statuses,
    },
    statuses,
    mismatches,
  };
}

async function evaluateOverviewBadgeCards(page, expectations) {
  const serializedIds = JSON.stringify(expectations.map((expectation) => expectation.ingredient_id));
  return runtimeValue(page, `(() => {
    const ingredientIds = ${serializedIds};
    const exposed = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const allCards = Array.from(document.querySelectorAll('.knowledge-overview .nutri[data-ingredient-ids]'));
    return {
      route_ready: document.readyState === 'complete'
        && location.pathname === '/wissen'
        && Boolean(document.querySelector('.knowledge-overview'))
        && !document.querySelector('.knowledge-overview .db-state'),
      api_request_url: window.__knowledgeOverviewApiReadback?.request_url ?? null,
      cards: ingredientIds.map((ingredientId) => {
        const matches = allCards.filter((card) => (card.getAttribute('data-ingredient-ids') ?? '').split(/\\s+/).includes(String(ingredientId)));
        return {
          ingredient_id: ingredientId,
          card_match_count: matches.length,
          studies_visible: matches.some((card) => exposed(card.querySelector('.tag-data--studies'))),
          dge_visible: matches.some((card) => exposed(card.querySelector('.tag-data--dge'))),
        };
      }),
    };
  })()`);
}

export function buildOverviewBadgeOriginReceipt({
  origin,
  apiUrl,
  overviewUrl,
  apiResult,
  overview,
  request,
}) {
  const observedApiRequestUrl = overview.api_request_url ?? null;
  const cardsById = new Map((overview.cards ?? []).map((card) => [card.ingredient_id, card]));
  const mismatches = [...apiResult.mismatches];
  if (!overview.route_ready) mismatches.push('overview_route');
  if (observedApiRequestUrl !== apiUrl.href) mismatches.push('overview_api_request_url');
  for (const status of apiResult.statuses) {
    const card = cardsById.get(status.ingredient_id);
    if (!card || card.card_match_count !== 1) {
      mismatches.push(`${status.ingredient_id}:card_count`);
      continue;
    }
    if (card.studies_visible !== status.has_studies) mismatches.push(`${status.ingredient_id}:studies_parity`);
    if (card.dge_visible !== status.has_dge) mismatches.push(`${status.ingredient_id}:dge_parity`);
  }
  const uniqueMismatches = [...new Set(mismatches)].sort();
  return {
    origin,
    api: apiResult.receipt,
    hydrated_overview: {
      url: overviewUrl.href,
      viewport: publicViewport(VIEWPORTS.desktop),
      route_ready: overview.route_ready === true,
      api_request_url: observedApiRequestUrl,
      cards: request.affected_ingredient_ids.map((ingredientId) => cardsById.get(ingredientId) ?? {
        ingredient_id: ingredientId,
        card_match_count: 0,
        studies_visible: false,
        dge_visible: false,
      }),
    },
    result: uniqueMismatches.length === 0 ? 'MATCH' : 'MISMATCH',
    mismatches: uniqueMismatches,
  };
}

async function runBadgeReadbackForOrigin(page, origin, request) {
  const apiUrl = new URL('/api/knowledge', origin);
  apiUrl.searchParams.set('cfcheck', request.release_hash);
  const overviewUrl = new URL('/wissen', origin);
  overviewUrl.searchParams.set('cfcheck', request.release_hash);
  const apiReadback = await fetchReadbackResource(apiUrl.href);
  const apiResult = buildBadgeApiReceipt(apiReadback, request.badge_expectations);

  await applyViewport(page, VIEWPORTS.desktop);
  await page.send('Page.navigate', { url: overviewUrl.href });
  const routeReady = await waitForPublicOverview(page);
  const overview = routeReady
    ? await evaluateOverviewBadgeCards(page, request.badge_expectations).catch(() => ({ route_ready: false, api_request_url: null, cards: [] }))
    : { route_ready: false, api_request_url: null, cards: [] };
  return buildOverviewBadgeOriginReceipt({
    origin,
    apiUrl,
    overviewUrl,
    apiResult,
    overview,
    request,
  });
}

async function runPublicReadbackContract(request) {
  const browserPath = findBrowserExecutable();
  const debugPort = await getFreePort();
  const userDataDirectory = await createTemporaryBrowserProfile();
  let browserProcess;
  let page;
  let primaryError;
  let result;
  try {
    browserProcess = await spawnBrowserProcess(browserPath, [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDirectory}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      '--hide-scrollbars',
      'about:blank',
    ]);
    const browserVersion = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
    const target = await createBrowserTarget(debugPort);
    page = await new CdpClient(target.webSocketDebuggerUrl).connect();
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PUBLIC_API_CAPTURE_SOURCE });
    const articlesByOrigin = new Map();
    for (const article of request.articles) {
      const origin = `${new URL(article.public_url).origin}/`;
      const group = articlesByOrigin.get(origin) ?? [];
      group.push(article);
      articlesByOrigin.set(origin, group);
    }
    const originEvidenceByOrigin = new Map();
    for (const [origin, articles] of [...articlesByOrigin.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      originEvidenceByOrigin.set(origin, await prepareOriginReadback(origin, articles, request.release_hash));
    }
    const articleResults = [];
    for (const expected of request.articles) {
      const readbackUrl = new URL(expected.public_url);
      readbackUrl.searchParams.set('cfcheck', request.release_hash);
      const originEvidence = originEvidenceByOrigin.get(`${readbackUrl.origin}/`);
      const viewportResults = {};
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        await applyViewport(page, viewport);
        await page.send('Page.navigate', { url: readbackUrl.href });
        await waitForPublicRoute(page, expected);
        const pointerInteractions = expected.stage === 'stage3' ? await expandDisclosures(page) : [];
        const routeState = await evaluateRouteState(page);
        routeState.pointer_interactions = pointerInteractions;
        routeState.release_projection.article_id = expected.article_id;
        const assessment = assessPublicRouteState(routeState, expected, viewportName, request.release_hash);
        viewportResults[viewportName] = {
          viewport: publicViewport(viewport),
          route_state: routeState,
          assessment,
        };
      }
      const desktop = viewportResults.desktop.assessment;
      const articleRobotsTxt = buildRobotsReceipt(originEvidence.robotsReadback, expected.public_url);
      const indexabilityState = deriveIndexabilityState(desktop.seo, articleRobotsTxt);
      const rawHtml = originEvidence.rawByArticleId.get(expected.article_id).receipt;
      const sitemap = buildSitemapReceipt(originEvidence.sitemapDiscovery, expected.public_url);
      const viewportReceipt = Object.fromEntries(Object.entries(viewportResults).map(([viewportName, viewportResult]) => [viewportName, {
        viewport: viewportResult.viewport,
        responsive_diagnostics: {
          document_metrics: viewportResult.route_state.document_metrics,
          layout: {
            display: viewportResult.route_state.layout?.display ?? null,
            exposed: exposed(viewportResult.route_state.layout),
          },
          toc: {
            display: viewportResult.route_state.toc?.display ?? null,
            exposed: exposed(viewportResult.route_state.toc),
          },
          controls_exposed: (viewportResult.route_state.controls ?? []).map(exposed),
          images_exposed: (viewportResult.route_state.images ?? []).map(exposed),
        },
        result: viewportResult.assessment.result,
        projection_hash: viewportResult.assessment.projection_hash,
        seo_hash: viewportResult.assessment.seo_hash,
        asset_hashes: viewportResult.assessment.asset_hashes,
        checked: [...expected.required_checks],
        mismatches: viewportResult.assessment.mismatches,
        responsive_tables: (viewportResult.route_state.responsive_tables ?? []).map((table) => ({
          presentation: table.presentation,
          desktop_table_exposed: exposed(table.desktop_table),
          mobile_cards_container_exposed: exposed(table.mobile_cards_container),
          mobile_cards_exposed: (table.mobile_cards ?? []).map(exposed),
        })),
      }]));
      const allViewportsMatch = Object.values(viewportResults).every((viewportResult) => viewportResult.assessment.result === 'MATCH');
      const allSeoMatch = Object.values(viewportResults).every((viewportResult) => viewportResult.assessment.seo_match === 'MATCH');
      const hydratedDomState = allViewportsMatch && allSeoMatch ? 'HYDRATED_DOM_MATCH' : 'HYDRATED_DOM_MISMATCH';
      const viewportMismatches = Object.entries(viewportResults).flatMap(([viewportName, viewportResult]) => viewportResult.assessment.mismatches.map((mismatch) => `${viewportName}:${mismatch}`));
      articleResults.push({
        article_id: expected.article_id,
        public_url: expected.public_url,
        result: allViewportsMatch ? 'MATCH' : 'MISMATCH',
        seo_match: allSeoMatch ? 'MATCH' : 'MISMATCH',
        hydrated_dom_state: hydratedDomState,
        seo_delivery_state: rawHtml.seo_delivery_state,
        indexability_state: indexabilityState,
        site_policy_fingerprint: originEvidence.originResult.site_policy_fingerprint,
        raw_html: rawHtml,
        sitemap,
        projection: desktop.projection,
        projection_hash: desktop.projection_hash,
        seo: desktop.seo,
        seo_hash: desktop.seo_hash,
        asset_hashes: desktop.asset_hashes,
        checked: [...expected.required_checks],
        mismatches: viewportMismatches,
        viewports: viewportReceipt,
      });
    }
    const badgeOriginResults = [];
    for (const origin of [...articlesByOrigin.keys()].sort()) {
      badgeOriginResults.push(await runBadgeReadbackForOrigin(page, origin, request));
    }
    const badgeMismatches = badgeOriginResults.flatMap((originResult) => originResult.mismatches).sort();
    result = {
      browser: {
        product: browserVersion.Browser ?? 'unknown',
        revision: browserVersion['WebKit-Version'] ?? 'unknown',
        user_agent: browserVersion['User-Agent'] ?? 'unknown',
        protocol_version: browserVersion['Protocol-Version'] ?? 'unknown',
      },
      articleResults,
      originResults: [...originEvidenceByOrigin.values()].map((evidence) => evidence.originResult),
      badgeReadback: {
        schema: 'knowledge_badge_readback.v1',
        release_hash: request.release_hash,
        affected_ingredient_ids: [...request.affected_ingredient_ids],
        origin_results: badgeOriginResults,
        result: badgeMismatches.length === 0 ? 'MATCH' : 'MISMATCH',
        mismatches: badgeMismatches,
      },
    };
  } catch (error) {
    primaryError = error;
  }
  try {
    await cleanupBrowserResources({ page, browserProcess, userDataDirectory });
  } catch (cleanupError) {
    if (primaryError) {
      throw new StyleContractError('BROWSER_RESOURCE_CLEANUP_FAILED', `${primaryError.message}; zusätzlich Cleanup: ${cleanupError.message}`, EXIT.INTERNAL);
    }
    throw cleanupError;
  }
  if (primaryError) throw primaryError;
  return result;
}

export async function writeReceiptAtomic(path, serialized) {
  const outputPath = resolve(path);
  let temporaryDirectory;
  let temporaryPath;
  let primaryError;
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    temporaryDirectory = await mkdtemp(join(dirname(outputPath), '.knowledge-style-write-'));
    temporaryPath = join(temporaryDirectory, 'receipt.json');
    await writeFile(temporaryPath, serialized, 'utf8');
    await rename(temporaryPath, outputPath);
  } catch (error) {
    primaryError = new StyleContractError('OUTPUT_WRITE_FAILED', `Style-Receipt konnte nicht atomar geschrieben werden: ${error.message}`, EXIT.INTERNAL);
  }
  if (temporaryDirectory) {
    try {
      await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
    } catch (error) {
      throw new StyleContractError(
        'OUTPUT_TEMP_CLEANUP_FAILED',
        `${primaryError ? `${primaryError.message}; zusätzlich ` : ''}Temporäres Output-Verzeichnis konnte nicht entfernt werden: ${error.message}`,
        EXIT.INTERNAL,
      );
    }
  }
  if (primaryError) throw primaryError;
}

function errorJson(error) {
  return JSON.stringify({ schema: 'renderer_style_validation_error.v2', code: error?.code ?? 'STYLE_VALIDATION_INTERNAL', message: error?.message ?? 'Unbekannter Style-Validatorfehler.' });
}

function publicHashContract(hashes) {
  return {
    schema: 'renderer_style_contract_hash.v2',
    validator_version: VALIDATOR_VERSION,
    viewports: Object.fromEntries(Object.entries(VIEWPORTS).map(([name, viewport]) => [name, publicViewport(viewport)])),
    renderer_style_hash: hashes.renderer_style_hash,
    fixture_hash: hashes.fixture_hash,
    route_fingerprint: hashes.route_fingerprint,
    route_fingerprint_parts: hashes.route_fingerprint_parts,
  };
}

function compactViewportRouteContract(state) {
  return {
    route: state.route,
    viewport: state.viewport,
    document_metrics: state.document_metrics,
    shell: {
      primary_nav_exposed: exposed(state?.shell?.primary_nav),
      mobile_menu_button_exposed: exposed(state?.shell?.mobile_menu_button),
      back_link_exposed: exposed(state?.shell?.back_link),
    },
    layout: {
      display: state?.layout?.display ?? null,
      grid_template_columns: state?.layout?.grid_template_columns ?? null,
      exposed: exposed(state?.layout),
    },
    toc: {
      display: state?.toc?.display ?? null,
      position: state?.toc?.position ?? null,
      exposed: exposed(state?.toc),
      link_count: state?.toc_links?.length ?? 0,
    },
    mobile_nav_interactions: (state?.mobile_nav_interactions ?? []).map((interaction) => ({
      expected_open: interaction.expected_open,
      dispatched_via: interaction.dispatched_via,
      trusted_click: interaction.trusted_click,
      menu: interaction.menu,
    })),
    pointer_interactions: (state?.pointer_interactions ?? []).map((interaction) => ({
      trigger_id: interaction.trigger_id,
      dispatched_via: interaction.dispatched_via,
      hit_test: interaction.hit_test,
      trusted_click: interaction.trusted_click,
      expanded: interaction.expanded,
      panel_exposed: interaction.panel_exposed,
    })),
    controls: (state?.controls ?? []).map((control) => ({
      section_id: control.section_id,
      control_type: control.control_type,
      exposed: exposed(control),
    })),
    responsive_tables: (state?.responsive_tables ?? []).map((table) => ({
      presentation: table.presentation,
      container_exposed: exposed(table.container),
      desktop_table_exposed: exposed(table.desktop_table),
      mobile_cards_container_exposed: exposed(table.mobile_cards_container),
      mobile_cards_exposed: table.mobile_cards.map(exposed),
      food_cards_exposed: table.food_cards.map(exposed),
    })),
    images: (state?.images ?? []).map((image) => ({
      src: image.src,
      complete: image.complete,
      natural_width: image.natural_width,
      natural_height: image.natural_height,
      exposed: exposed(image),
    })),
    route_contract_hash: canonicalJsonHash(state),
  };
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${errorJson(error)}\n${usage()}\n`);
    process.exitCode = EXIT.INPUT;
    return;
  }
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  let routeServer;
  let primaryError;
  let serializedOutput;
  let outputPath;
  try {
    if (args.printContractHash) {
      const hashes = await computeKnowledgeMagazineContractHashes({ root: ROOT });
      serializedOutput = `${JSON.stringify(publicHashContract(hashes), null, 2)}\n`;
    } else {
      const input = normalizeInput(await readJsonStrict(args.input));
      if (input.schema === 'renderer_public_readback_request.v2') {
        const browserResult = await runPublicReadbackContract(input);
        const receiptBase = {
          schema: 'renderer_public_readback_receipt.v2',
          release_hash: input.release_hash,
          checked_at: new Date().toISOString(),
          browser: browserResult.browser,
          origin_results: browserResult.originResults,
          article_results: browserResult.articleResults,
          badge_readback: browserResult.badgeReadback,
        };
        const receipt = { ...receiptBase, content_hash: canonicalJsonHash(receiptBase) };
        serializedOutput = `${JSON.stringify(receipt, null, 2)}\n`;
        outputPath = args.out;
        process.exitCode = receipt.article_results.every((article) => article.result === 'MATCH') ? EXIT.PASS : EXIT.STYLE_FAIL;
      } else {
        const hashes = await computeKnowledgeMagazineContractHashes({ root: ROOT });
        if (input.renderer_style_hash !== hashes.renderer_style_hash) {
          throw new StyleContractError('INPUT_RENDERER_STYLE_HASH_MISMATCH', `renderer_style_hash bindet nicht den vollständigen aktuellen Frontend-Fingerprint (erwartet ${hashes.renderer_style_hash}).`);
        }
        if (input.fixture_hash !== hashes.fixture_hash) {
          throw new StyleContractError('INPUT_FIXTURE_HASH_MISMATCH', `fixture_hash bindet nicht die kanonische Route-Fixture (erwartet ${hashes.fixture_hash}).`);
        }
        const fixtureImageBytes = await readFile(join(ROOT, 'public', 'logo.png'));
        const fixtureImageHash = sha256Bytes(fixtureImageBytes).slice('sha256:'.length);
        const fixtureImagePath = `/api/r2/knowledge/${hashes.fixture.article.slug}/${fixtureImageHash}.png`;
        if (hashes.fixture.expected.image_src !== fixtureImagePath) {
          throw new StyleContractError('FIXTURE_ASSET_BINDING_INVALID', 'Die kanonische Route-Fixture bindet ihr Testbild nicht an dessen echten Content-Hash.', EXIT.INTERNAL);
        }
        routeServer = await startActualRouteServer(hashes.fixture.route, {
          assets: [{ path: fixtureImagePath, content_type: 'image/png', bytes: fixtureImageBytes }],
        });
        const browserResult = await runHydratedRouteContract(routeServer.url, hashes.fixture);
        const viewportReceipts = Object.fromEntries(Object.entries(browserResult.viewports).map(([viewportName, viewportResult]) => [viewportName, {
          viewport: viewportResult.viewport,
          route_contract: compactViewportRouteContract(viewportResult.routeState),
          checks: viewportResult.assessment.checks,
          errors: viewportResult.assessment.errors,
          result: viewportResult.assessment.result,
        }]));
        const allViewportPass = Object.values(browserResult.viewports).every((viewportResult) => viewportResult.assessment.result === 'PASS');
        const allChecks = Object.entries(browserResult.viewports).flatMap(([viewportName, viewportResult]) => viewportResult.assessment.checks.map((check) => ({
          ...check,
          id: `${viewportName}:${check.id}`,
          viewport: viewportName,
        })));
        const allErrors = Object.entries(browserResult.viewports).flatMap(([viewportName, viewportResult]) => viewportResult.assessment.errors.map((error) => ({ ...error, viewport: viewportName })));
        const receiptBase = {
          schema: 'renderer_style_validation.v2',
          validator_version: VALIDATOR_VERSION,
          renderer_style_hash: hashes.renderer_style_hash,
          fixture_hash: hashes.fixture_hash,
          route_fingerprint: hashes.route_fingerprint,
          route_fingerprint_parts: hashes.route_fingerprint_parts,
          browser: browserResult.browser,
          viewport: publicViewport(VIEWPORTS.desktop),
          route_contract: browserResult.routeState,
          checks: allChecks,
          errors: allErrors,
          viewports: viewportReceipts,
          result: allViewportPass ? 'PASS' : 'FAIL',
        };
        const receipt = { ...receiptBase, content_hash: canonicalJsonHash(receiptBase) };
        serializedOutput = `${JSON.stringify(receipt, null, 2)}\n`;
        outputPath = args.out;
        process.exitCode = receipt.result === 'PASS' ? EXIT.PASS : EXIT.STYLE_FAIL;
      }
    }
  } catch (error) {
    primaryError = error;
  }
  try {
    await closeActualRouteServer(routeServer);
  } catch (cleanupError) {
    if (primaryError) {
      primaryError = new StyleContractError('STYLE_RESOURCE_CLEANUP_FAILED', `${primaryError.message}; zusätzlich Cleanup: ${cleanupError.message}`, EXIT.INTERNAL);
    } else {
      primaryError = cleanupError;
    }
  }
  if (primaryError) {
    process.stderr.write(`${errorJson(primaryError)}\n`);
    process.exitCode = Number.isInteger(primaryError.exit_code) ? primaryError.exit_code : EXIT.INTERNAL;
    return;
  }
  try {
    if (outputPath) await writeReceiptAtomic(outputPath, serializedOutput);
    process.stdout.write(serializedOutput);
  } catch (error) {
    process.stderr.write(`${errorJson(error)}\n`);
    process.exitCode = Number.isInteger(error?.exit_code) ? error.exit_code : EXIT.INTERNAL;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) await main();
