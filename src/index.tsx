import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings, SessionUser } from './types'

// Import route handlers
import { authRoutes } from './routes/auth'
import { productRoutes } from './routes/products'
import { stackRoutes } from './routes/stacks'
import { adminRoutes } from './routes/admin'
import { affiliateRoutes } from './routes/affiliate'
import { wishlistRoutes } from './routes/wishlist'

const app = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>()

// Enable CORS for API routes
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://supplementstack.de', 'https://*.supplementstack.de'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// JWT authentication middleware for protected routes
app.use('/api/protected/*', async (c, next) => {
  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET || 'fallback-secret-for-dev',
  })
  return jwtMiddleware(c, next)
})

// Apply user context middleware after JWT
app.use('/api/protected/*', async (c, next) => {
  const payload = c.get('jwtPayload') as any
  if (!payload || !payload.userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  // Fetch user from database
  const user = await c.env.DB.prepare('SELECT id, email, guideline_source FROM users WHERE id = ?')
    .bind(payload.userId)
    .first<SessionUser>()
  
  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }
  
  c.set('user', user)
  await next()
})

// Public API routes
app.route('/api/auth', authRoutes)
app.route('/api/affiliate', affiliateRoutes)

// Protected API routes
app.route('/api/protected/products', productRoutes)
app.route('/api/protected/stacks', stackRoutes)
app.route('/api/protected/wishlist', wishlistRoutes)
app.route('/api/protected/admin', adminRoutes)

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Main dashboard page
app.get('/dashboard', (c) => {
  return c.html(getDashboardHTML())
})

// Product management page
app.get('/products', (c) => {
  return c.html(getProductsHTML())
})

// Stack management page
app.get('/stacks', (c) => {
  return c.html(getStacksHTML())
})

// Admin page
app.get('/admin', (c) => {
  return c.html(getAdminHTML())
})

// Landing page
app.get('/', (c) => {
  return c.html(getLandingPageHTML())
})

// Login/Register page
app.get('/auth', (c) => {
  return c.html(getAuthHTML())
})

