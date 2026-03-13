// Supplement Stack - Page Routes (HTML Templates)
// All server-rendered HTML pages with Tailwind CSS
import { Hono } from 'hono'
import type { AppEnv } from '../types'

const pages = new Hono<AppEnv>()

// ========================
// SHARED TEMPLATE HELPERS
// ========================

function pageShell(title: string, body: string, scripts: string[] = [], bodyClass = ''): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Supplement Stack</title>
  <meta name="description" content="Supplement Stack - Ihr intelligenter Supplement Manager mit wissenschaftlich fundierten Dosierungsempfehlungen.">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="/static/styles.css" rel="stylesheet">
</head>
<body class="${bodyClass || 'bg-gray-50'}">
${body}
${scripts.map(s => `<script src="${s}"></script>`).join('\n')}
</body>
</html>`
}

function navBar(): string {
  return `<nav class="bg-white shadow-sm border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <a href="/" class="flex items-center">
        <i class="fas fa-capsules text-2xl text-blue-600 mr-3"></i>
        <span class="text-xl font-bold text-gray-900">Supplement Stack</span>
      </a>
      <div id="nav-links" class="hidden md:flex items-center space-x-4">
        <!-- Populated by JS based on auth state -->
      </div>
      <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
        <i class="fas fa-bars text-xl"></i>
      </button>
    </div>
    <div id="mobile-menu" class="hidden md:hidden pb-3">
      <div id="mobile-nav-links" class="space-y-1">
        <!-- Populated by JS -->
      </div>
    </div>
  </div>
</nav>`
}

function footer(): string {
  return `<footer class="bg-gray-900 text-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
      <div class="col-span-1 md:col-span-2">
        <div class="flex items-center mb-4">
          <i class="fas fa-capsules text-2xl text-blue-400 mr-3"></i>
          <span class="text-xl font-bold">Supplement Stack</span>
        </div>
        <p class="text-gray-300 mb-4 max-w-md">Ihr intelligenter Supplement Manager für wissenschaftlich fundierte Nahrungsergänzung.</p>
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
          <p class="text-yellow-200 text-sm"><i class="fas fa-exclamation-triangle mr-2"></i><strong>Wichtiger Hinweis:</strong> Diese Anwendung ersetzt keine medizinische Beratung.</p>
        </div>
      </div>
      <div>
        <h3 class="text-lg font-semibold mb-4">Navigation</h3>
        <ul class="space-y-2">
          <li><a href="/" class="text-gray-300 hover:text-white">Startseite</a></li>
          <li><a href="/demo" class="text-gray-300 hover:text-white">Demo</a></li>
          <li><a href="/auth" class="text-gray-300 hover:text-white">Anmelden</a></li>
          <li><a href="/dashboard" class="text-gray-300 hover:text-white">Dashboard</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-lg font-semibold mb-4">Rechtliches</h3>
        <ul class="space-y-2">
          <li><a href="/datenschutz" class="text-gray-300 hover:text-white">Datenschutz</a></li>
          <li><a href="/impressum" class="text-gray-300 hover:text-white">Impressum</a></li>
          <li><a href="/agb" class="text-gray-300 hover:text-white">AGB</a></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-gray-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
      <p class="text-gray-300 text-sm">&copy; 2025 Supplement Stack. Alle Rechte vorbehalten.</p>
      <div class="flex items-center space-x-4 mt-4 sm:mt-0">
        <span class="text-gray-300 text-sm">DSGVO-konform</span>
        <span class="text-gray-300 text-sm">&bull;</span>
        <span class="text-gray-300 text-sm">Made in Germany</span>
      </div>
    </div>
  </div>
</footer>`
}

// ========================
// LANDING PAGE
// ========================

pages.get('/', (c) => {
  const features = [
    { icon: 'pills', color: 'blue', title: 'Produkt-Management', desc: 'Erfasse deine Supplements mit allen Details. Automatische Kategorisierung und Dubletten-Erkennung.' },
    { icon: 'layer-group', color: 'green', title: 'Stack-Verwaltung', desc: 'Erstelle individuelle Kombinationen mit intelligenten Dosierungsempfehlungen.' },
    { icon: 'exclamation-triangle', color: 'red', title: 'Interaktions-Warnungen', desc: 'Automatische Warnungen bei Überdosierungen oder negativen Wechselwirkungen.' },
    { icon: 'calculator', color: 'purple', title: 'Preisberechnung', desc: 'Kosten pro Tag, Woche und Monat. Verbrauchsübersicht und Nachkauf-Erinnerungen.' },
    { icon: 'chart-line', color: 'yellow', title: 'Intelligente Analyse', desc: 'Analysiere deine Supplement-Aufnahme und erkenne Über- oder Unterversorgung.' },
    { icon: 'book', color: 'indigo', title: 'Wissensdatenbank', desc: 'Detaillierte Infos zu jedem Nährstoff: Dosierungsempfehlungen und Mangelerscheinungen.' }
  ]

  const featureCards = features.map(f => `
        <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow">
          <div class="w-16 h-16 bg-${f.color}-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-${f.icon} text-2xl text-${f.color}-600"></i>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-3">${f.title}</h3>
          <p class="text-gray-600 leading-relaxed">${f.desc}</p>
        </div>`).join('')

  const body = `
