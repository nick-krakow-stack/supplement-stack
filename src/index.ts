import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { authRoutes } from './routes/auth'
import { productRoutes } from './routes/products'
import { stackRoutes } from './routes/stacks'
import { wishlistRoutes } from './routes/wishlist'
import { affiliateRoutes } from './routes/affiliate'
import { adminRoutes } from './routes/admin'
import { apiRoutes } from './routes/api'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// API routes
app.route('/api', apiRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/protected/products', productRoutes)
app.route('/api/protected/stacks', stackRoutes)
app.route('/api/protected/wishlist', wishlistRoutes)
app.route('/api/affiliate', affiliateRoutes)
app.route('/api/admin', adminRoutes)

// Main application page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Supplement Stack - Dein Supplement-Manager</title>
        <meta name="description" content="Verwalte deine Supplements intelligent. Erstelle Stacks, vermeide Überdosierungen und finde die besten Angebote.">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#16a34a',
                  secondary: '#059669'
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <i class="fas fa-pills text-primary text-2xl mr-2"></i>
                        <span class="text-xl font-bold text-gray-800">Supplement Stack</span>
                    </div>
                    <div class="hidden md:flex items-center space-x-4">
                        <a href="#products" class="text-gray-600 hover:text-primary">Produkte</a>
                        <a href="#stacks" class="text-gray-600 hover:text-primary">Stacks</a>
                        <a href="#dashboard" class="text-gray-600 hover:text-primary">Dashboard</a>
                        <button id="loginBtn" class="bg-primary text-white px-4 py-2 rounded hover:bg-secondary">Anmelden</button>
                        <button id="registerBtn" class="border border-primary text-primary px-4 py-2 rounded hover:bg-primary hover:text-white">Registrieren</button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <section class="bg-gradient-to-r from-primary to-secondary text-white py-20">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <h1 class="text-5xl font-bold mb-6">Verwalte deine Supplements intelligent</h1>
                <p class="text-xl mb-8">Erstelle personalisierte Supplement-Stacks, vermeide Überdosierungen und finde die besten Angebote.</p>
                <button id="getStartedBtn" class="bg-white text-primary px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100">Jetzt starten</button>
            </div>
        </section>

        <!-- Features Section -->
        <section class="py-20">
            <div class="max-w-7xl mx-auto px-4">
                <div class="text-center mb-16">
                    <h2 class="text-3xl font-bold text-gray-800 mb-4">Funktionen</h2>
                    <p class="text-gray-600">Alles was du für dein Supplement-Management brauchst</p>
                </div>
                <div class="grid md:grid-cols-3 gap-8">
                    <div class="text-center p-6">
                        <i class="fas fa-layer-group text-primary text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Stacks erstellen</h3>
                        <p class="text-gray-600">Kombiniere Supplements zu sinnvollen Stacks mit automatischer Dosierungsberechnung.</p>
                    </div>
                    <div class="text-center p-6">
                        <i class="fas fa-exclamation-triangle text-primary text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Überdosierung vermeiden</h3>
                        <p class="text-gray-600">Automatische Warnungen bei zu hohen Dosierungen oder gefährlichen Kombinationen.</p>
                    </div>
                    <div class="text-center p-6">
                        <i class="fas fa-shopping-cart text-primary text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Smart Shopping</h3>
                        <p class="text-gray-600">Finde die besten Angebote und bestelle direkt über unsere Partner-Links.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- App Container -->
        <div id="app" class="min-h-screen bg-gray-50">
            <!-- Content will be loaded here by JavaScript -->
        </div>

        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-8">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <div class="mb-4">
                    <p class="text-yellow-400 font-semibold">⚠️ Wichtiger Hinweis</p>
                    <p class="text-sm">Diese Anwendung ersetzt keine medizinische Beratung. Konsultiere bei gesundheitlichen Fragen immer einen Arzt.</p>
                </div>
                <p class="text-gray-400">&copy; 2024 Supplement Stack. Alle Rechte vorbehalten.</p>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// Demo page
app.get('/demo', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Demo - Supplement Stack (UPDATED VERSION)</title>
        <meta name="description" content="Demo der Supplement Stack Anwendung mit nährstoffbasiertem System">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#16a34a',
                  secondary: '#059669'
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <i class="fas fa-pills text-primary text-2xl mr-2"></i>
                        <span class="text-xl font-bold text-gray-800">Supplement Stack</span>
                        <span class="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">DEMO</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-gray-600 hover:text-primary">← Zurück</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Demo Container -->
        <div class="max-w-7xl mx-auto px-4 py-6">
            <!-- Demo Header -->
            <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 mb-6">
                <h1 class="text-3xl font-bold mb-2">🧬 Nährstoffbasiertes Demo-System</h1>
                <p class="text-blue-100">Vollständige CRUD-Demo mit automatischer Dosierungsberechnung und intelligenten Stack-Workflows</p>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="flex items-center">
                        <i class="fas fa-box text-blue-500 text-2xl mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-600">Produkte</p>
                            <p class="text-xl font-bold" id="demo-products-count">0</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="flex items-center">
                        <i class="fas fa-layer-group text-green-500 text-2xl mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-600">Stacks</p>
                            <p class="text-xl font-bold" id="demo-stacks-count">0</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="flex items-center">
                        <i class="fas fa-euro-sign text-yellow-500 text-2xl mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-600">Monatlich</p>
                            <p class="text-xl font-bold" id="demo-monthly-cost">€0.00</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition-shadow" onclick="app.showWishlistModal()" title="Wunschliste anzeigen">
                    <div class="flex items-center">
                        <i class="fas fa-heart text-red-500 text-2xl mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-600">Wunschliste</p>
                            <p class="text-xl font-bold" id="demo-wishlist-count">0</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-3 mb-6">
                <button id="demo-add-product-main" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                    <i class="fas fa-plus mr-2"></i>
                    <span class="hidden sm:inline">Produkt hinzufügen</span>
                    <span class="sm:hidden">Produkt</span>
                </button>
                <button id="demo-create-stack-main" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center">
                    <i class="fas fa-layer-group mr-2"></i>
                    <span class="hidden sm:inline">Nährstoff-Stack</span>
                    <span class="sm:hidden">Stack</span>
                </button>
                <!-- Stack Selection Dropdown -->
                <div class="relative">
                    <select id="stack-selector" class="bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">Stack auswählen</option>
                        <!-- Optionen werden dynamisch von JavaScript hinzugefügt -->
                    </select>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Produkte Sektion -->
                <div class="lg:col-span-2">
                    <div class="bg-white rounded-lg shadow">
                        <div class="p-4 border-b border-gray-200">
                            <h2 class="text-xl font-semibold text-gray-800 flex items-center">
                                <i class="fas fa-box mr-2 text-blue-500"></i>
                                Produkte
                            </h2>
                        </div>
                        <div class="p-4">
                            <div id="demo-products-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <!-- Produkte werden hier eingefügt -->
                            </div>
                            <!-- Fallback wenn keine Produkte -->
                            <div id="demo-fallback" class="text-center py-8 text-gray-500" style="display: none;">
                                <i class="fas fa-box text-3xl mb-3"></i>
                                <p class="text-lg font-medium mb-2">Noch keine Produkte</p>
                                <p class="text-sm">Fügen Sie Ihr erstes Produkt hinzu!</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stacks Sektion -->
                <div>
                    <div class="bg-white rounded-lg shadow">
                        <div class="p-4 border-b border-gray-200">
                            <h2 class="text-xl font-semibold text-gray-800 flex items-center">
                                <i class="fas fa-layer-group mr-2 text-green-500"></i>
                                Meine Stacks
                            </h2>
                        </div>
                        <div class="p-4">
                            <div id="demo-stacks-grid" class="space-y-3">
                                <!-- Stacks werden hier eingefügt -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Scripts -->
        <script src="/static/demo-app.js"></script>
        <script src="/static/demo-modal.js"></script>
        <script src="/static/demo-fix.js"></script>
    </body>
    </html>
  `)
})

// Authentication page
app.get('/auth', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Anmeldung - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
        <style>
          body {
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%);
          }
          .form-input {
            @apply w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all;
          }
          .form-label {
            @apply block text-sm font-medium text-gray-700 mb-2;
          }
        </style>
    </head>
    <body class="min-h-screen flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <!-- Header -->
            <div class="text-center mb-8">
                <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                </div>
                <h1 class="text-2xl font-bold text-gray-900 mb-2">🏋️ Supplement Stack</h1>
                <p class="text-gray-600">Wissenschaftlich fundierte Gesundheits-Optimierung</p>
            </div>

            <!-- Login Form -->
            <form id="login-form" class="space-y-6">
                <h2 class="text-xl font-semibold text-center text-gray-800 mb-6">Anmelden</h2>
                
                <div>
                    <label class="form-label">E-Mail-Adresse</label>
                    <input type="email" name="email" required class="form-input" placeholder="deine@email.de">
                </div>
                
                <div>
                    <label class="form-label">Passwort</label>
                    <input type="password" name="password" required class="form-input" placeholder="Dein Passwort">
                </div>

                <button type="submit" class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all transform hover:scale-105">
                    🔑 Anmelden
                </button>

                <div class="text-center">
                    <button type="button" id="forgot-password-btn" class="text-red-600 hover:text-red-700 font-medium text-sm">
                        🔑 Passwort vergessen?
                    </button>
                </div>

                <div class="text-center">
                    <span class="text-gray-600 text-sm">Noch kein Konto?</span>
                    <button type="button" id="show-register" class="text-emerald-600 hover:text-emerald-700 font-medium ml-1">
                        Jetzt registrieren
                    </button>
                </div>
            </form>

            <!-- Register Form (initially hidden) -->
            <form id="register-form" class="space-y-6 hidden">
                <h2 class="text-xl font-semibold text-center text-gray-800 mb-6">Registrieren</h2>
                
                <div>
                    <label class="form-label">E-Mail-Adresse</label>
                    <input type="email" name="email" required class="form-input" placeholder="deine@email.de">
                </div>
                
                <div>
                    <label class="form-label">Passwort</label>
                    <input type="password" name="password" required minlength="8" class="form-input" placeholder="Mindestens 8 Zeichen">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Alter (optional)</label>
                        <input type="number" name="age" min="13" max="120" class="form-input" placeholder="25">
                    </div>
                    <div>
                        <label class="form-label">Gewicht (optional)</label>
                        <input type="number" name="weight" min="30" max="300" step="0.1" class="form-input" placeholder="70.5">
                    </div>
                </div>

                <div>
                    <label class="form-label">Ernährungsform (optional)</label>
                    <select name="diet_type" class="form-input">
                        <option value="omnivore">Omnivore (Alles)</option>
                        <option value="vegetarisch">Vegetarisch</option>
                        <option value="vegan">Vegan</option>
                    </select>
                </div>

                <button type="submit" class="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105">
                    🚀 Registrieren
                </button>

                <div class="text-center">
                    <span class="text-gray-600 text-sm">Bereits registriert?</span>
                    <button type="button" id="show-login" class="text-emerald-600 hover:text-emerald-700 font-medium ml-1">
                        Jetzt anmelden
                    </button>
                </div>
            </form>

            <!-- Back to Home -->
            <div class="mt-8 text-center">
                <a href="/" class="text-gray-500 hover:text-gray-700 font-medium">
                    ← Zurück zur Startseite
                </a>
            </div>
        </div>

        <!-- Loading State -->
        <div id="loading" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                <p id="loading-text" class="text-gray-600">Laden...</p>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// Password reset page
app.get('/reset-password', (c) => {
  return serveStatic({ root: './public', path: 'reset-password.html' })(c)
})

// Email verification fallback route (in case URL is missing /api/auth)
app.get('/verify-email', async (c) => {
  const token = c.req.query('token')
  if (token) {
    // Redirect to the correct API endpoint
    return c.redirect(`/api/auth/verify-email?token=${token}`)
  }
  return c.json({ error: 'Token fehlt' }, 400)
})

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.1-email-fix' 
  })
})

// Authenticated Dashboard Route (same UI as demo but with database integration)
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - Supplement Stack</title>
        <meta name="description" content="Dein persönliches Supplement Dashboard">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
        <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#16a34a',
                  secondary: '#059669'
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <i class="fas fa-pills text-primary text-2xl mr-2"></i>
                        <span class="text-xl font-bold text-gray-800">Supplement Stack</span>
                        <span class="ml-3 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">DASHBOARD</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/dashboard" class="text-primary font-medium">Dashboard</a>
                        <a href="/products" class="text-gray-600 hover:text-primary">Produkte</a>
                        <a href="/stacks" class="text-gray-600 hover:text-primary">Stacks</a>
                        <button id="logout-btn" class="text-red-600 hover:text-red-700 font-medium">
                            <i class="fas fa-sign-out-alt mr-1"></i>Abmelden
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Dashboard Container -->
        <div class="max-w-7xl mx-auto px-4 py-6">
            <!-- Dashboard Header -->
            <div class="bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg p-6 mb-6">
                <h1 class="text-3xl font-bold mb-2">🏋️ Dein Supplement Dashboard</h1>
                <p class="text-green-100">Verwalte deine Supplements intelligent mit wissenschaftlich fundierten Empfehlungen</p>
            </div>

            <!-- Loading State -->
            <div id="loading" class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p class="text-gray-600">Lade Dashboard-Daten...</p>
            </div>

            <!-- Error State -->
            <div id="error-state" class="hidden bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <div class="flex items-center text-red-800 mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span class="font-semibold">Fehler beim Laden der Dashboard-Daten</span>
                </div>
                <p id="error-message" class="text-red-700"></p>
                <button id="retry-btn" class="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                    Erneut versuchen
                </button>
            </div>

            <!-- Main Content (hidden initially) -->
            <div id="dashboard-content" class="hidden">
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-white rounded-lg shadow p-4">
                        <div class="flex items-center">
                            <i class="fas fa-box text-blue-500 text-2xl mr-3"></i>
                            <div>
                                <p class="text-sm text-gray-600">Produkte</p>
                                <p class="text-xl font-bold" id="products-count">0</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-4">
                        <div class="flex items-center">
                            <i class="fas fa-layer-group text-green-500 text-2xl mr-3"></i>
                            <div>
                                <p class="text-sm text-gray-600">Stacks</p>
                                <p class="text-xl font-bold" id="stacks-count">0</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-4">
                        <div class="flex items-center">
                            <i class="fas fa-euro-sign text-yellow-500 text-2xl mr-3"></i>
                            <div>
                                <p class="text-sm text-gray-600">Monatlich</p>
                                <p class="text-xl font-bold" id="monthly-cost">€0.00</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-4">
                        <div class="flex items-center">
                            <i class="fas fa-heart text-red-500 text-2xl mr-3"></i>
                            <div>
                                <p class="text-sm text-gray-600">Wunschliste</p>
                                <p class="text-xl font-bold" id="wishlist-count">0</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex flex-wrap gap-3 mb-6">
                    <button id="add-product-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                        <i class="fas fa-plus mr-2"></i>
                        <span class="hidden sm:inline">Produkt hinzufügen</span>
                        <span class="sm:hidden">Produkt</span>
                    </button>
                    <button id="create-stack-btn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center">
                        <i class="fas fa-layer-group mr-2"></i>
                        <span class="hidden sm:inline">Neuer Stack</span>
                        <span class="sm:hidden">Stack</span>
                    </button>
                    <!-- Stack Selection Dropdown -->
                    <div class="relative">
                        <select id="stack-selector" class="bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">Stack auswählen</option>
                            <!-- Options filled by JavaScript -->
                        </select>
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Products Section -->
                    <div class="lg:col-span-2">
                        <div class="bg-white rounded-lg shadow">
                            <div class="p-4 border-b border-gray-200">
                                <h2 class="text-xl font-semibold text-gray-800 flex items-center">
                                    <i class="fas fa-box mr-2 text-blue-500"></i>
                                    Meine Produkte
                                </h2>
                            </div>
                            <div class="p-4">
                                <div id="products-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <!-- Products filled by JavaScript -->
                                </div>
                                <!-- Fallback when no products -->
                                <div id="products-fallback" class="text-center py-8 text-gray-500" style="display: none;">
                                    <i class="fas fa-box text-3xl mb-3"></i>
                                    <p class="text-lg font-medium mb-2">Noch keine Produkte</p>
                                    <p class="text-sm">Fügen Sie Ihr erstes Produkt hinzu!</p>
                                    <button class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700" onclick="document.getElementById('add-product-btn').click()">
                                        <i class="fas fa-plus mr-2"></i>Produkt hinzufügen
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Stacks Section -->
                    <div>
                        <div class="bg-white rounded-lg shadow">
                            <div class="p-4 border-b border-gray-200">
                                <h2 class="text-xl font-semibold text-gray-800 flex items-center">
                                    <i class="fas fa-layer-group mr-2 text-green-500"></i>
                                    Meine Stacks
                                </h2>
                            </div>
                            <div class="p-4">
                                <div id="stacks-grid" class="space-y-3">
                                    <!-- Stacks filled by JavaScript -->
                                </div>
                                <!-- Fallback when no stacks -->
                                <div id="stacks-fallback" class="text-center py-8 text-gray-500" style="display: none;">
                                    <i class="fas fa-layer-group text-3xl mb-3"></i>
                                    <p class="text-lg font-medium mb-2">Noch keine Stacks</p>
                                    <p class="text-sm">Erstellen Sie Ihren ersten Stack!</p>
                                    <button class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700" onclick="document.getElementById('create-stack-btn').click()">
                                        <i class="fas fa-plus mr-2"></i>Stack erstellen
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Scripts -->
        <script src="/static/app.js"></script>
        <script src="/static/dashboard-app.js"></script>
    </body>
    </html>
  `)
})