// HTML Template Functions
function getBaseHTML(title: string, content: string, activePage = '', isLandingPage = false) {
  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          /* Custom styles for supplement management */
          .supplement-card { @apply bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow; }
          .nav-item.active { @apply bg-blue-600 text-white; }
          .warning-high { @apply bg-red-100 border-red-500 text-red-700; }
          .warning-medium { @apply bg-yellow-100 border-yellow-500 text-yellow-700; }
          .safe { @apply bg-green-100 border-green-500 text-green-700; }
        </style>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <!-- DSGVO Disclaimer -->
        <div class="bg-blue-600 text-white text-center py-2 text-sm">
            <i class="fas fa-info-circle mr-2"></i>
            Diese Plattform bietet keine medizinische Beratung. Konsultieren Sie bei gesundheitlichen Fragen einen Arzt.
        </div>
        
        <!-- Navigation -->
        ${isLandingPage ? getLandingNavigationHTML() : getNavigationHTML(activePage)}
        
        <!-- Main Content -->
        <main class="max-w-7xl mx-auto px-4 py-8">
            ${content}
        </main>
        
        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-8 mt-16">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <p>&copy; 2024 Supplement Stack. Alle Rechte vorbehalten.</p>
                <div class="mt-4 space-x-4">
                    <a href="/legal/datenschutz" class="text-gray-400 hover:text-white">Datenschutz</a>
                    <a href="/legal/impressum" class="text-gray-400 hover:text-white">Impressum</a>
                    <a href="/legal/agb" class="text-gray-400 hover:text-white">AGB</a>
                </div>
            </div>
        </footer>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `
}

function getLandingNavigationHTML() {
  return `
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <a href="/" class="text-2xl font-bold text-blue-600">
                        <i class="fas fa-capsules mr-2"></i>Supplement Stack
                    </a>
                </div>
                
                <div class="flex items-center space-x-4">
                    <a href="#features" class="text-gray-700 hover:text-blue-600 transition-colors">Features</a>
                    <a href="/auth" class="text-gray-700 hover:text-blue-600 transition-colors">Anmelden</a>
                    <a href="/auth" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                        Registrieren
                    </a>
                </div>
            </div>
        </div>
    </nav>
  `
}

function getNavigationHTML(activePage: string) {
  const isLoggedIn = true // Will be determined by JS
  
  return `
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <a href="/" class="text-2xl font-bold text-blue-600">
                        <i class="fas fa-capsules mr-2"></i>Supplement Stack
                    </a>
                </div>
                
                <div id="nav-menu" class="hidden md:flex space-x-4">
                    <a href="/dashboard" class="nav-item px-4 py-2 rounded-md ${activePage === 'dashboard' ? 'active' : 'text-gray-700 hover:bg-gray-100'}">
                        <i class="fas fa-tachometer-alt mr-2"></i>Dashboard
                    </a>
                    <a href="/products" class="nav-item px-4 py-2 rounded-md ${activePage === 'products' ? 'active' : 'text-gray-700 hover:bg-gray-100'}">
                        <i class="fas fa-pills mr-2"></i>Produkte
                    </a>
                    <a href="/stacks" class="nav-item px-4 py-2 rounded-md ${activePage === 'stacks' ? 'active' : 'text-gray-700 hover:bg-gray-100'}">
                        <i class="fas fa-layer-group mr-2"></i>Stacks
                    </a>
                    <a href="/admin" class="nav-item px-4 py-2 rounded-md ${activePage === 'admin' ? 'active' : 'text-gray-700 hover:bg-gray-100'}">
                        <i class="fas fa-cog mr-2"></i>Admin
                    </a>
                </div>
                
                <div class="flex items-center space-x-4">
                    <button id="logout-btn" class="text-gray-700 hover:text-gray-900">
                        <i class="fas fa-sign-out-alt mr-1"></i>Abmelden
                    </button>
                </div>
            </div>
        </div>
    </nav>
  `
}

function getLandingPageHTML() {
  return getBaseHTML('Dein intelligenter Supplement Manager', `
    <!-- Hero Section -->
    <div class="bg-gradient-to-br from-blue-50 via-white to-blue-100 py-20">
        <div class="max-w-6xl mx-auto px-4 text-center">
            <div class="mb-8">
                <i class="fas fa-capsules text-6xl text-blue-600 mb-6"></i>
                <h1 class="text-5xl font-bold text-gray-900 mb-4">
                    Dein intelligenter<br>
                    <span class="text-blue-600">Supplement Manager</span>
                </h1>
                <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                    Verwalte deine Nahrungsergänzungsmittel professionell. Mit wissenschaftlich 
                    fundierten Dosierungsempfehlungen, Interaktionswarnungen und automatischer 
                    Preisberechnung.
                </p>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <a href="/auth" class="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg">
                    Kostenlos registrieren
                </a>
                <button id="demo-btn" class="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors">
                    Demo anschauen
                </button>
            </div>
            
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-4xl mx-auto">
                <div class="flex items-center justify-center">
                    <i class="fas fa-exclamation-triangle text-yellow-600 mr-3"></i>
                    <p class="text-yellow-800 text-sm">
                        <strong>Hinweis:</strong> Diese Anwendung stellt keine medizinische Beratung dar. Konsultieren Sie bei gesundheitlichen Fragen immer einen Arzt oder Apotheker.
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- Features Section -->
    <div id="features" class="py-20 bg-white">
        <div class="max-w-6xl mx-auto px-4">
            <h2 class="text-3xl font-bold text-center text-gray-900 mb-16">
                Alles für deine Supplement-Verwaltung
            </h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Feature 1: Produkt-Management -->
                <div class="text-center p-6">
                    <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-pills text-2xl text-blue-600"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Produkt-Management</h3>
                    <p class="text-gray-600 leading-relaxed">
                        Erfasse deine Supplements mit allen wichtigen Details. 
                        Automatische Dubletten-Erkennung und intelligente 
                        Produktkategorisierung.
                    </p>
                </div>

                <!-- Feature 2: Stack-Verwaltung -->
                <div class="text-center p-6">
                    <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-layer-group text-2xl text-green-600"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Stack-Verwaltung</h3>
                    <p class="text-gray-600 leading-relaxed">
                        Erstelle individuelle Supplement-Kombinationen mit intelligenten 
                        Dosierungsempfehlungen basierend auf DGE oder Studien.
                    </p>
                </div>

                <!-- Feature 3: Interaktions-Warnungen -->
                <div class="text-center p-6">
                    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-exclamation-triangle text-2xl text-red-600"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Interaktions-Warnungen</h3>
                    <p class="text-gray-600 leading-relaxed">
                        Erhalte automatische Warnungen bei Überdosierungen oder negativen 
                        Wechselwirkungen zwischen verschiedenen Wirkstoffen.
                    </p>
                </div>

                <!-- Feature 4: Preisberechnung -->
                <div class="text-center p-6">
                    <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-calculator text-2xl text-purple-600"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Preisberechnung</h3>
                    <p class="text-gray-600 leading-relaxed">
                        Automatische Berechnung der Kosten pro Tag, Woche und Monat. 
                        Verbrauchsübersicht und Nachkauf-Erinnerungen.
                    </p>
                </div>

                <!-- Feature 5: Intelligente Analyse -->
                <div class="text-center p-6">
                    <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-chart-line text-2xl text-yellow-600"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Intelligente Analyse</h3>
                    <p class="text-gray-600 leading-relaxed">
                        Analysiere deine Supplement-Aufnahme und erkenne Über- oder 
                        Unterversorgung basierend auf Referenzwerten.
                    </p>
                </div>

                <!-- Feature 6: Wissensdatenbank -->
                <div class="text-center p-6">
                    <div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-book text-2xl text-indigo-600"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Wissensdatenbank</h3>
                    <p class="text-gray-600 leading-relaxed">
                        Detaillierte Informationen zu jedem Nährstoff: Dosierungsempfehlungen und 
                        Mangelerscheinungen.
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-gradient-to-r from-blue-600 to-blue-700 py-20">
        <div class="max-w-4xl mx-auto px-4 text-center">
            <h2 class="text-3xl font-bold text-white mb-4">
                Bereit für intelligente Supplement-Verwaltung?
            </h2>
            <p class="text-xl text-blue-100 mb-8">
                Starte jetzt kostenlos und optimiere deine Nahrungsergänzung.
            </p>
            <a href="/auth" class="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg inline-block">
                Jetzt kostenlos registrieren
            </a>
        </div>
    </div>

    <!-- Trust Section -->
    <div class="py-16 bg-gray-50">
        <div class="max-w-4xl mx-auto px-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div>
                    <i class="fas fa-shield-alt text-3xl text-green-600 mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">DSGVO-konform</h3>
                    <p class="text-gray-600">Deine Daten sind sicher und werden nur für die Funktionalität verwendet.</p>
                </div>
                <div>
                    <i class="fas fa-university text-3xl text-blue-600 mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Wissenschaftlich fundiert</h3>
                    <p class="text-gray-600">Basiert auf DGE-Empfehlungen und aktuellen Forschungsergebnissen.</p>
                </div>
                <div>
                    <i class="fas fa-mobile-alt text-3xl text-purple-600 mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Überall verfügbar</h3>
                    <p class="text-gray-600">Optimiert für Desktop und Mobile - immer und überall nutzbar.</p>
                </div>
            </div>
        </div>
    </div>
  `, '', true)
}

function getAuthHTML() {
  return getBaseHTML('Anmeldung - Supplement Stack', `
    <div class="min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full bg-white rounded-lg shadow-md p-8">
            <div class="text-center mb-8">
                <i class="fas fa-capsules text-4xl text-blue-600 mb-4"></i>
                <h1 class="text-3xl font-bold text-gray-800">Supplement Stack</h1>
                <p class="text-gray-600 mt-2">Verwalten Sie Ihre Nahrungsergänzungsmittel intelligent</p>
            </div>
            
            <!-- Login Form -->
            <form id="login-form" class="space-y-4">
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700">E-Mail</label>
                    <input type="email" id="email" name="email" required 
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700">Passwort</label>
                    <input type="password" id="password" name="password" required 
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                </div>
                <button type="submit" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                    <i class="fas fa-sign-in-alt mr-2"></i>Anmelden
                </button>
            </form>
            
            <div class="mt-6 text-center">
                <p class="text-sm text-gray-600">
                    Noch kein Konto? 
                    <a href="#" id="show-register" class="text-blue-600 hover:text-blue-500">Registrieren</a>
                </p>
            </div>
            
            <!-- Registration Form (hidden by default) -->
            <form id="register-form" class="space-y-4 hidden">
                <h2 class="text-xl font-semibold text-center mb-4">Registrierung</h2>
                <div>
                    <label for="reg-email" class="block text-sm font-medium text-gray-700">E-Mail</label>
                    <input type="email" id="reg-email" name="email" required 
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="reg-password" class="block text-sm font-medium text-gray-700">Passwort</label>
                    <input type="password" id="reg-password" name="password" required minlength="8"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="reg-age" class="block text-sm font-medium text-gray-700">Alter</label>
                        <input type="number" id="reg-age" name="age" min="16" max="100"
                               class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label for="reg-weight" class="block text-sm font-medium text-gray-700">Gewicht (kg)</label>
                        <input type="number" id="reg-weight" name="weight" min="30" max="200" step="0.1"
                               class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    </div>
                </div>
                <div>
                    <label for="reg-diet" class="block text-sm font-medium text-gray-700">Ernährungsweise</label>
                    <select id="reg-diet" name="diet_type"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        <option value="omnivore">Omnivor (Alles)</option>
                        <option value="vegetarisch">Vegetarisch</option>
                        <option value="vegan">Vegan</option>
                    </select>
                </div>
                <button type="submit" class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors">
                    <i class="fas fa-user-plus mr-2"></i>Registrieren
                </button>
                <button type="button" id="show-login" class="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors">
                    Zurück zur Anmeldung
                </button>
            </form>
        </div>
    </div>
  `)
}

function getDashboardHTML() {
  return getBaseHTML('Dashboard', `
    <div class="space-y-8">
        <h1 class="text-3xl font-bold text-gray-800">
            <i class="fas fa-tachometer-alt mr-3"></i>Dashboard
        </h1>
        
        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-blue-500 bg-opacity-10">
                        <i class="fas fa-pills text-blue-500 text-xl"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">Produkte</p>
                        <p id="products-count" class="text-2xl font-semibold text-gray-900">-</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-green-500 bg-opacity-10">
                        <i class="fas fa-layer-group text-green-500 text-xl"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">Stacks</p>
                        <p id="stacks-count" class="text-2xl font-semibold text-gray-900">-</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-yellow-500 bg-opacity-10">
                        <i class="fas fa-euro-sign text-yellow-500 text-xl"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">Monatliche Kosten</p>
                        <p id="monthly-cost" class="text-2xl font-semibold text-gray-900">-</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-red-500 bg-opacity-10">
                        <i class="fas fa-heart text-red-500 text-xl"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-500">Wunschliste</p>
                        <p id="wishlist-count" class="text-2xl font-semibold text-gray-900">-</p>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Recent Activity & Next Actions -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">Aktuelle Stacks</h2>
                </div>
                <div id="recent-stacks" class="p-6">
                    <div class="text-gray-500 text-center py-4">Lade Daten...</div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">Bald aufgebraucht</h2>
                </div>
                <div id="running-low" class="p-6">
                    <div class="text-gray-500 text-center py-4">Lade Daten...</div>
                </div>
            </div>
        </div>
    </div>
  `, 'dashboard')
}

function getProductsHTML() {
  return getBaseHTML('Produkte', `
    <div class="space-y-6">
        <div class="flex justify-between items-center">
            <h1 class="text-3xl font-bold text-gray-800">
                <i class="fas fa-pills mr-3"></i>Meine Produkte
            </h1>
            <button id="add-product-btn" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                <i class="fas fa-plus mr-2"></i>Neues Produkt
            </button>
        </div>
        
        <!-- Search and Filter -->
        <div class="bg-white p-4 rounded-lg shadow">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" id="search-products" placeholder="Produkt suchen..." 
                       class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <select id="filter-brand" class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    <option value="">Alle Marken</option>
                </select>
                <select id="filter-form" class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    <option value="">Alle Darreichungsformen</option>
                    <option value="Kapsel">Kapseln</option>
                    <option value="Tropfen">Tropfen</option>
                    <option value="Pulver">Pulver</option>
                    <option value="Öl">Öl</option>
                </select>
            </div>
        </div>
        
        <!-- Products Grid -->
        <div id="products-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="text-center py-8 text-gray-500">Lade Produkte...</div>
        </div>
    </div>
  `, 'products')
}

function getStacksHTML() {
  return getBaseHTML('Stacks', `
    <div class="space-y-6">
        <div class="flex justify-between items-center">
            <h1 class="text-3xl font-bold text-gray-800">
                <i class="fas fa-layer-group mr-3"></i>Meine Stacks
            </h1>
            <button id="add-stack-btn" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                <i class="fas fa-plus mr-2"></i>Neuer Stack
            </button>
        </div>
        
        <!-- Stacks Grid -->
        <div id="stacks-grid" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="text-center py-8 text-gray-500">Lade Stacks...</div>
        </div>
    </div>
  `, 'stacks')
}

function getAdminHTML() {
  return getBaseHTML('Administration', `
    <div class="space-y-6">
        <h1 class="text-3xl font-bold text-gray-800">
            <i class="fas fa-cog mr-3"></i>Administration
        </h1>
        
        <!-- Admin Tabs -->
        <div class="bg-white rounded-lg shadow">
            <div class="border-b border-gray-200">
                <nav class="flex space-x-8 px-6" aria-label="Tabs">
                    <button class="admin-tab active py-4 px-1 border-b-2 font-medium text-sm" data-tab="duplicates">
                        Dubletten
                    </button>
                    <button class="admin-tab py-4 px-1 border-b-2 font-medium text-sm" data-tab="affiliates">
                        Affiliate-Links
                    </button>
                    <button class="admin-tab py-4 px-1 border-b-2 font-medium text-sm" data-tab="nutrients">
                        Nährstoffe
                    </button>
                    <button class="admin-tab py-4 px-1 border-b-2 font-medium text-sm" data-tab="statistics">
                        Statistiken
                    </button>
                </nav>
            </div>
            
            <!-- Tab Content -->
            <div id="admin-content" class="p-6">
                <div class="text-gray-500 text-center py-4">Lade Admin-Daten...</div>
            </div>
        </div>
    </div>
  `, 'admin')
}

export default app