${navBar()}
<div id="app">
  <div class="bg-gradient-to-br from-blue-50 via-white to-blue-100 py-20">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <i class="fas fa-capsules text-6xl text-blue-600 mb-6"></i>
      <h1 class="text-5xl font-bold text-gray-900 mb-4">Dein intelligenter<br><span class="text-blue-600">Supplement Manager</span></h1>
      <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">Verwalte deine Nahrungsergänzungsmittel professionell. Mit wissenschaftlich fundierten Dosierungsempfehlungen, Interaktionswarnungen und automatischer Preisberechnung.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center mb-8">
        <a href="/auth" class="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg">Kostenlos registrieren</a>
        <a href="/demo" class="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors">Demo anschauen</a>
      </div>
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-4xl mx-auto">
        <p class="text-yellow-800 text-sm"><i class="fas fa-exclamation-triangle text-yellow-600 mr-2"></i><strong>Hinweis:</strong> Diese Anwendung stellt keine medizinische Beratung dar.</p>
      </div>
    </div>
  </div>

  <div class="py-20 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <h2 class="text-3xl font-bold text-center text-gray-900 mb-16">Alles für deine Supplement-Verwaltung</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        ${featureCards}
      </div>
    </div>
  </div>

  <div class="bg-gradient-to-r from-blue-600 to-blue-700 py-20">
    <div class="max-w-4xl mx-auto px-4 text-center">
      <h2 class="text-3xl font-bold text-white mb-4">Bereit für intelligente Supplement-Verwaltung?</h2>
      <p class="text-xl text-blue-100 mb-8">Starte jetzt kostenlos und optimiere deine Nahrungsergänzung.</p>
      <a href="/auth" class="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg inline-block">Jetzt kostenlos registrieren</a>
    </div>
  </div>

  <div class="py-16 bg-gray-50">
    <div class="max-w-4xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
      <div><i class="fas fa-shield-alt text-3xl text-green-600 mb-4"></i><h3 class="text-lg font-semibold mb-2">DSGVO-konform</h3><p class="text-gray-600">Ihre Daten sind sicher.</p></div>
      <div><i class="fas fa-university text-3xl text-blue-600 mb-4"></i><h3 class="text-lg font-semibold mb-2">Wissenschaftlich fundiert</h3><p class="text-gray-600">Basiert auf DGE-Empfehlungen.</p></div>
      <div><i class="fas fa-mobile-alt text-3xl text-purple-600 mb-4"></i><h3 class="text-lg font-semibold mb-2">Überall verfügbar</h3><p class="text-gray-600">Desktop und Mobile optimiert.</p></div>
    </div>
  </div>
</div>
${footer()}`

  return c.html(pageShell('Dein intelligenter Supplement Manager', body, ['/static/app.js']))
})

// ========================
// AUTH PAGE
// ========================

pages.get('/auth', (c) => {
  const body = `
