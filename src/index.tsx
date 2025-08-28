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

// Protected auth routes
app.get('/api/protected/auth/me', async (c) => {
  const user = c.get('user')
  return c.json({ 
    success: true,
    user: {
      id: user.id,
      email: user.email,
      guideline_source: user.guideline_source
    }
  })
})

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

// Demo page
app.get('/demo', (c) => {
  return c.html(getDemoHTML())
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
          
          /* Mobile-optimiertes Design */
          @media (max-width: 768px) {
            /* Reduzierte Padding für Mobile */
            .container-mobile { @apply px-2; }
            
            /* Responsive Text */
            .text-responsive { @apply text-sm sm:text-base; }
            
            /* Responsive Grid */
            .grid-responsive { @apply grid-cols-1 sm:grid-cols-2 lg:grid-cols-3; }
            
            /* Mobile Navigation */
            #nav-menu { @apply hidden; }
            
            /* Kompakte Cards */
            .card-mobile { @apply p-3 sm:p-4 lg:p-6; }
            
            /* Responsive Buttons */
            .btn-mobile { @apply px-3 py-2 text-sm sm:px-4 sm:py-2 sm:text-base; }
          }
          
          /* Utility Classes */
          .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          
          .line-clamp-3 {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          
          /* Mobile-friendly modals */
          .modal-overlay {
            @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4;
          }
          
          .modal-container {
            @apply bg-white rounded-lg shadow-xl w-full max-w-lg sm:max-w-2xl max-h-[95vh] overflow-y-auto;
          }
          
          /* Touch-friendly elements */
          .touch-target {
            min-height: 44px;
            min-width: 44px;
          }
          
          /* Improved form styling */
          .form-input {
            @apply w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base;
          }
          
          .form-label {
            @apply block text-sm font-medium text-gray-700 mb-1;
          }
          
          /* Responsive spacing */
          .space-mobile { @apply space-y-3 sm:space-y-4 lg:space-y-6; }
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
                <p>&copy; 2025 Supplement Stack. Alle Rechte vorbehalten.</p>
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
                    <a href="/" class="text-xl sm:text-2xl font-bold text-blue-600">
                        <i class="fas fa-capsules mr-2"></i>
                        <span class="hidden sm:inline">Supplement Stack</span>
                        <span class="sm:hidden">SS</span>
                    </a>
                </div>
                
                <div class="flex items-center space-x-2 sm:space-x-4">
                    <a href="#features" class="hidden sm:inline text-gray-700 hover:text-blue-600 transition-colors">Features</a>
                    <button onclick="app.openDemo()" class="text-gray-700 hover:text-blue-600 transition-colors text-sm sm:text-base">Demo</button>
                    <a href="/auth" class="bg-blue-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base">
                        Anmelden
                    </a>
                </div>
            </div>
        </div>
    </nav>
  `
}

function getNavigationHTML(activePage: string) {
  return `
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <a href="/" class="text-xl sm:text-2xl font-bold text-blue-600">
                        <i class="fas fa-capsules mr-2"></i>
                        <span class="hidden sm:inline">Supplement Stack</span>
                        <span class="sm:hidden">SS</span>
                    </a>
                </div>
                
                <!-- Mobile Menu Button -->
                <button id="mobile-menu-btn" class="md:hidden p-2 text-gray-600 hover:text-blue-600">
                    <i class="fas fa-bars text-xl"></i>
                </button>
                
                <!-- Desktop Navigation -->
                <div id="nav-menu" class="hidden md:flex space-x-2 lg:space-x-4">
                    <!-- Menü-Items werden basierend auf Login-Status angezeigt -->
                </div>
                
                <div id="nav-actions" class="hidden md:flex items-center space-x-2 sm:space-x-4">
                    <!-- Login/Logout-Buttons werden dynamisch geladen -->
                </div>
            </div>
            
            <!-- Mobile Navigation Menu -->
            <div id="mobile-menu" class="hidden md:hidden border-t border-gray-200 py-4">
                <div id="mobile-nav-menu" class="space-y-2">
                    <!-- Mobile Menü-Items werden dynamisch geladen -->
                </div>
                <div id="mobile-nav-actions" class="pt-4 border-t border-gray-200 mt-4">
                    <!-- Mobile Login/Logout-Buttons werden dynamisch geladen -->  
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
                <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
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
                <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
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
                <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
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
                <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
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
                <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
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
                <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
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
    <div class="space-y-4 sm:space-y-6">
        <!-- Mobile-optimierte Überschrift -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 sm:mb-0">
                <i class="fas fa-tachometer-alt mr-2"></i>Dashboard
            </h1>
            <div class="text-sm text-gray-500">
                Letztes Update: <span id="last-update">-</span>
            </div>
        </div>
        
        <!-- Kompakte Mobile Stats -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div class="bg-white rounded-lg shadow p-3 sm:p-4">
                <div class="flex flex-col sm:flex-row sm:items-center">
                    <div class="p-2 sm:p-3 rounded-full bg-blue-500 bg-opacity-10 mb-2 sm:mb-0 self-start">
                        <i class="fas fa-pills text-blue-500 text-lg"></i>
                    </div>
                    <div class="sm:ml-3">
                        <p class="text-xs sm:text-sm font-medium text-gray-500">Produkte</p>
                        <p id="products-count" class="text-xl sm:text-2xl font-semibold text-gray-900">-</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-3 sm:p-4">
                <div class="flex flex-col sm:flex-row sm:items-center">
                    <div class="p-2 sm:p-3 rounded-full bg-green-500 bg-opacity-10 mb-2 sm:mb-0 self-start">
                        <i class="fas fa-layer-group text-green-500 text-lg"></i>
                    </div>
                    <div class="sm:ml-3">
                        <p class="text-xs sm:text-sm font-medium text-gray-500">Stacks</p>
                        <p id="stacks-count" class="text-xl sm:text-2xl font-semibold text-gray-900">-</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-3 sm:p-4 col-span-2 lg:col-span-1">
                <div class="flex flex-col sm:flex-row sm:items-center">
                    <div class="p-2 sm:p-3 rounded-full bg-yellow-500 bg-opacity-10 mb-2 sm:mb-0 self-start">
                        <i class="fas fa-euro-sign text-yellow-500 text-lg"></i>
                    </div>
                    <div class="sm:ml-3">
                        <p class="text-xs sm:text-sm font-medium text-gray-500">Monatlich</p>
                        <p id="monthly-cost" class="text-xl sm:text-2xl font-semibold text-green-600">-</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-3 sm:p-4 lg:block hidden">
                <div class="flex flex-col sm:flex-row sm:items-center">
                    <div class="p-2 sm:p-3 rounded-full bg-red-500 bg-opacity-10 mb-2 sm:mb-0 self-start">
                        <i class="fas fa-heart text-red-500 text-lg"></i>
                    </div>
                    <div class="sm:ml-3">
                        <p class="text-xs sm:text-sm font-medium text-gray-500">Wunschliste</p>
                        <p id="wishlist-count" class="text-xl sm:text-2xl font-semibold text-gray-900">-</p>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Schnellaktionen -->
        <div class="bg-white rounded-lg shadow p-4">
            <h2 class="text-lg font-semibold text-gray-900 mb-3">Schnellaktionen</h2>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button onclick="app.showAddProductModal()" class="flex flex-col items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-center">
                    <i class="fas fa-plus text-blue-600 text-xl mb-2"></i>
                    <span class="text-sm font-medium text-blue-700">Produkt hinzufügen</span>
                </button>
                <button onclick="app.showAddStackModal()" class="flex flex-col items-center p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-center">
                    <i class="fas fa-layer-group text-green-600 text-xl mb-2"></i>
                    <span class="text-sm font-medium text-green-700">Stack erstellen</span>
                </button>
                <a href="/products" class="flex flex-col items-center p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-center">
                    <i class="fas fa-pills text-purple-600 text-xl mb-2"></i>
                    <span class="text-sm font-medium text-purple-700">Alle Produkte</span>
                </a>
                <a href="/stacks" class="flex flex-col items-center p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-center">
                    <i class="fas fa-th-list text-orange-600 text-xl mb-2"></i>
                    <span class="text-sm font-medium text-orange-700">Alle Stacks</span>
                </a>
            </div>
        </div>
        
        <!-- Aktuelle Stacks - Mobile optimiert -->
        <div class="bg-white rounded-lg shadow">
            <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 class="text-lg font-semibold text-gray-900">Aktuelle Stacks</h2>
                <a href="/stacks" class="text-sm text-blue-600 hover:text-blue-500">Alle anzeigen</a>
            </div>
            <div id="recent-stacks" class="p-4">
                <div class="text-gray-500 text-center py-4">Lade Daten...</div>
            </div>
        </div>
        
        <!-- Wichtige Hinweise - Nur bei Bedarf -->
        <div id="important-notices" class="hidden">
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div class="flex items-start">
                    <i class="fas fa-exclamation-triangle text-yellow-600 mr-3 mt-0.5"></i>
                    <div>
                        <h3 class="font-medium text-yellow-800">Hinweise</h3>
                        <div id="notices-content" class="text-yellow-700 text-sm mt-1"></div>
                    </div>
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
    <div class="space-y-4 sm:space-y-6">
        <!-- Mobile-optimierte Überschrift -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 sm:mb-0">
                <i class="fas fa-layer-group mr-2"></i>Meine Stacks
            </h1>
            <button id="add-stack-btn" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors w-full sm:w-auto">
                <i class="fas fa-plus mr-2"></i>Neuer Stack
            </button>
        </div>
        
        <!-- Stack-Filter (nur bei vielen Stacks) -->
        <div id="stack-filters" class="bg-white p-4 rounded-lg shadow hidden">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" id="search-stacks" placeholder="Stack suchen..." 
                       class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500">
                <select id="sort-stacks" class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500">
                    <option value="created">Neueste zuerst</option>
                    <option value="name">Name A-Z</option>
                    <option value="cost">Kosten aufsteigend</option>
                </select>
                <select id="filter-cost" class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500">
                    <option value="">Alle Preisklassen</option>
                    <option value="0-20">€0 - €20</option>
                    <option value="20-50">€20 - €50</option>
                    <option value="50+">€50+</option>
                </select>
            </div>
        </div>
        
        <!-- Mobile-optimierte Stacks Grid -->
        <div id="stacks-grid" class="grid grid-cols-1 gap-4 sm:gap-6">
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

function getDemoBaseHTML(title: string, content: string) {
  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          /* Custom styles for supplement management */
          .supplement-card { @apply bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow; }
          .nav-item.active { @apply bg-blue-600 text-white; }
          .warning-high { @apply bg-red-100 border-red-500 text-red-700; }
          .warning-medium { @apply bg-yellow-100 border-yellow-500 text-yellow-700; }
          .safe { @apply bg-green-100 border-green-500 text-green-700; }
          
          /* Mobile-optimiertes Design für Demo */
          @media (max-width: 768px) {
            .container-mobile { @apply px-2; }
            .card-mobile { @apply p-3; }
            .btn-mobile { @apply px-3 py-2 text-sm; }
            .text-responsive { @apply text-sm; }
          }
          
          /* Modal Styles */
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 8px;
          }
          
          .modal-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            width: 100%;
            max-width: 32rem;
            max-height: 95vh;
            overflow-y: auto;
          }
          
          @media (min-width: 640px) {
            .modal-container {
              max-width: 42rem;
              padding: 16px;
            }
            .modal-overlay {
              padding: 16px;
            }
          }
          
          /* Touch-friendly elements */
          .touch-target {
            min-height: 44px;
            min-width: 44px;
          }
          
          /* Form styling */
          .form-input {
            @apply w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base;
          }
          
          .form-label {
            @apply block text-sm font-medium text-gray-700 mb-1;
          }
        </style>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <!-- DSGVO Disclaimer -->
        <div class="bg-blue-600 text-white text-center py-2 text-sm">
            <i class="fas fa-info-circle mr-2"></i>
            Diese Plattform bietet keine medizinische Beratung. Konsultieren Sie bei gesundheitlichen Fragen einen Arzt.
        </div>
        
        <!-- Main Content -->
        <main class="max-w-7xl mx-auto container-mobile py-4 sm:py-8">
            ${content}
        </main>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/demo-modal.js"></script>
    </body>
    </html>
  `
}

function getDemoHTML() {
  return getDemoBaseHTML('Demo - Supplement Stack', `
    <!-- Demo Header - Mobile optimiert -->
    <div class="bg-blue-600 text-white py-3 sm:py-4">
        <div class="max-w-6xl mx-auto px-2 sm:px-4">
            <!-- Mobile Header -->
            <div class="flex flex-col space-y-3 sm:hidden">
                <div class="flex items-center justify-between">
                    <h1 class="text-lg font-bold">
                        <i class="fas fa-capsules mr-2"></i>Supplement Stack Demo
                    </h1>
                </div>
                <!-- Immer sichtbare Mobile-Buttons -->
                <div class="grid grid-cols-2 gap-2">
                    <button id="demo-create-stack-mobile" class="bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700 transition-colors text-xs">
                        <i class="fas fa-flask mr-1"></i>Nährstoff-Stack
                    </button>
                    <button id="demo-add-product-mobile" class="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors text-xs">
                        <i class="fas fa-plus mr-1"></i>Produkt hinzufügen
                    </button>
                </div>
            </div>
            
            <!-- Desktop Header -->
            <div class="hidden sm:flex justify-between items-center">
                <h1 class="text-xl sm:text-2xl font-bold">
                    <i class="fas fa-capsules mr-2"></i>Supplement Stack - Funktionale Demo
                </h1>
                <div class="space-x-2 sm:space-x-4">
                    <button id="demo-create-stack-desktop" class="bg-purple-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-md hover:bg-purple-700 transition-colors text-sm sm:text-base">
                        <i class="fas fa-flask mr-1 sm:mr-2"></i><span class="hidden sm:inline">Nährstoff-Stack</span><span class="sm:hidden">Stack</span>
                    </button>
                    <button id="demo-add-product-desktop" class="bg-green-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-md hover:bg-green-700 transition-colors text-sm sm:text-base">
                        <i class="fas fa-plus mr-1 sm:mr-2"></i><span class="hidden sm:inline">Produkt hinzufügen</span><span class="sm:hidden">Hinzufügen</span>
                    </button>
                    <a href="/auth" target="_parent" class="bg-white text-blue-600 px-4 py-2 sm:px-6 sm:py-2 rounded-md hover:bg-gray-100 transition-colors font-semibold text-sm sm:text-base">
                        Vollversion nutzen
                    </a>
                </div>
            </div>
        </div>
    </div>

    <!-- Demo Dashboard -->
    <div class="space-y-8">
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div class="flex items-center">
                <i class="fas fa-info-circle text-yellow-600 mr-3"></i>
                <div>
                    <h3 class="font-semibold text-yellow-800">Demo-Modus</h3>
                    <p class="text-yellow-700">Dies ist eine Demonstration der Supplement Stack Funktionen. Keine Daten werden gespeichert.</p>
                </div>
            </div>
        </div>

        <!-- Demo Stats - Mobile optimiert -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
            <div class="bg-white rounded-lg shadow p-3 sm:p-6">
                <div class="flex flex-col sm:flex-row sm:items-center">
                    <div class="p-2 sm:p-3 rounded-full bg-blue-500 bg-opacity-10 mb-2 sm:mb-0 self-start">
                        <i class="fas fa-pills text-blue-500 text-lg sm:text-xl"></i>
                    </div>
                    <div class="sm:ml-4">
                        <p class="text-xs sm:text-sm font-medium text-gray-500">Produkte</p>
                        <p id="demo-products-count" class="text-xl sm:text-2xl font-semibold text-gray-900">6</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-3 sm:p-6">
                <div class="flex flex-col sm:flex-row sm:items-center">
                    <div class="p-2 sm:p-3 rounded-full bg-green-500 bg-opacity-10 mb-2 sm:mb-0 self-start">
                        <i class="fas fa-layer-group text-green-500 text-lg sm:text-xl"></i>
                    </div>
                    <div class="sm:ml-4">
                        <p class="text-xs sm:text-sm font-medium text-gray-500">Stacks</p>
                        <p id="demo-stacks-count" class="text-xl sm:text-2xl font-semibold text-gray-900">2</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-3 sm:p-6 col-span-2 sm:col-span-1">
                <div class="flex flex-col sm:flex-row sm:items-center">
                    <div class="p-2 sm:p-3 rounded-full bg-yellow-500 bg-opacity-10 mb-2 sm:mb-0 self-start">
                        <i class="fas fa-euro-sign text-yellow-500 text-lg sm:text-xl"></i>
                    </div>
                    <div class="sm:ml-4">
                        <p class="text-xs sm:text-sm font-medium text-gray-500">Monatlich</p>
                        <p id="demo-monthly-cost" class="text-xl sm:text-2xl font-semibold text-green-600">€26.62</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-3 sm:p-6 hidden sm:block">
                <div class="flex flex-col sm:flex-row sm:items-center">
                    <div class="p-2 sm:p-3 rounded-full bg-red-500 bg-opacity-10 mb-2 sm:mb-0 self-start">
                        <i class="fas fa-heart text-red-500 text-lg sm:text-xl"></i>
                    </div>
                    <div class="sm:ml-4">
                        <p class="text-xs sm:text-sm font-medium text-gray-500">Wunschliste</p>
                        <p id="demo-wishlist-count" class="text-xl sm:text-2xl font-semibold text-gray-900">3</p>
                    </div>
                </div>
            </div>
        </div>



        <!-- Stack-Bereich wie im Screenshot -->
        <div class="bg-white rounded-lg shadow mt-8">
            <div class="p-6 border-b border-gray-200">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-4">
                        <h2 class="text-lg font-semibold text-gray-900 flex items-center">
                            <i class="fas fa-leaf text-green-600 mr-2"></i>
                            Stack-Verwaltung
                        </h2>
                        <!-- Stack-Auswahl -->
                        <select id="stack-selector" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">Stack auswählen...</option>
                        </select>
                    </div>
                    <!-- Action-Buttons im Header -->
                    <div class="flex gap-2">
                        <button id="demo-add-product-main" class="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm">
                            <i class="fas fa-plus mr-1"></i>Produkt hinzufügen
                        </button>
                        <button id="demo-create-stack-main" class="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm">
                            <i class="fas fa-flask mr-1"></i>Stack erstellen
                        </button>
                    </div>
                </div>
            </div>
            <div class="p-6">
                <div id="demo-stack-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    <!-- Stack-Produkte werden hier dynamisch eingefügt -->
                </div>
                

            </div>
        </div>
    </div>
  `)
}

export default app