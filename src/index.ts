import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { authRoutes } from './routes/auth'
import { productRoutes } from './routes/products'
import { stackRoutes } from './routes/stacks'
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
app.route('/api/products', productRoutes)
app.route('/api/stacks', stackRoutes)
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
        <title>Demo - Supplement Stack</title>
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
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="flex items-center">
                        <i class="fas fa-heart text-red-500 text-2xl mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-600">Wunschliste</p>
                            <p class="text-xl font-bold" id="demo-wishlist-count">3</p>
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
                        <option value="1">Grundausstattung</option>
                        <option value="2">Immunsystem Boost</option>
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

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app