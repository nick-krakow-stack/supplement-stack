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

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app