<div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
  <div class="auth-container max-w-md w-full bg-white rounded-lg shadow-lg p-8">
    <div class="text-center mb-8">
      <a href="/" class="inline-flex items-center mb-4"><i class="fas fa-capsules text-3xl text-blue-600 mr-2"></i></a>
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Supplement Stack</h1>
      <p class="text-gray-600">Ihr intelligenter Supplement Manager</p>
    </div>

    <div class="flex mb-6 bg-gray-100 rounded-lg p-1">
      <button class="auth-tab flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors active" data-tab="login">Anmelden</button>
      <button class="auth-tab flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors" data-tab="register">Registrieren</button>
    </div>

    <div id="auth-message" class="hidden mb-4"></div>

    <div id="loginTab" class="tab-content">
      <form id="loginForm" class="space-y-4">
        <div>
          <label for="loginEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
          <input type="email" id="loginEmail" name="email" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        </div>
        <div>
          <label for="loginPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
          <input type="password" id="loginPassword" name="password" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        </div>
        <button type="submit" id="loginBtn" class="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium">Anmelden</button>
      </form>
      <div class="text-center mt-4">
        <button class="auth-tab text-blue-600 hover:text-blue-800 text-sm" data-tab="forgot">Passwort vergessen?</button>
      </div>
    </div>

    <div id="registerTab" class="tab-content hidden">
      <form id="registerForm" class="space-y-4">
        <div>
          <label for="registerEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
          <input type="email" id="registerEmail" name="email" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        </div>
        <div>
          <label for="registerPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
          <input type="password" id="registerPassword" name="password" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <p class="text-xs text-gray-500 mt-1">Min. 8 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen</p>
        </div>
        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
          <input type="password" id="confirmPassword" name="confirmPassword" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        </div>
        <button type="submit" id="registerBtn" class="w-full bg-green-600 text-white py-2.5 px-4 rounded-md hover:bg-green-700 transition-colors font-medium">Registrieren</button>
      </form>
    </div>

    <div id="forgotTab" class="tab-content hidden">
      <form id="forgotPasswordForm" class="space-y-4">
        <div>
          <label for="forgotEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
          <input type="email" id="forgotEmail" name="email" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        </div>
        <button type="submit" id="forgotBtn" class="w-full bg-gray-600 text-white py-2.5 px-4 rounded-md hover:bg-gray-700 transition-colors font-medium">Zurücksetzen</button>
      </form>
      <div class="text-center mt-4"><button class="auth-tab text-blue-600 hover:text-blue-800 text-sm" data-tab="login">Zurück zur Anmeldung</button></div>
    </div>

    <div class="mt-8 text-center"><a href="/" class="text-sm text-gray-600 hover:text-gray-800">&larr; Zurück zur Startseite</a></div>
    <div class="mt-4 p-3 bg-gray-50 rounded-md"><p class="text-xs text-gray-600 text-center">Mit der Nutzung stimmen Sie unseren <a href="/datenschutz" class="text-blue-600">Datenschutzbestimmungen</a> zu.</p></div>
  </div>
</div>`

  return c.html(pageShell('Anmeldung', body, ['/static/auth.js']))
})

// ========================
// DASHBOARD PAGE
// ========================

pages.get('/dashboard', (c) => {
  const body = `
${navBar()}
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div id="dashboard-loading" class="text-center py-16">
    <i class="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
    <p class="text-gray-500 text-lg">Dashboard wird geladen...</p>
  </div>

  <div id="dashboard-content" class="hidden">
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-2"><i class="fas fa-tachometer-alt mr-3 text-blue-600"></i>Ihr Dashboard</h1>
      <p class="text-xl text-gray-600">Verwalten Sie Ihre Supplements und Stacks</p>
    </div>

    <!-- Controls -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-2">Stack auswählen:</label>
          <select id="stack-selector" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
            <option value="">Lade Stacks...</option>
          </select>
        </div>
        <div class="flex flex-col sm:flex-row gap-3">
          <button id="btn-add-product" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium shadow-sm"><i class="fas fa-plus mr-2"></i>Produkt hinzufügen</button>
          <button id="btn-create-stack" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm font-medium shadow-sm"><i class="fas fa-magic mr-2"></i>Stack erstellen</button>
          <button id="btn-delete-stack" class="bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm cursor-not-allowed" disabled><i class="fas fa-trash mr-2"></i>Stack löschen</button>
        </div>
      </div>
    </div>

    <!-- Products grid -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-6"><i class="fas fa-layer-group mr-2 text-green-600"></i>Aktueller Stack</h2>
      <div id="stack-products-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div class="col-span-full text-center py-8"><i class="fas fa-box-open text-4xl text-gray-300 mb-4"></i><p class="text-gray-500">Wählen Sie einen Stack oder erstellen Sie einen neuen</p></div>
      </div>
    </div>

    <!-- Nutrient overview -->
    <div id="nutrient-section" class="bg-white rounded-lg shadow-md p-6 mb-8 hidden">
      <h2 class="text-2xl font-bold text-gray-900 mb-6"><i class="fas fa-chart-bar mr-2 text-purple-600"></i>Nährstoff-Übersicht</h2>
      <div id="nutrient-overview" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    </div>
  </div>

  <div id="dashboard-auth-required" class="hidden text-center py-16">
    <i class="fas fa-lock text-5xl text-gray-300 mb-4"></i>
    <h2 class="text-2xl font-bold text-gray-700 mb-2">Anmeldung erforderlich</h2>
    <p class="text-gray-500 mb-6">Bitte melden Sie sich an, um Ihr Dashboard zu sehen.</p>
    <a href="/auth" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">Zur Anmeldung</a>
  </div>
