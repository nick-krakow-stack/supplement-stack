# Admin Browser Smoke

Smoke harness for the rebuilt `/administrator` area on desktop and mobile.

It supports three clear modes:

- Guard-only (default): validates known unauthenticated admin API endpoints return `401`.
- Route-read (auth mode): loads `/administrator` routes with an admin session.
- Optional write-flow: runs no-op admin mutations when explicitly enabled.

Auth flow can use:

- `ADMIN_QA_TOKEN`, `SUPPLEMENTSTACK_ADMIN_TOKEN`, or `ADMIN_TOKEN`
- `ADMIN_QA_EMAIL` + `ADMIN_QA_PASSWORD` (exchange for JWT)

If no auth token/credentials are available, the harness runs guard-only mode by default.

Run from repo root:

```powershell
$env:BASE_URL = 'https://supplementstack.de'
node scripts/admin-browser-smoke.mjs
```

```powershell
$env:ADMIN_QA_TOKEN = '<admin-jwt>'
node scripts/admin-browser-smoke.mjs
```

```powershell
$env:ADMIN_QA_EMAIL = 'admin@example.com'
$env:ADMIN_QA_PASSWORD = '<password>'
node scripts/admin-browser-smoke.mjs
```

Optional env:

```powershell
$env:ADMIN_QA_API_BASE_URL = 'https://supplementstack.de/api'
$env:ADMIN_QA_ROUTES = '/administrator/dashboard,/administrator/products'
$env:ADMIN_QA_SCREENSHOT_DIR = 'tmp/admin-smoke'
$env:ADMIN_QA_HEADFUL = '1'
$env:ADMIN_QA_BROWSER_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$env:ADMIN_QA_SKIP_API_GUARDS = '1'
$env:ADMIN_QA_GUARD_ONLY = '1'
$env:ADMIN_QA_WRITE_FLOW = '1'
$env:ADMIN_QA_ALLOW_PROD_WRITE = '1'
```

Notes:

- Guard mode always runs before any route/browser step.
- `ADMIN_QA_WRITE_FLOW=1` only activates write smoke.
- `ADMIN_QA_ALLOW_PROD_WRITE=1` is required to run write smoke against production
  hosts (`supplementstack.de` and `www.supplementstack.de`).

If Playwright exists in node_modules, it is used; otherwise the script falls back to
Chrome/Edge DevTools Protocol without adding new dependencies.
