# User Browser Smoke

Smoke harness for user-side frontend routes (public and optional authenticated flow).

Modes:

- Public mode (default): checks public pages and auth-guard behaviour for protected routes.
- Auth mode: use `USER_QA_EMAIL` + `USER_QA_PASSWORD` or `USER_QA_TOKEN`.

Usage:

```powershell
node scripts/user-browser-smoke.mjs
```

```powershell
$env:USER_QA_EMAIL = 'user@example.com'
$env:USER_QA_PASSWORD = '<password>'
node scripts/user-browser-smoke.mjs
```

```powershell
$env:USER_QA_TOKEN = '<jwt>'
node scripts/user-browser-smoke.mjs
```

Optional env:

```powershell
$env:BASE_URL = 'https://supplementstack.de'
$env:USER_QA_BASE_URL = 'https://supplementstack.de'
$env:USER_QA_API_BASE_URL = 'https://supplementstack.de/api'
$env:USER_QA_ROUTES = '/,/stacks,/profile'
$env:USER_QA_SCREENSHOT_DIR = 'tmp/user-smoke'
$env:USER_QA_HEADFUL = '1'
$env:USER_QA_BROWSER_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$env:USER_QA_SKIP_API_GUARDS = '1'
```

The script checks:

- API: `/demo/products` always, plus `/me` and `/stacks` with expected auth-dependent status.
- Browser routes: public pages (`/`, `/demo`, legal pages), auth required pages
  (`/stacks`, `/profile`, `/my-products`) and form routes.

No credentials/tokens are printed by the script.