</div>
${footer()}`

  return c.html(pageShell('Dashboard', body, ['/static/app.js', '/static/dashboard.js']))
})

// ========================
// DEMO PAGE
// ========================

pages.get('/demo', (c) => {
  const body = `
${navBar()}
<div class="container mx-auto px-4 py-8">
  <div class="text-center mb-8">
    <h1 class="text-4xl font-bold text-gray-900 mb-2"><i class="fas fa-flask mr-3 text-blue-600"></i>Demo - Supplement Stack</h1>
    <p class="text-xl text-gray-600 mb-4">Testen Sie alle Funktionen unseres Supplement Managers</p>
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-4xl mx-auto">
      <p class="text-blue-800 text-sm"><i class="fas fa-info-circle mr-2"></i><strong>Interaktive Demo:</strong> Alle Funktionen sind voll funktionsfähig mit Demo-Daten.</p>
    </div>
  </div>

  <div class="bg-white rounded-lg shadow-md p-6 mb-8">
    <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">Stack auswählen:</label>
        <select id="stack-selector" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
          <option value="">Lade Stacks...</option>
        </select>
      </div>
      <div class="flex flex-col sm:flex-row gap-3">
        <button id="btn-add-product" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium shadow-sm"><i class="fas fa-plus mr-2"></i>Produkt hinzufügen</button>
        <button id="btn-create-stack" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm font-medium shadow-sm"><i class="fas fa-magic mr-2"></i>Stack erstellen</button>
        <button id="btn-delete-stack" class="bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm cursor-not-allowed" disabled><i class="fas fa-trash mr-2"></i>Stack löschen</button>
      </div>
    </div>
  </div>

  <div class="bg-white rounded-lg shadow-md p-6 mb-8">
    <h2 class="text-2xl font-bold text-gray-900 mb-6"><i class="fas fa-layer-group mr-2 text-green-600"></i>Demo Stack</h2>
    <div id="stack-products-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"></div>
  </div>

  <div class="bg-white rounded-lg shadow-md p-6 mb-8">
    <h2 class="text-2xl font-bold text-gray-900 mb-6"><i class="fas fa-chart-bar mr-2 text-purple-600"></i>Nährstoff-Übersicht</h2>
    <div id="nutrient-overview"><p class="text-gray-500 italic text-center py-8"><i class="fas fa-info-circle mr-2"></i>Wählen Sie einen Stack aus, um die Nährstoff-Analyse zu sehen</p></div>
  </div>

  <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200 text-center">
    <h3 class="text-lg font-semibold text-gray-900 mb-2"><i class="fas fa-rocket mr-2 text-blue-600"></i>Gefällt Ihnen die Demo?</h3>
    <p class="text-gray-600 mb-4">Registrieren Sie sich kostenlos und verwalten Sie Ihre echten Supplements!</p>
    <a href="/auth" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium inline-block"><i class="fas fa-user-plus mr-2"></i>Jetzt registrieren</a>
  </div>
</div>
${footer()}`

  return c.html(pageShell('Demo', body, ['/static/app.js', '/static/demo.js']))
})

// ========================
// PASSWORD RESET PAGE
// ========================

pages.get('/auth/reset-password', (c) => {
  const body = `
<div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
  <div class="auth-container max-w-md w-full bg-white rounded-lg shadow-lg p-8">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Neues Passwort</h1>
      <p class="text-gray-600">Erstellen Sie ein sicheres neues Passwort</p>
    </div>
    <div id="auth-message" class="hidden mb-4"></div>
    <form id="resetPasswordForm" class="space-y-4">
      <div>
        <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
        <input type="password" id="newPassword" name="password" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
      </div>
      <div>
        <label for="confirmNewPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
        <input type="password" id="confirmNewPassword" name="confirmPassword" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
      </div>
      <button type="submit" id="resetBtn" class="w-full bg-red-600 text-white py-2.5 px-4 rounded-md hover:bg-red-700 transition-colors font-medium">Passwort ändern</button>
    </form>
    <div class="mt-6 text-center"><a href="/auth" class="text-sm text-gray-600 hover:text-gray-800">&larr; Zurück zur Anmeldung</a></div>
  </div>
</div>`

  return c.html(pageShell('Passwort zurücksetzen', body, ['/static/auth.js']))
})

// ========================
// LEGAL PAGES
// ========================

function legalPageTemplate(title: string, content: string): string {
  const body = `
