#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const ROUTE_LABELS = new Map([
  ['/administrator/dashboard', ['Dashboard']],
  ['/administrator/products', ['Produkte']],
  ['/administrator/products/1', ['\u00dcbersicht', 'Wirkstoffe', 'Freigabe', 'Shop-Link', 'Warnungen', '\u00c4nderungen']],
  ['/administrator/ingredients', ['Wirkstoffe']],
  ['/administrator/ingredients/1', ['\u00dcberblick', 'Formen', 'Dosiswerte', 'Quellen', 'Anzeige']],
  ['/administrator/dosing', ['Dosis-Richtwerte']],
  ['/administrator/interactions', ['Wechselwirkungs-Matrix', 'Wechselwirkungen']],
  ['/administrator/knowledge', ['Wissen', 'Wissensartikel']],
  ['/administrator/translations', ['\u00dcbersetzungen']],
  ['/administrator/sub-ingredients', ['Wirkstoff-Beziehungen', 'Sub-Wirkstoffe']],
  ['/administrator/shop-domains', ['Shop-Domains']],
  ['/administrator/rankings', ['Rankings']],
  ['/administrator/user-products', ['Nutzer-Produkte']],
  ['/administrator/audit-log', ['Audit-Log']],
  ['/administrator/product-qa', ['Produktprüfung']],
  ['/administrator/link-reports', ['Linkmeldungen']],
  ['/administrator/users', ['Benutzerverwaltung']],
  ['/administrator/settings', ['Einstellungen']],
  ['/administrator/health', ['Health']],
  ['/administrator/launch-checks', ['Go-Live', 'Launch']],
]);

const ADMIN_WRITE_FLOW_GUARD_LABEL = 'ADMIN_QA_ALLOW_PROD_WRITE=1';

const PRODUCTION_HOSTS = new Set(['supplementstack.de', 'www.supplementstack.de']);

const DEFAULT_TARGETS = [
  { route: '/administrator/dashboard' },
  { route: '/administrator/products' },
  { route: '/administrator/products/1' },
  { route: '/administrator/ingredients' },
  { route: '/administrator/ingredients/1', name: 'ingredient-overview' },
  { route: '/administrator/ingredients/1?section=research', name: 'ingredient-research', tabLabel: 'Quellen' },
  { route: '/administrator/ingredients/1?section=dosing', name: 'ingredient-dosing', tabLabel: 'Dosiswerte' },
  { route: '/administrator/ingredients/1?section=display', name: 'ingredient-display', tabLabel: 'Anzeige' },
  { route: '/administrator/dosing' },
  { route: '/administrator/interactions' },
  { route: '/administrator/knowledge' },
  { route: '/administrator/translations' },
  { route: '/administrator/sub-ingredients' },
  { route: '/administrator/shop-domains' },
  { route: '/administrator/rankings' },
  { route: '/administrator/user-products' },
  { route: '/administrator/audit-log' },
  { route: '/administrator/product-qa' },
  { route: '/administrator/link-reports' },
  { route: '/administrator/users' },
  { route: '/administrator/settings' },
  { route: '/administrator/health' },
];

const MOBILE_DRAWER_TARGET = '/administrator/dashboard';

const API_GUARD_TARGETS = [
  { method: 'GET', path: '/admin/research/pubmed-lookup?pmid=123456', expectedStatus: 401 },
  { method: 'GET', path: '/admin/export?entity=products', expectedStatus: 401 },
  { method: 'GET', path: '/admin/health', expectedStatus: 401 },
  { method: 'PUT', path: '/admin/user-products/bulk-approve', expectedStatus: 401 },
];

const VIEWPORTS = [
  {
    name: 'desktop',
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
    hasTouch: false,
  },
  {
    name: 'mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
    hasTouch: true,
  },
];

function parseBool(name) {
  return env(name) === '1';
}

