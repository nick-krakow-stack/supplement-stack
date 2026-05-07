#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

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

const AUTH_REQUIRED_ROUTES = new Set(['/stacks', '/profile', '/my-products']);

const DEFAULT_TARGETS = [
  { route: '/', authRequired: false },
  { route: '/demo', authRequired: false },
  { route: '/impressum', authRequired: false },
  { route: '/datenschutz', authRequired: false },
  { route: '/agb', authRequired: false },
  { route: '/login', authRequired: false },
  { route: '/register', authRequired: false },
  { route: '/forgot-password', authRequired: false },
  { route: '/stacks', authRequired: true },
  { route: '/profile', authRequired: true },
  { route: '/my-products', authRequired: true },
];

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    console.log(usage());
    process.exit(0);
  }
}

function usage() {
  return `Public/User browser smoke for the public frontend routes.

Modes:
  - Public mode (default): loads public routes and verifies auth-gated routes remain protected when possible.
  - Auth mode: set USER_QA_EMAIL + USER_QA_PASSWORD or USER_QA_TOKEN to exercise authenticated flow for protected routes.

Optional (public + auth):
  BASE_URL=https://supplementstack.de
  USER_QA_BASE_URL=<base>/api
  USER_QA_API_BASE_URL=<base>/api
  USER_QA_ROUTES=/
  USER_QA_SCREENSHOT_DIR=tmp/user-smoke
  USER_QA_BROWSER_PATH=C:\\Path\\To\\msedge.exe
  USER_QA_HEADFUL=1
  USER_QA_SKIP_API_GUARDS=1

Optional (auth mode):
  USER_QA_TOKEN=<jwt>
  USER_QA_EMAIL=user@example.com
  USER_QA_PASSWORD=***

Examples:
  node scripts/user-browser-smoke.mjs
  $env:USER_QA_EMAIL='user@example.com'; $env:USER_QA_PASSWORD='...'; node scripts/user-browser-smoke.mjs
`;
}

function normalizeBaseUrl(raw) {
  const value = raw.trim().replace(/\/$/, '');
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    throw new Error(`BASE_URL must start with http:// or https://, got: ${raw}`);
  }
  return value;
}

function routeUrl(baseUrl, route) {
  return `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`;
}