${navBar()}
<div class="max-w-4xl mx-auto px-4 py-12">
  <h1 class="text-3xl font-bold text-gray-900 mb-8">${title}</h1>
  <div class="bg-white rounded-lg shadow-md p-8 prose prose-gray max-w-none">${content}</div>
  <div class="mt-8 text-center"><a href="/" class="text-blue-600 hover:text-blue-800">&larr; Zurück zur Startseite</a></div>
</div>
${footer()}`

  return pageShell(title, body, ['/static/app.js'])
}

pages.get('/datenschutz', (c) => {
  return c.html(legalPageTemplate('Datenschutzerklärung', `
<p><strong>Stand:</strong> Januar 2025</p>
<h2>1. Verantwortlicher</h2>
<p>Supplement Stack<br>E-Mail: datenschutz@supplementstack.de</p>
<h2>2. Erhebung und Verarbeitung personenbezogener Daten</h2>
<p>Wir erheben folgende Daten bei der Registrierung: E-Mail-Adresse, verschlüsseltes Passwort. Diese Daten dienen ausschließlich der Bereitstellung unseres Dienstes.</p>
<h2>3. Zweck der Datenverarbeitung</h2>
<p>Ihre Daten werden ausschließlich zur Bereitstellung der Supplement-Verwaltung, Authentifizierung und Kontokommunikation verwendet.</p>
<h2>4. Datenspeicherung</h2>
<p>Daten werden auf Servern von Cloudflare (EU/US, unter Einhaltung des EU-US Data Privacy Frameworks) gespeichert. Passwörter werden gehasht gespeichert.</p>
<h2>5. Ihre Rechte</h2>
<p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15-21 DSGVO). Kontaktieren Sie uns unter datenschutz@supplementstack.de.</p>
<h2>6. Datenlöschung</h2>
<p>Sie können Ihr Konto und alle zugehörigen Daten jederzeit über die Profileinstellungen löschen. Die Löschung erfolgt unwiderruflich.</p>
<h2>7. Cookies</h2>
<p>Wir verwenden ausschließlich technisch notwendige Cookies für die Authentifizierung (HttpOnly, Secure). Es werden keine Tracking-Cookies eingesetzt.</p>`))
})

pages.get('/impressum', (c) => {
  return c.html(legalPageTemplate('Impressum', `
<h2>Angaben gemäß § 5 TMG</h2>
<p>Supplement Stack<br>Betrieben als privates Projekt</p>
<h2>Kontakt</h2>
<p>E-Mail: kontakt@supplementstack.de</p>
<h2>Haftungsausschluss</h2>
<p><strong>Medizinischer Hinweis:</strong> Die auf dieser Website bereitgestellten Informationen dienen ausschließlich Informationszwecken und stellen keine medizinische Beratung dar. Konsultieren Sie bei gesundheitlichen Fragen immer einen Arzt oder Apotheker.</p>
<h2>Haftung für Inhalte</h2>
<p>Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.</p>
<h2>Haftung für Links</h2>
<p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich.</p>`))
})

pages.get('/agb', (c) => {
  return c.html(legalPageTemplate('Allgemeine Geschäftsbedingungen', `
<p><strong>Stand:</strong> Januar 2025</p>
<h2>1. Geltungsbereich</h2>
<p>Diese AGB gelten für die Nutzung der Supplement Stack Plattform.</p>
<h2>2. Leistungsbeschreibung</h2>
<p>Supplement Stack bietet eine Plattform zur Verwaltung persönlicher Nahrungsergänzungsmittel. Der Service umfasst Produktverwaltung, Stack-Erstellung, Dosierungsempfehlungen und Preisberechnung.</p>
<h2>3. Registrierung</h2>
<p>Für die Nutzung ist eine Registrierung mit gültiger E-Mail-Adresse erforderlich. Der Nutzer ist für die Geheimhaltung seiner Zugangsdaten verantwortlich.</p>
<h2>4. Haftungsausschluss</h2>
<p>Supplement Stack stellt keine medizinische Beratung dar. Alle Dosierungsempfehlungen basieren auf öffentlichen Referenzwerten (DGE) und ersetzen keine ärztliche Beratung.</p>
<h2>5. Datenschutz</h2>
<p>Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer <a href="/datenschutz" class="text-blue-600">Datenschutzerklärung</a>.</p>
<h2>6. Kündigung</h2>
<p>Nutzer können ihr Konto jederzeit löschen. Alle personenbezogenen Daten werden dabei unwiderruflich entfernt.</p>
<h2>7. Anwendbares Recht</h2>
<p>Es gilt das Recht der Bundesrepublik Deutschland.</p>`))
})

export default pages