function hasInlineAdminAuthInput() {
  return Boolean(
    env('ADMIN_QA_TOKEN') ||
      env('SUPPLEMENTSTACK_ADMIN_TOKEN') ||
      env('ADMIN_TOKEN') ||
      (env('ADMIN_QA_EMAIL') && env('ADMIN_QA_PASSWORD'))
  );
}

function isProductionHost(baseUrl) {
  const host = new URL(baseUrl).hostname.toLowerCase();
  return PRODUCTION_HOSTS.has(host);
}

function requireWritableHost(baseUrl) {
  if (isProductionHost(baseUrl) && !parseBool('ADMIN_QA_ALLOW_PROD_WRITE')) {
    throw new Error(`Admin write-flow is enabled against production host ${new URL(baseUrl).hostname}. Set ${ADMIN_WRITE_FLOW_GUARD_LABEL} to continue.`);
  }
}

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function usage() {
  return `Admin browser smoke for /administrator.

Modes:
  - Base guard mode (default): validates unauthenticated admin API routes with 401.
  - Route smoke: set ADMIN_QA_TOKEN or ADMIN_QA_EMAIL + ADMIN_QA_PASSWORD to verify protected admin pages.
  - Optional write flow: set ADMIN_QA_WRITE_FLOW=1 after successful auth.

Required for route smoke:
  ADMIN_QA_TOKEN=<jwt>
    Seeds a browser session cookie for /administrator page checks.
    or
  ADMIN_QA_EMAIL=<admin-email> ADMIN_QA_PASSWORD=<admin-password>
    Logs in through /api/auth/login, then seeds the returned JWT as a browser session cookie.

Optional:
  BASE_URL=https://supplementstack.de
  ADMIN_QA_BASE_URL=https://supplementstack.de
  ADMIN_QA_API_BASE_URL=<base>/api
  ADMIN_QA_ROUTES=/administrator/dashboard,/administrator/products
  ADMIN_QA_BROWSER_PATH=C:\\Path\\To\\msedge.exe
  ADMIN_QA_SCREENSHOT_DIR=tmp\\admin-smoke
  ADMIN_QA_HEADFUL=1
  ADMIN_QA_SKIP_API_GUARDS=1
  ADMIN_QA_GUARD_ONLY=1
  ADMIN_QA_WRITE_FLOW=1
  ADMIN_QA_ALLOW_PROD_WRITE=1

Aliases for token:
  SUPPLEMENTSTACK_ADMIN_TOKEN, ADMIN_TOKEN

Examples:
  $env:ADMIN_QA_TOKEN='...'; node scripts/admin-browser-smoke.mjs
  $env:ADMIN_QA_EMAIL='admin@example.com'; $env:ADMIN_QA_PASSWORD='...'; node scripts/admin-browser-smoke.mjs
`;
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    console.log(usage());
    process.exit(0);
  }
}

function normalizeBaseUrl(raw) {
  const value = raw.trim().replace(/\/$/, '');
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
  throw new Error(`BASE_URL must start with http:// or https://, got: ${raw}`);
}
  return value;
}