function apiUrl(apiBaseUrl, path) {
  return `${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
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

function isProtectedRoute(route) {
  return AUTH_REQUIRED_ROUTES.has(normalizeRoute(route));
}

function normalizeRoute(route) {
  return route.replace(/\?.*$/, '').replace(/\/+$/, '') || '/';
}

function parseRoutes() {
  const custom = env('USER_QA_ROUTES').trim();
  if (!custom) return DEFAULT_TARGETS.map((target) => ({ ...target }));
  const routeMap = new Map();
  for (const entry of custom.split(',').map((item) => item.trim()).filter(Boolean)) {
    routeMap.set(entry, {
      route: entry,
      authRequired: isProtectedRoute(entry),
    });
  }
  return Array.from(routeMap.values());
}

function hasBlockingText(text) {
  return (
    text.includes('404') ||
    text.includes('Not Found') ||
    text.includes('Serverfehler') ||
    text.includes('Unauthorized') ||
    text.includes('Forbidden')
  );
}

function normalizePath(pathname) {
  if (!pathname) return '/';
  return pathname === '/' ? '/' : pathname.replace(/\/$/, '');
}

function assertRouteState(state, target, isAuthenticated) {
  const route = target.route;
  const actual = normalizePath(state.pathname);
  const expected = normalizePath(normalizeRoute(route));

  if (state.hasBlockingText) {
    throw new Error(`Blocking UI text found for ${route}`);
  }

  if (target.authRequired) {
    if (!isAuthenticated) {
      if (!actual.startsWith('/login') && !actual.startsWith(expected)) {
        throw new Error(`Expected ${route} to be protected when unauthenticated; got ${state.pathname}`);
      }
      return;
    }
    if (!actual.startsWith(expected)) {
      throw new Error(`Expected authenticated route ${expected}, got ${state.pathname}`);
    }
    return;
  }

  if (expected === '/') {
    if (actual !== '/') {
      throw new Error(`Expected home route, got ${state.pathname}`);
    }
    return;
  }

  if (actual.startsWith(expected)) return;

  if (isAuthenticated && (route === '/login' || route === '/register' || route === '/forgot-password')) {
    return;
  }

  if (!isAuthenticated && (route === '/login' || route === '/register' || route === '/forgot-password')) {
    if (!actual.startsWith(route)) {
      throw new Error(`Expected ${route}, got ${state.pathname}`);
    }
  }
}

async function resolveToken(apiBaseUrl) {
  const directToken = env('USER_QA_TOKEN');
  if (directToken) return directToken;

  const email = env('USER_QA_EMAIL');
  const password = env('USER_QA_PASSWORD');
  if (!email || !password) return null;

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
    throw new Error(`User login failed (${response.status}): ${body?.error || bodyText}`);
  }
  return body.token;
}

async function verifyUserToken(apiBaseUrl, token) {
  const response = await fetch(apiUrl(apiBaseUrl, '/me'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`USER token preflight failed (${response.status}): ${bodyText}`);
  }
}

async function runApiChecks(apiBaseUrl, token) {
  if (env('USER_QA_SKIP_API_GUARDS') === '1') return;

  const checks = [{ method: 'GET', path: '/demo/products', expected: 200 }];
  if (token) {
    checks.push({ method: 'GET', path: '/me', expected: 200 });
    checks.push({ method: 'GET', path: '/stacks', expected: 200 });
  } else {
    checks.push({ method: 'GET', path: '/me', expected: 401 });
    checks.push({ method: 'GET', path: '/stacks', expected: 401 });
  }

  for (const check of checks) {
    const response = await fetch(apiUrl(apiBaseUrl, check.path), {
      method: check.method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.status !== check.expected) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `User API check failed: ${check.method} ${check.path} expected ${check.expected}, got ${response.status}${bodyText ? ` (${bodyText.slice(0, 160)})` : ''}`
      );
    }
    console.log(`ok user api-check ${check.method} ${check.path} -> ${response.status}`);
  }
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

function browserCandidates() {
  if (env('USER_QA_BROWSER_PATH')) return [env('USER_QA_BROWSER_PATH')];
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
    throw new Error('No Chrome/Edge executable found. Set USER_QA_BROWSER_PATH or install Playwright.');
  }
  return candidate;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function safeCleanupDirectory(targetPath) {
  try {
    rmSync(targetPath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup for Windows/locked temp profile folders.
  }
}

async function runWithPlaywright(playwright, config) {
  const browser = await playwright.chromium.launch({
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
      if (config.token) {
        await context.addCookies([sessionCookie(config.baseUrl, config.token)]);
      }
      for (const target of config.routes) {
        const page = await context.newPage();
        const response = await page.goto(routeUrl(config.baseUrl, target.route), { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        if (response && response.status() >= 500) {
          throw new Error(`Navigation to ${target.route} failed with HTTP ${response.status()}`);
        }
        const state = await page.evaluate(() => {
          const text = document.body ? document.body.innerText : '';
          return { pathname: window.location.pathname, hasBlockingText: hasBlockingText(text) };
        });
        assertRouteState(state, target, Boolean(config.token));
        if (config.screenshotDir) {
          await page.screenshot({
            path: join(config.screenshotDir, `${viewport.name}-${target.route.replace(/\//g, '-') || 'root'}.png`),
            fullPage: false,
          });
        }
        console.log(`ok ${viewport.name} ${target.route}`);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
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