// Authenticated Products Route
app.get('/products', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Produkte - Supplement Stack</title>
        <meta name="description" content="Verwalte deine Supplement-Produkte">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
        <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#16a34a',
                  secondary: '#059669'
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <i class="fas fa-pills text-primary text-2xl mr-2"></i>
                        <span class="text-xl font-bold text-gray-800">Supplement Stack</span>
                        <span class="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">PRODUKTE</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/dashboard" class="text-gray-600 hover:text-primary">Dashboard</a>
                        <a href="/products" class="text-primary font-medium">Produkte</a>
                        <a href="/stacks" class="text-gray-600 hover:text-primary">Stacks</a>
                        <button id="logout-btn" class="text-red-600 hover:text-red-700 font-medium">
                            <i class="fas fa-sign-out-alt mr-1"></i>Abmelden
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Products Container -->
        <div class="max-w-7xl mx-auto px-4 py-6">
            <!-- Products Header -->
            <div class="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-6 mb-6">
                <h1 class="text-3xl font-bold mb-2">📦 Meine Produkte</h1>
                <p class="text-blue-100">Verwalte deine Supplement-Produkte und optimiere deine Nährstoffzufuhr</p>
            </div>

            <!-- Action Bar -->
            <div class="bg-white rounded-lg shadow p-4 mb-6">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <button id="add-product-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                            <i class="fas fa-plus mr-2"></i>Produkt hinzufügen
                        </button>
                        <button id="bulk-actions-btn" class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center">
                            <i class="fas fa-check-square mr-2"></i>Auswahl-Modus
                        </button>
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="text" id="search-products" placeholder="Produkte durchsuchen..." class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <select id="filter-category" class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">Alle Kategorien</option>
                            <option value="Vitamine">Vitamine</option>
                            <option value="Mineralien">Mineralien</option>
                            <option value="Aminosäuren">Aminosäuren</option>
                            <option value="Fettsäuren">Fettsäuren</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Loading/Error States -->
            <div id="loading" class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p class="text-gray-600">Lade Produkte...</p>
            </div>

            <div id="error-state" class="hidden bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <div class="flex items-center text-red-800 mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span class="font-semibold">Fehler beim Laden der Produkte</span>
                </div>
                <p id="error-message" class="text-red-700"></p>
                <button id="retry-btn" class="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                    Erneut versuchen
                </button>
            </div>

            <!-- Products Grid -->
            <div id="products-content" class="hidden">
                <div id="products-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Products filled by JavaScript -->
                </div>
                
                <!-- Fallback when no products -->
                <div id="products-fallback" class="text-center py-12 text-gray-500" style="display: none;">
                    <i class="fas fa-box text-5xl mb-4"></i>
                    <h3 class="text-xl font-semibold mb-2">Noch keine Produkte</h3>
                    <p class="text-gray-400 mb-6">Fügen Sie Ihr erstes Supplement-Produkt hinzu, um zu beginnen.</p>
                    <button class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors" onclick="document.getElementById('add-product-btn').click()">
                        <i class="fas fa-plus mr-2"></i>Erstes Produkt hinzufügen
                    </button>
                </div>
            </div>
        </div>

        <!-- Scripts -->
        <script src="/static/app.js"></script>
        <script src="/static/products-app.js"></script>
    </body>
    </html>
  `)
})

// Authenticated Stacks Route  
app.get('/stacks', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Stacks - Supplement Stack</title>
        <meta name="description" content="Verwalte deine Supplement-Stacks">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
        <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#16a34a',
                  secondary: '#059669'
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <i class="fas fa-pills text-primary text-2xl mr-2"></i>
                        <span class="text-xl font-bold text-gray-800">Supplement Stack</span>
                        <span class="ml-3 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">STACKS</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/dashboard" class="text-gray-600 hover:text-primary">Dashboard</a>
                        <a href="/products" class="text-gray-600 hover:text-primary">Produkte</a>
                        <a href="/stacks" class="text-primary font-medium">Stacks</a>
                        <button id="logout-btn" class="text-red-600 hover:text-red-700 font-medium">
                            <i class="fas fa-sign-out-alt mr-1"></i>Abmelden
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Stacks Container -->
        <div class="max-w-7xl mx-auto px-4 py-6">
            <!-- Stacks Header -->
            <div class="bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg p-6 mb-6">
                <h1 class="text-3xl font-bold mb-2">🏗️ Meine Stacks</h1>
                <p class="text-green-100">Organisiere deine Supplements in intelligente Stacks für optimale Wirkung</p>
            </div>

            <!-- Action Bar -->
            <div class="bg-white rounded-lg shadow p-4 mb-6">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <button id="create-stack-btn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center">
                            <i class="fas fa-plus mr-2"></i>Neuer Stack
                        </button>
                        <button id="stack-templates-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                            <i class="fas fa-magic mr-2"></i>Vorlagen
                        </button>
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="text" id="search-stacks" placeholder="Stacks durchsuchen..." class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500">
                        <select id="sort-stacks" class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500">
                            <option value="name">Nach Name</option>
                            <option value="date">Nach Erstellungsdatum</option>
                            <option value="cost">Nach Kosten</option>
                            <option value="products">Nach Produktanzahl</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Loading/Error States -->
            <div id="loading" class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
                <p class="text-gray-600">Lade Stacks...</p>
            </div>

            <div id="error-state" class="hidden bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <div class="flex items-center text-red-800 mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span class="font-semibold">Fehler beim Laden der Stacks</span>
                </div>
                <p id="error-message" class="text-red-700"></p>
                <button id="retry-btn" class="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                    Erneut versuchen
                </button>
            </div>

            <!-- Stacks Grid -->
            <div id="stacks-content" class="hidden">
                <div id="stacks-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Stacks filled by JavaScript -->
                </div>
                
                <!-- Fallback when no stacks -->
                <div id="stacks-fallback" class="text-center py-12 text-gray-500" style="display: none;">
                    <i class="fas fa-layer-group text-5xl mb-4"></i>
                    <h3 class="text-xl font-semibold mb-2">Noch keine Stacks</h3>
                    <p class="text-gray-400 mb-6">Erstellen Sie Ihren ersten Supplement-Stack, um zu beginnen.</p>
                    <button class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors" onclick="document.getElementById('create-stack-btn').click()">
                        <i class="fas fa-plus mr-2"></i>Ersten Stack erstellen
                    </button>
                </div>
            </div>
        </div>

        <!-- Scripts -->
        <script src="/static/app.js"></script>
        <script src="/static/stacks-app.js"></script>
    </body>
    </html>
  `)
})

export default app