function apiUrl(apiBaseUrl, path) {
  return `${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function routeUrl(baseUrl, route) {
  return `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`;
}

function sessionCookie(baseUrl, token) {
  const url = new URL(baseUrl);
  return {
    name: 'session',
    value: token,
    url: url.origin,
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
  };
}

function labelCandidates(route) {
  const path = route.split('?')[0].replace(/\/$/, '') || '/';
  return ROUTE_LABELS.get(path) ?? [path.split('/').filter(Boolean).pop() ?? path];
}

function parseTargetRoutes() {
  const custom = env('ADMIN_QA_ROUTES').trim();
  if (!custom) {
    return DEFAULT_TARGETS.map((target) => ({
      ...target,
      labels: target.labels ?? labelCandidates(target.route),
    }));
  }
  return custom
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((route) => ({ route, labels: labelCandidates(route) }));
}

function targetName(target) {
  return target.name || slug(`${target.route}${target.tabLabel ? `-${target.tabLabel}` : ''}`);
}

function parseRoutes() {
  return parseTargetRoutes();
}

async function resolveToken(apiBaseUrl) {
  const directToken =
    env('ADMIN_QA_TOKEN') ||
    env('SUPPLEMENTSTACK_ADMIN_TOKEN') ||
    env('ADMIN_TOKEN');
  if (directToken) return directToken;

  const email = env('ADMIN_QA_EMAIL');
  const password = env('ADMIN_QA_PASSWORD');
  if (!email || !password) {
    throw new Error('Missing admin auth. Set ADMIN_QA_TOKEN or ADMIN_QA_EMAIL + ADMIN_QA_PASSWORD.');
  }

  const response = await fetch(apiUrl(apiBaseUrl, '/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = null;
  }
  if (!response.ok || !body?.token) {
    throw new Error(`Admin login failed (${response.status}): ${body?.error || bodyText}`);
  }
  if (body.profile?.role !== 'admin') {
    throw new Error(`Login succeeded but profile role is not admin: ${body.profile?.role ?? 'unknown'}`);
  }
  return body.token;
}

async function verifyAdminToken(apiBaseUrl, token) {
  const response = await fetch(apiUrl(apiBaseUrl, '/me'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new Error(`Token preflight failed (${response.status}): ${body?.error || bodyText}`);
  }
  if (body?.profile?.role !== 'admin') {
    throw new Error(`Token preflight returned non-admin role: ${body?.profile?.role ?? 'unknown'}`);
  }
  return body.profile.email ?? 'admin';
}

async function runApiGuardChecks(apiBaseUrl) {
  if (env('ADMIN_QA_SKIP_API_GUARDS') === '1') return;

  for (const target of API_GUARD_TARGETS) {
    const response = await fetch(apiUrl(apiBaseUrl, target.path), {
      method: target.method,
      headers: { 'Content-Type': 'application/json' },
      body: target.method === 'GET' ? undefined : JSON.stringify({ ids: [1] }),
    });
    if (response.status !== target.expectedStatus) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `API guard failed for ${target.method} ${target.path}: expected ${target.expectedStatus}, got ${response.status}${bodyText ? ` (${bodyText.slice(0, 160)})` : ''}\n` +
        `Tip: check ADMIN_QA_BASE_URL/BASE_URL and API auth expectations.`
      );
    }
    console.log(`ok api-guard ${target.method} ${target.path} -> ${response.status}`);
  }
}

async function runAdminWriteSmoke(apiBaseUrl, token) {
  if (!parseBool('ADMIN_QA_WRITE_FLOW')) {
    return;
  }
  requireWritableHost(apiBaseUrl);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const translationCandidatesResp = await fetch(apiUrl(apiBaseUrl, '/admin/translations/ingredients?language=de&limit=250&offset=0'), { headers });
  if (!translationCandidatesResp.ok) {
    const bodyText = await translationCandidatesResp.text().catch(() => '');
    throw new Error(`Write flow setup failed: expected translations list for de; got ${translationCandidatesResp.status}${bodyText ? ` (${bodyText.slice(0, 160)})` : ''}`);
  }

  const translationPayload = await translationCandidatesResp.json().catch(() => ({}));
  const translated = (translationPayload.translations || []).find((item) => item?.status === 'translated' && item?.name);
  if (!translated) {
    console.log('Write-flow note: no translated ingredient translation found, skipping translation no-op write.');
  } else {
    const translationUrl = apiUrl(apiBaseUrl, `/admin/translations/ingredients/${encodeURIComponent(translated.ingredient_id)}/de`);
    const putResp = await fetch(translationUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: translated.name,
        description: translated.description || null,
        hypo_symptoms: translated.hypo_symptoms || null,
        hyper_symptoms: translated.hyper_symptoms || null,
      }),
    });
    if (!putResp.ok) {
      const bodyText = await putResp.text().catch(() => '');
      throw new Error(`Write-flow translation upsert failed for ingredient ${translated.ingredient_id}: ${putResp.status}${bodyText ? ` (${bodyText.slice(0, 160)})` : ''}`);
    }
    console.log(`ok admin write-flow: translation upsert no-op for ingredient ${translated.ingredient_id}`);
  }

  const mappingsResp = await fetch(apiUrl(apiBaseUrl, '/admin/ingredient-sub-ingredients'), { headers });
  if (!mappingsResp.ok) {
    const bodyText = await mappingsResp.text().catch(() => '');
    throw new Error(`Write-flow setup failed: expected ingredient-sub-ingredients list; got ${mappingsResp.status}${bodyText ? ` (${bodyText.slice(0, 160)})` : ''}`);
  }

  const mappingsPayload = await mappingsResp.json().catch(() => ({}));
  const firstMapping = (mappingsPayload.mappings || [])[0];
  if (!firstMapping) {
    console.log('Write-flow note: no ingredient-sub-ingredient mappings found, skipping mapping no-op write.');
    return;
  }

  const mappingResp = await fetch(apiUrl(apiBaseUrl, '/admin/ingredient-sub-ingredients'), {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      parent_ingredient_id: firstMapping.parent_ingredient_id,
      child_ingredient_id: firstMapping.child_ingredient_id,
      sort_order: firstMapping.sort_order || 0,
      prompt_label: firstMapping.prompt_label ?? null,
      is_default_prompt: Boolean(firstMapping.is_default_prompt),
    }),
  });
  if (!mappingResp.ok) {
    const bodyText = await mappingResp.text().catch(() => '');
    throw new Error(`Write-flow mapping upsert failed for pair ${firstMapping.parent_ingredient_id}/${firstMapping.child_ingredient_id}: ${mappingResp.status}${bodyText ? ` (${bodyText.slice(0, 160)})` : ''}`);
  }
  console.log(`ok admin write-flow: sub-ingredient mapping upsert no-op for ${firstMapping.parent_ingredient_id}/${firstMapping.child_ingredient_id}`);
}

async function loadPlaywright() {
  const candidates = [
    join(REPO_ROOT, 'node_modules', 'playwright', 'index.js'),
    join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'index.js'),
    join(REPO_ROOT, 'frontend', 'node_modules', 'playwright', 'index.js'),
    join(REPO_ROOT, 'frontend', 'node_modules', '@playwright', 'test', 'index.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }
  return null;
}

function failIfBadAdminState(state, route) {
  if (!state.pathname.startsWith('/administrator')) {
    throw new Error(`Expected /administrator route for ${route}, got ${state.pathname}`);
  }
  if (!state.hasAdminShell) {
    throw new Error(`Admin shell did not render for ${route}`);
  }
  if (state.hasBlockingText) {
    throw new Error(`Admin page shows an auth/load/error blocker for ${route}`);
  }
}

function hasExpectedLabel(state) {
  return state.hasExpectedLabel || Boolean(state.matchedLabel);
}

function expectedLabelMessage(labels) {
  return labels.map((label) => `"${label}"`).join(' or ');
}

async function runWithPlaywright(playwright, config) {
  const browserType = playwright.chromium;
  const browser = await browserType.launch({
    headless: !config.headful,
    executablePath: config.browserPath || undefined,
  });
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
        isMobile: viewport.mobile,
        hasTouch: viewport.hasTouch,
      });
      await context.addCookies([sessionCookie(config.baseUrl, config.token)]);

      for (const target of config.routes) {
        const { route, labels, tabLabel } = target;
        const page = await context.newPage();
        await page.goto(routeUrl(config.baseUrl, route), { waitUntil: 'networkidle' });
        await page.waitForLoadState('domcontentloaded');
        let state = await page.evaluate((expectedLabels) => {
          const text = document.body?.innerText ?? '';
          const matchedLabel = expectedLabels.find((label) => text.includes(label)) || '';
          return {
            pathname: window.location.pathname,
            hasAdminShell: Boolean(document.querySelector('.admin-app')),
            hasExpectedLabel: Boolean(matchedLabel),
            matchedLabel,
            hasBlockingText:
              text.includes('Lade Administrator-Oberflaeche') ||
              text.includes('Lade Administrator-Oberfläche') ||
              text.includes('konnte nicht geladen') ||
              text.includes('Unauthorized') ||
              text.includes('Forbidden') ||
              window.location.pathname === '/login',
          };
        }, labels);
        failIfBadAdminState(state, route);
        if (!hasExpectedLabel(state)) {
          throw new Error(`Expected label ${expectedLabelMessage(labels)} was not visible for ${route}`);
        }
        if (tabLabel) {
          await page.getByRole('tab', { name: tabLabel }).click();
          await page.waitForFunction((label) => {
            const active = document.querySelector('[role="tab"][aria-selected="true"]');
            return active?.textContent?.includes(label);
          }, tabLabel);
        }
        if (viewport.name === 'mobile' && route === MOBILE_DRAWER_TARGET) {
          await page.getByLabel('Navigation umschalten').click();
          await page.getByText('Produktprüfung').waitFor({ timeout: 3000 });
        }
        if (config.screenshotDir) {
          await page.screenshot({
            path: join(config.screenshotDir, `${viewport.name}-${targetName(target)}.png`),
            fullPage: false,
          });
        }
        await page.close();
        console.log(`ok ${viewport.name} ${route}${tabLabel ? ` [${tabLabel}]` : ''}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
}

