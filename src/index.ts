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

// HTML Routes - restored from backup
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dein intelligenter Supplement Manager - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Main content will be loaded here -->
        <div id="app">Loading...</div>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

app.get('/demo', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Demo - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Demo content will be loaded here -->
        <div id="demo-app">Loading Demo...</div>
        <script src="/static/demo-modal.js"></script>
    </body>
    </html>
  `)
})

app.get('/auth', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Anmeldung - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
        <div class="auth-container max-w-md w-full bg-white rounded-lg shadow-lg p-8 mx-4">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">🧬 Supplement Stack</h1>
                <p class="text-gray-600">Ihr intelligenter Supplement Manager</p>
            </div>

            <!-- Tab Navigation -->
            <div class="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button class="auth-tab flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors active" data-tab="login">
                    Anmelden
                </button>
                <button class="auth-tab flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors" data-tab="register">
                    Registrieren
                </button>
            </div>

            <!-- Login Tab -->
            <div id="loginTab" class="tab-content">
                <form id="loginForm" class="space-y-4">
                    <div>
                        <label for="loginEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                        <input type="email" id="loginEmail" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="loginPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                        <input type="password" id="loginPassword" name="password" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" id="loginBtn" 
                            class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium">
                        Anmelden
                    </button>
                </form>
                <div class="text-center mt-4">
                    <button class="auth-tab text-blue-600 hover:text-blue-800 text-sm" data-tab="forgot">
                        Passwort vergessen?
                    </button>
                </div>
                <div class="mt-6 p-4 bg-blue-50 rounded-md">
                    <h4 class="text-sm font-medium text-blue-800 mb-2">🔐 2-Schritt-Verifizierung</h4>
                    <p class="text-xs text-blue-700">Nach der Anmeldung erhalten Sie eine E-Mail zur Bestätigung. Dies schützt Ihr Konto gemäß DSGVO-Anforderungen.</p>
                </div>
            </div>

            <!-- Register Tab -->
            <div id="registerTab" class="tab-content hidden">
                <form id="registerForm" class="space-y-4">
                    <div>
                        <label for="registerEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                        <input type="email" id="registerEmail" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="registerPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                        <input type="password" id="registerPassword" name="password" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">Mindestens 8 Zeichen, mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen</p>
                    </div>
                    <div>
                        <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" id="registerBtn" 
                            class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors font-medium">
                        Registrieren
                    </button>
                </form>
                <div class="mt-6 p-4 bg-green-50 rounded-md">
                    <h4 class="text-sm font-medium text-green-800 mb-2">📧 E-Mail-Bestätigung erforderlich</h4>
                    <p class="text-xs text-green-700">Nach der Registrierung erhalten Sie eine E-Mail zur Bestätigung Ihrer Adresse. Dies ist für die DSGVO-Konformität erforderlich.</p>
                </div>
            </div>

            <!-- Forgot Password Tab -->
            <div id="forgotTab" class="tab-content hidden">
                <form id="forgotPasswordForm" class="space-y-4">
                    <div>
                        <label for="forgotEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                        <input type="email" id="forgotEmail" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" id="forgotBtn" 
                            class="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors font-medium">
                        Passwort zurücksetzen
                    </button>
                </form>
                <div class="text-center mt-4">
                    <button class="auth-tab text-blue-600 hover:text-blue-800 text-sm" data-tab="login">
                        Zurück zur Anmeldung
                    </button>
                </div>
            </div>

            <!-- Links -->
            <div class="mt-8 text-center">
                <a href="/" class="text-sm text-gray-600 hover:text-gray-800">
                    ← Zurück zur Startseite
                </a>
            </div>

            <!-- GDPR Notice -->
            <div class="mt-6 p-4 bg-gray-50 rounded-md">
                <p class="text-xs text-gray-600 text-center">
                    Mit der Nutzung stimmen Sie unseren 
                    <a href="/datenschutz" class="text-blue-600 hover:text-blue-800">Datenschutzbestimmungen</a> zu.
                    Alle Daten werden DSGVO-konform verarbeitet.
                </p>
            </div>
        </div>

        <script src="/static/auth.js"></script>
    </body>
    </html>
  `)
})

app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div id="dashboard-app">Loading Dashboard...</div>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// Password reset page
app.get('/auth/reset-password', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Passwort zurücksetzen - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
        <div class="auth-container max-w-md w-full bg-white rounded-lg shadow-lg p-8 mx-4">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">🔑 Neues Passwort</h1>
                <p class="text-gray-600">Erstellen Sie ein sicheres neues Passwort</p>
            </div>

            <!-- Reset Password Form -->
            <form id="resetPasswordForm" class="space-y-4">
                <div>
                    <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                    <input type="password" id="newPassword" name="password" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <p class="text-xs text-gray-500 mt-1">Mindestens 8 Zeichen, mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen</p>
                </div>
                <div>
                    <label for="confirmNewPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                    <input type="password" id="confirmNewPassword" name="confirmPassword" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <button type="submit" id="resetBtn" 
                        class="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors font-medium">
                    Passwort ändern
                </button>
            </form>

            <!-- Security Notice -->
            <div class="mt-6 p-4 bg-yellow-50 rounded-md">
                <h4 class="text-sm font-medium text-yellow-800 mb-2">🛡️ Sicherheitshinweis</h4>
                <p class="text-xs text-yellow-700">
                    Dieser Link ist nur einmalig verwendbar und läuft nach 1 Stunde ab. 
                    Wählen Sie ein starkes, einzigartiges Passwort für maximale Sicherheit.
                </p>
            </div>

            <!-- Links -->
            <div class="mt-8 text-center">
                <a href="/auth" class="text-sm text-gray-600 hover:text-gray-800">
                    ← Zur Anmeldung
                </a>
            </div>
        </div>

        <script src="/static/auth.js"></script>
    </body>
    </html>
  `)
})

// Apply route handlers
app.route('/api/auth', authRoutes)
app.route('/api/products', productRoutes)
app.route('/api/stacks', stackRoutes)
app.route('/api/affiliate', affiliateRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api', apiRoutes)

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString() 
  })
})

export default app