function waitForJson(url, timeoutMs = 10000) {
  return (async function wait() {
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
  })();
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
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ''}`));
      } else {
        resolve(message.result ?? {});
      }
      return;
    }
    const listeners = this.events.get(message.method) ?? [];
    for (const listener of listeners) {
      listener(message.params ?? {});
    }
  }

  send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) {
      return Promise.reject(new Error('CDP socket is not open'));
    }
    return new Promise((resolveSend, rejectSend) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
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

async function runWithCdp(config) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('This fallback needs Node with global WebSocket support. Use Node 22+ or install Playwright.');
  }

  const browserPath = config.browserPath || findBrowserExecutable();
  const port = await getFreePort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'supplement-user-smoke-'));
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
        if (config.token) {
          await page.send('Network.enable');
          const cookie = sessionCookie(config.baseUrl, config.token);
          const cookieResult = await page.send('Network.setCookie', cookie);
          if (cookieResult.success !== true) {
            throw new Error('Could not set user session cookie in browser context.');
          }
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

        for (const targetRoute of config.routes) {
          await page.send('Page.navigate', { url: routeUrl(config.baseUrl, targetRoute.route) });
          await waitForPageReady(page);
          const result = await page.send('Runtime.evaluate', {
            expression: `(() => {
              const text = document.body ? document.body.innerText : '';
              return {
                pathname: window.location.pathname,
                hasBlockingText: ${hasBlockingText.toString()}(text),
              };
            })()`,
            returnByValue: true,
          });
          assertRouteState(result.result.value, targetRoute, Boolean(config.token));
          if (config.screenshotDir) {
            const screenshot = await page.send('Page.captureScreenshot', {
              format: 'png',
              captureBeyondViewport: false,
            });
            writeFileSync(
              join(config.screenshotDir, `${viewport.name}-${targetRoute.route.replace(/\//g, '-') || 'root'}.png`),
              Buffer.from(screenshot.data, 'base64')
            );
          }
          console.log(`ok ${viewport.name} ${targetRoute.route}`);
        }
      } finally {
        page.close();
      }
    }
  } finally {
    browser.kill();
    safeCleanupDirectory(userDataDir);
    if (browserStderr.trim()) {
      console.error(browserStderr.trim().split('\n').slice(-6).join('\n'));
    }
  }
}

async function main() {
  parseArgs();
  const baseUrl = normalizeBaseUrl(env('BASE_URL') || env('USER_QA_BASE_URL', 'https://supplementstack.de'));
  const apiBaseUrl = normalizeBaseUrl(env('USER_QA_API_BASE_URL', `${baseUrl}/api`));
  const routes = parseRoutes();
  const screenshotDir = env('USER_QA_SCREENSHOT_DIR')
    ? resolve(REPO_ROOT, env('USER_QA_SCREENSHOT_DIR'))
    : '';
  if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

  const token = await resolveToken(apiBaseUrl);
  const hasUserAuth = Boolean(token);
  if (hasUserAuth) {
    await verifyUserToken(apiBaseUrl, token);
  } else {
    console.log('No USER_QA_TOKEN or USER_QA_EMAIL/PASSWORD provided. Running public + guard checks.');
  }

  await runApiChecks(apiBaseUrl, token);

  const config = {
    baseUrl,
    apiBaseUrl,
    routes,
    token,
    screenshotDir,
    headful: env('USER_QA_HEADFUL') === '1',
    browserPath: env('USER_QA_BROWSER_PATH'),
  };

  console.log(`User smoke mode: ${hasUserAuth ? 'authenticated' : 'public'} flow`);
  console.log(`Base URL: ${baseUrl}`);

  const playwright = await loadPlaywright();
  if (playwright) {
    console.log('Using existing Playwright installation.');
    await runWithPlaywright(playwright, config);
  } else {
    console.log('Playwright not found; using Chrome/Edge DevTools fallback.');
    await runWithCdp(config);
  }

  console.log('User browser smoke passed.');
}

main().catch((error) => {
  console.error(`User browser smoke failed: ${error.message}`);
  console.error('Run with --help for environment variables and examples.');
  process.exit(1);
});