async function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = net.createServer();
    server.unref();
    server.on('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

function browserCandidates() {
  if (env('ADMIN_QA_BROWSER_PATH')) return [env('ADMIN_QA_BROWSER_PATH')];
  if (process.platform === 'win32') {
    const roots = [
      env('PROGRAMFILES'),
      env('PROGRAMFILES(X86)'),
      env('LOCALAPPDATA'),
    ].filter(Boolean);
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
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

function findBrowserExecutable() {
  const candidate = browserCandidates().find((item) => item && existsSync(item));
  if (!candidate) {
    throw new Error(
      'No Chrome/Edge executable found. Set ADMIN_QA_BROWSER_PATH or install Playwright in the existing frontend toolchain.'
    );
  }
  return candidate;
}

async function waitForJson(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function safeCleanupDirectory(targetPath) {
  try {
    rmSync(targetPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures on locked directories.
  }
}

async function createTarget(port) {
  const url = `http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`;
  let response = await fetch(url, { method: 'PUT' });
  if (response.status === 405) response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not create browser target (${response.status})`);
  }
  return response.json();
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  connect() {
    return new Promise((resolveConnect, rejectConnect) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener('open', () => resolveConnect(this));
      this.ws.addEventListener('error', rejectConnect);
      this.ws.addEventListener('message', (event) => this.handleMessage(event.data));
      this.ws.addEventListener('close', () => {
        for (const { reject } of this.pending.values()) {
          reject(new Error('CDP socket closed'));
        }
        this.pending.clear();
      });
    });
  }

  handleMessage(data) {
    const message = JSON.parse(data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve: resolveMessage, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ''}`));
      } else {
        resolveMessage(message.result ?? {});
      }
      return;
    }
    const listeners = this.events.get(message.method) ?? [];
    for (const listener of listeners) listener(message.params ?? {});
  }

  send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('CDP socket is not open'));
    }
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolveMessage, reject) => {
      this.pending.set(id, { resolve: resolveMessage, reject });
      this.ws.send(payload);
    });
  }

  on(method, listener) {
    const listeners = this.events.get(method) ?? [];
    listeners.push(listener);
    this.events.set(method, listeners);
  }

  close() {
    this.ws?.close();
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function waitForPageReady(page, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await page.send('Runtime.evaluate', {
      expression: `document.readyState === 'complete' && Boolean(document.body)`,
      returnByValue: true,
    }).catch(() => ({ result: { value: false } }));
    if (result.result?.value) return;
    await delay(150);
  }
  throw new Error('Timed out waiting for document readiness');
}

async function evaluatePageState(page, expectedLabels) {
  const expression = `(() => {
    const text = document.body ? document.body.innerText : '';
    const expectedLabels = ${JSON.stringify(expectedLabels)};
    const matchedLabel = expectedLabels.find((label) => text.includes(label)) || '';
    return {
      pathname: window.location.pathname,
      hasAdminShell: Boolean(document.querySelector('.admin-app')),
      hasExpectedLabel: Boolean(matchedLabel),
      matchedLabel,
      hasBlockingText:
        text.includes('Lade Administrator-Oberflaeche') ||
        text.includes('Lade Administrator-Oberfläche') ||
        text.includes('konnte nicht geladen') ||
        text.includes('Unauthorized') ||
        text.includes('Forbidden') ||
        window.location.pathname === '/login'
    };
  })()`;
  const result = await page.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  return result.result.value;
}

async function waitForAdminRouteState(page, expectedLabels, route, timeoutMs = 15000) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await evaluatePageState(page, expectedLabels);
    if (
      lastState.pathname.startsWith('/administrator') &&
      lastState.hasAdminShell &&
      hasExpectedLabel(lastState) &&
      !lastState.hasBlockingText
    ) {
      return lastState;
    }
    if (lastState.pathname === '/login') {
      throw new Error(`Expected /administrator route for ${route}, got /login`);
    }
    await delay(250);
  }
  return lastState;
}

async function clickTab(page, tabLabel) {
  const clickResult = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('[role="tab"]'));
      const button = buttons.find((item) => (item.textContent || '').includes(${JSON.stringify(tabLabel)}));
      if (!button) return { ok: false, reason: 'missing tab' };
      button.click();
      return { ok: true, reason: '' };
    })()`,
    returnByValue: true,
  });
  if (!clickResult.result.value.ok) {
    throw new Error(`Could not click tab "${tabLabel}": ${clickResult.result.value.reason}`);
  }

  const startedAt = Date.now();
  let lastReason = '';
  while (Date.now() - startedAt < 3000) {
    const result = await page.send('Runtime.evaluate', {
      expression: `(() => {
      const active = document.querySelector('[role="tab"][aria-selected="true"]');
      return {
        ok: Boolean(active && (active.textContent || '').includes(${JSON.stringify(tabLabel)})),
        reason: active ? active.textContent : 'no active tab'
      };
    })()`,
      returnByValue: true,
    });
    if (result.result.value.ok) return;
    lastReason = result.result.value.reason;
    await delay(100);
  }
  throw new Error(`Tab "${tabLabel}" did not become active: ${lastReason || 'timed out'}`);
}

async function navigate(page, url) {
  await page.send('Page.navigate', { url });
  await waitForPageReady(page);
}

async function clickMobileNav(page) {
  const result = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const button = document.querySelector('button[aria-label="Navigation umschalten"]');
      if (!button) return { ok: false, reason: 'missing mobile nav button' };
      button.click();
      const text = document.body ? document.body.innerText : '';
      return { ok: text.includes('Produktprüfung'), reason: text };
    })()`,
    returnByValue: true,
  });
  if (!result.result.value.ok) {
    throw new Error(`Mobile navigation did not open: ${result.result.value.reason}`);
  }
}

async function captureScreenshot(page, filePath) {
  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  writeFileSync(filePath, Buffer.from(result.data, 'base64'));
}

async function runWithCdp(config) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('This fallback needs Node with global WebSocket support. Use Node 22+ or install Playwright.');
  }

  const browserPath = config.browserPath || findBrowserExecutable();
  const port = await getFreePort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'supplement-admin-smoke-'));
  const browser = spawn(browserPath, [
    config.headful ? '' : '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    '--disable-sync',
    'about:blank',
  ].filter(Boolean), {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let browserStderr = '';
  browser.stderr.on('data', (chunk) => {
    browserStderr += String(chunk);
  });

  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    for (const viewport of VIEWPORTS) {
      const target = await createTarget(port);
      const page = await new CdpClient(target.webSocketDebuggerUrl).connect();
      try {
        await page.send('Page.enable');
        await page.send('Runtime.enable');
        await page.send('Network.enable');
        const cookie = sessionCookie(config.baseUrl, config.token);
        const cookieResult = await page.send('Network.setCookie', cookie);
        if (cookieResult.success !== true) {
          throw new Error('Could not set admin session cookie in browser context.');
        }
        await page.send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.deviceScaleFactor,
          mobile: viewport.mobile,
          screenWidth: viewport.width,
          screenHeight: viewport.height,
        });
        await page.send('Emulation.setTouchEmulationEnabled', {
          enabled: viewport.hasTouch,
        });

        for (const target of config.routes) {
          const { route, labels, tabLabel } = target;
          await navigate(page, routeUrl(config.baseUrl, route));
          const state = await waitForAdminRouteState(page, labels, route);
          failIfBadAdminState(state, route);
          if (!hasExpectedLabel(state)) {
            throw new Error(`Expected label ${expectedLabelMessage(labels)} was not visible for ${route}`);
          }
          if (tabLabel) {
            await clickTab(page, tabLabel);
          }
          if (viewport.name === 'mobile' && route === MOBILE_DRAWER_TARGET) {
            await clickMobileNav(page);
          }
          if (config.screenshotDir) {
            await captureScreenshot(page, join(config.screenshotDir, `${viewport.name}-${targetName(target)}.png`));
          }
          console.log(`ok ${viewport.name} ${route}${tabLabel ? ` [${tabLabel}]` : ''}`);
        }
      } finally {
        page.close();
      }
    }
  } catch (error) {
    if (browserStderr.trim()) {
      console.error(browserStderr.trim().split('\n').slice(-6).join('\n'));
    }
    throw error;
  } finally {
    browser.kill();
    safeCleanupDirectory(userDataDir);
  }
}

async function main() {
  parseArgs();

  const baseUrl = normalizeBaseUrl(env('BASE_URL') || env('ADMIN_QA_BASE_URL', 'https://supplementstack.de'));
  const apiBaseUrl = normalizeBaseUrl(env('ADMIN_QA_API_BASE_URL', `${baseUrl}/api`));
  const routes = parseRoutes();
  const guardOnly = parseBool('ADMIN_QA_GUARD_ONLY');
  const screenshotDir = env('ADMIN_QA_SCREENSHOT_DIR')
    ? resolve(REPO_ROOT, env('ADMIN_QA_SCREENSHOT_DIR'))
    : '';
  if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

  await runApiGuardChecks(apiBaseUrl);
  if (guardOnly) {
    console.log('Admin API guard smoke passed.');
    return;
  }
  if (!hasInlineAdminAuthInput()) {
    console.log('No admin auth token or email/password found. Admin browser route smoke skipped.');
    console.log('Admin API guard smoke passed.');
    return;
  }

  const token = await resolveToken(apiBaseUrl);
  const email = await verifyAdminToken(apiBaseUrl, token);
  const config = {
    baseUrl,
    apiBaseUrl,
    routes,
    screenshotDir,
    token,
    headful: env('ADMIN_QA_HEADFUL') === '1',
    browserPath: env('ADMIN_QA_BROWSER_PATH'),
  };

  console.log(`Admin preflight ok for ${email}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Routes: ${routes.map((target) => `${target.route}${target.tabLabel ? ` [${target.tabLabel}]` : ''}`).join(', ')}`);
  console.log(`Mode: guard-only=no, route-read=yes, write-flow=${parseBool('ADMIN_QA_WRITE_FLOW') ? 'yes' : 'no'}`);

  const playwright = await loadPlaywright();
  if (playwright) {
    console.log('Using existing Playwright installation.');
    await runWithPlaywright(playwright, config);
  } else {
    console.log('Playwright not found; using Chrome/Edge DevTools fallback.');
    await runWithCdp(config);
  }

  await runAdminWriteSmoke(apiBaseUrl, token);

  console.log('Admin browser smoke passed.');
}

main().catch((error) => {
  console.error(`Admin browser smoke failed: ${error.message}`);
  console.error('Run with --help for environment variables and examples.');
  process.exit(1);
});
