import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database;
  MAILERSEND_API_KEY: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// =================================
// UTILITY FUNCTIONS
// =================================

// Hash password using SHA-256 with salt
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = generateSecureToken().substring(0, 16);
  const saltedPassword = password + salt;
  
  const data = encoder.encode(saltedPassword);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return salt + hashHex;
}

// Verify password against hash
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const salt = hash.substring(0, 16);
    const storedHash = hash.substring(16);
    
    const saltedPassword = password + salt;
    const data = encoder.encode(saltedPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return computedHash === storedHash;
  } catch (error) {
    return false;
  }
}

// Generate secure random token
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Validate email format
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Passwort muss mindestens 8 Zeichen lang sein' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens einen Großbuchstaben enthalten' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens einen Kleinbuchstaben enthalten' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens eine Zahl enthalten' };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens ein Sonderzeichen enthalten' };
  }
  
  return { valid: true };
}

// Send email via MailerSend
async function sendEmail(apiKey: string, to: string, subject: string, html: string, text: string) {
  try {
    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: {
          email: 'noreply@supplementstack.de',
          name: 'Supplement Stack'
        },
        to: [{
          email: to
        }],
        subject: subject,
        html: html,
        text: text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MailerSend API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

// =================================
// HTML ROUTES - RECOVERED FROM BACKUP
// =================================

// Main page - restored from backup
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
        <!-- Header Navigation -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <a href="/" class="flex items-center">
                            <i class="fas fa-capsules text-2xl text-blue-600 mr-3"></i>
                            <span class="text-xl font-bold text-gray-900">Supplement Stack</span>
                        </a>
                    </div>
                    
                    <!-- Navigation Menu -->
                    <div id="nav-menu" class="hidden md:flex space-x-4">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Navigation Actions -->
                    <div id="nav-actions" class="hidden md:flex">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Mobile menu button -->
                    <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
                
                <!-- Mobile menu -->
                <div id="mobile-menu" class="hidden md:hidden">
                    <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <div id="mobile-nav-menu">
                            <!-- Will be populated by app.js -->
                        </div>
                        <div id="mobile-nav-actions" class="pt-4 border-t border-gray-200">
                            <!-- Will be populated by app.js -->
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main content loaded directly -->
        <div id="app">
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
                        <a href="/demo" class="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors">
                            Demo anschauen
                        </a>
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
        </div>

        <!-- Footer -->
        <footer class="bg-gray-900 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <!-- Brand Column -->
                    <div class="col-span-1 md:col-span-2">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-capsules text-2xl text-blue-400 mr-3"></i>
                            <span class="text-xl font-bold">Supplement Stack</span>
                        </div>
                        <p class="text-gray-300 mb-4 max-w-md">
                            Ihr intelligenter Supplement Manager für eine wissenschaftlich fundierte und sichere Nahrungsergänzung.
                        </p>
                        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
                            <p class="text-yellow-200 text-sm">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                <strong>Wichtiger Hinweis:</strong> Diese Anwendung ersetzt keine medizinische Beratung.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Quick Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Schnellzugriff</h3>
                        <ul class="space-y-2">
                            <li><a href="/" class="text-gray-300 hover:text-white transition-colors">Startseite</a></li>
                            <li><a href="/demo" class="text-gray-300 hover:text-white transition-colors">Demo</a></li>
                            <li><a href="/auth" class="text-gray-300 hover:text-white transition-colors">Anmelden</a></li>
                            <li><a href="/dashboard" class="text-gray-300 hover:text-white transition-colors">Dashboard</a></li>
                        </ul>
                    </div>
                    
                    <!-- Legal Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Rechtliches</h3>
                        <ul class="space-y-2">
                            <li><a href="/datenschutz" class="text-gray-300 hover:text-white transition-colors">Datenschutz</a></li>
                            <li><a href="/impressum" class="text-gray-300 hover:text-white transition-colors">Impressum</a></li>
                            <li><a href="/agb" class="text-gray-300 hover:text-white transition-colors">AGB</a></li>
                            <li><a href="/kontakt" class="text-gray-300 hover:text-white transition-colors">Kontakt</a></li>
                        </ul>
                    </div>
                </div>
                
                <!-- Bottom Bar -->
                <div class="border-t border-gray-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
                    <p class="text-gray-300 text-sm">
                        © 2025 Supplement Stack. Alle Rechte vorbehalten.
                    </p>
                    <div class="flex items-center space-x-4 mt-4 sm:mt-0">
                        <span class="text-gray-300 text-sm">DSGVO-konform</span>
                        <span class="text-gray-300 text-sm">•</span>
                        <span class="text-gray-300 text-sm">Made in Germany</span>
                    </div>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
        <script>
            // Initialize main app when page loads
            document.addEventListener('DOMContentLoaded', function() {
                console.log('Landing page loaded, initializing SupplementApp...');
                try {
                    window.app = new SupplementApp();
                    console.log('SupplementApp initialized successfully');
                } catch (error) {
                    console.error('Failed to initialize SupplementApp:', error);
                }
            });
        </script>
    </body>
    </html>
  `)
})

// Demo page - restored from backup with full functionality
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
    <body class="bg-gray-50 min-h-screen">
        <!-- Header Navigation -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <a href="/" class="flex items-center">
                            <i class="fas fa-capsules text-2xl text-blue-600 mr-3"></i>
                            <span class="text-xl font-bold text-gray-900">Supplement Stack</span>
                        </a>
                    </div>
                    
                    <!-- Navigation Menu -->
                    <div id="nav-menu" class="hidden md:flex space-x-4">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Navigation Actions -->
                    <div id="nav-actions" class="hidden md:flex">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Mobile menu button -->
                    <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
                
                <!-- Mobile menu -->
                <div id="mobile-menu" class="hidden md:hidden">
                    <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <div id="mobile-nav-menu">
                            <!-- Will be populated by app.js -->
                        </div>
                        <div id="mobile-nav-actions" class="pt-4 border-t border-gray-200">
                            <!-- Will be populated by app.js -->
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <div class="container mx-auto px-4 py-8">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-4xl font-bold text-gray-900 mb-2">
                    <i class="fas fa-flask mr-3 text-blue-600"></i>
                    Demo - Supplement Stack
                </h1>
                <p class="text-xl text-gray-600 mb-4">Testen Sie alle Funktionen unseres intelligenten Supplement Managers</p>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-4xl mx-auto">
                    <p class="text-blue-800 text-sm">
                        <i class="fas fa-info-circle mr-2"></i>
                        <strong>Interaktive Demo:</strong> Alle Funktionen sind voll funktionsfähig. 
                        Testen Sie das Hinzufügen von Produkten, Stack-Erstellung und Kostenberechnungen.
                    </p>
                </div>
            </div>

            <!-- Controls -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-8">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div class="flex flex-col sm:flex-row gap-4 flex-1">
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Stack auswählen:</label>
                            <select id="stack-selector" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Lade Stacks...</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex flex-col sm:flex-row gap-3">
                        <button id="demo-add-product-main" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium shadow-sm">
                            <i class="fas fa-plus mr-2"></i>Produkt hinzufügen
                        </button>
                        <button id="demo-create-stack-main" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm">
                            <i class="fas fa-magic mr-2"></i>Stack erstellen
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stack Grid -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-8">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">
                        <i class="fas fa-layer-group mr-2 text-green-600"></i>
                        Ihr Demo Stack
                    </h2>
                    <div class="flex items-center space-x-4 text-sm text-gray-600">
                        <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                            <i class="fas fa-box mr-1"></i>
                            Produkte im Stack
                        </span>
                    </div>
                </div>
                
                <!-- Products Grid - will be populated by JavaScript -->
                <div id="demo-stack-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
                    <!-- Products will be loaded here by demo-modal.js -->
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-lg shadow-md p-6 text-center">
                    <div class="text-3xl font-bold text-blue-600" id="total-purchase-cost">€0.00</div>
                    <p class="text-gray-600 mt-2">Gesamter Kaufpreis</p>
                </div>
                <div class="bg-white rounded-lg shadow-md p-6 text-center">
                    <div class="text-3xl font-bold text-green-600" id="total-monthly-cost">€0.00</div>
                    <p class="text-gray-600 mt-2">Monatliche Kosten</p>
                </div>
                <div class="bg-white rounded-lg shadow-md p-6 text-center">
                    <div class="text-3xl font-bold text-purple-600" id="demo-wishlist-count">0</div>
                    <p class="text-gray-600 mt-2">Auf Wunschliste</p>
                </div>
                <div class="bg-white rounded-lg shadow-md p-6 text-center">
                    <div class="text-3xl font-bold text-orange-600">Demo</div>
                    <p class="text-gray-600 mt-2">Testmodus aktiv</p>
                </div>
            </div>

            <!-- Footer Info -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
                <div class="text-center">
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">
                        <i class="fas fa-rocket mr-2 text-blue-600"></i>
                        Gefällt Ihnen die Demo?
                    </h3>
                    <p class="text-gray-600 mb-4">Registrieren Sie sich kostenlos und verwalten Sie Ihre echten Supplements!</p>
                    <div class="flex flex-col sm:flex-row gap-3 justify-center">
                        <a href="/auth" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">
                            <i class="fas fa-user-plus mr-2"></i>Jetzt registrieren
                        </a>
                        <a href="/" class="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                            <i class="fas fa-home mr-2"></i>Zur Startseite
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="bg-gray-900 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <!-- Brand Column -->
                    <div class="col-span-1 md:col-span-2">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-capsules text-2xl text-blue-400 mr-3"></i>
                            <span class="text-xl font-bold">Supplement Stack</span>
                        </div>
                        <p class="text-gray-300 mb-4 max-w-md">
                            Ihr intelligenter Supplement Manager für eine wissenschaftlich fundierte und sichere Nahrungsergänzung.
                        </p>
                        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
                            <p class="text-yellow-200 text-sm">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                <strong>Wichtiger Hinweis:</strong> Diese Anwendung ersetzt keine medizinische Beratung.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Quick Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Schnellzugriff</h3>
                        <ul class="space-y-2">
                            <li><a href="/" class="text-gray-300 hover:text-white transition-colors">Startseite</a></li>
                            <li><a href="/demo" class="text-gray-300 hover:text-white transition-colors">Demo</a></li>
                            <li><a href="/auth" class="text-gray-300 hover:text-white transition-colors">Anmelden</a></li>
                            <li><a href="/dashboard" class="text-gray-300 hover:text-white transition-colors">Dashboard</a></li>
                        </ul>
                    </div>
                    
                    <!-- Legal Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Rechtliches</h3>
                        <ul class="space-y-2">
                            <li><a href="/datenschutz" class="text-gray-300 hover:text-white transition-colors">Datenschutz</a></li>
                            <li><a href="/impressum" class="text-gray-300 hover:text-white transition-colors">Impressum</a></li>
                            <li><a href="/agb" class="text-gray-300 hover:text-white transition-colors">AGB</a></li>
                            <li><a href="/kontakt" class="text-gray-300 hover:text-white transition-colors">Kontakt</a></li>
                        </ul>
                    </div>
                </div>
                
                <!-- Bottom Bar -->
                <div class="border-t border-gray-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
                    <p class="text-gray-300 text-sm">
                        © 2025 Supplement Stack. Alle Rechte vorbehalten.
                    </p>
                    <div class="flex items-center space-x-4 mt-4 sm:mt-0">
                        <span class="text-gray-300 text-sm">DSGVO-konform</span>
                        <span class="text-gray-300 text-sm">•</span>
                        <span class="text-gray-300 text-sm">Made in Germany</span>
                    </div>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/demo-modal.js"></script>
        <script>
            // Initialize demo app when page loads
            document.addEventListener('DOMContentLoaded', function() {
                console.log('Demo page loaded, initializing SupplementDemoApp...');
                try {
                    window.demoApp = new SupplementDemoApp();
                    console.log('SupplementDemoApp initialized successfully');
                } catch (error) {
                    console.error('Failed to initialize SupplementDemoApp:', error);
                    document.getElementById('demo-stack-grid').innerHTML = '<div class="col-span-full text-center py-8 text-red-600"><i class="fas fa-exclamation-triangle text-2xl mb-2"></i><p>Demo konnte nicht geladen werden</p><p class="text-sm">Bitte laden Sie die Seite neu</p></div>';
                }
            });
        </script>
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

// Dashboard
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
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 min-h-screen">
        <!-- Navigation -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <a href="/" class="flex items-center">
                            <i class="fas fa-capsules text-2xl text-blue-600 mr-3"></i>
                            <span class="text-xl font-bold text-gray-900">Supplement Stack</span>
                        </a>
                    </div>
                    
                    <!-- Navigation Menu -->
                    <div id="nav-menu" class="hidden md:flex space-x-4">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Navigation Actions -->
                    <div id="nav-actions" class="hidden md:flex">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Mobile menu button -->
                    <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
                
                <!-- Mobile menu -->
                <div id="mobile-menu" class="hidden md:hidden">
                    <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <div id="mobile-nav-menu">
                            <!-- Will be populated by app.js -->
                        </div>
                        <div id="mobile-nav-actions" class="pt-4 border-t border-gray-200">
                            <!-- Will be populated by app.js -->
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Dashboard Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">
                    <i class="fas fa-tachometer-alt mr-3 text-blue-600"></i>
                    Dashboard
                </h1>
                <p class="text-gray-600">Überblick über Ihre Supplements und Stacks</p>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <!-- Products Count -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-pills text-2xl text-blue-600"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Produkte</dt>
                                <dd class="text-lg font-medium text-gray-900" id="products-count">0</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <!-- Stacks Count -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-layer-group text-2xl text-green-600"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Stacks</dt>
                                <dd class="text-lg font-medium text-gray-900" id="stacks-count">0</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <!-- Monthly Costs -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-euro-sign text-2xl text-purple-600"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Monatliche Kosten</dt>
                                <dd class="text-lg font-medium text-gray-900" id="monthly-cost">€0.00</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <!-- Wishlist Count -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-heart text-2xl text-red-600"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Wunschliste</dt>
                                <dd class="text-lg font-medium text-gray-900" id="wishlist-count">0</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recent Stacks -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-semibold text-gray-900">
                        <i class="fas fa-clock mr-2 text-gray-600"></i>
                        Aktuelle Stacks
                    </h2>
                    <a href="/stacks" class="text-blue-600 hover:text-blue-500 text-sm font-medium">
                        Alle anzeigen <i class="fas fa-arrow-right ml-1"></i>
                    </a>
                </div>
                <div id="recent-stacks">
                    <!-- Will be populated by app.js -->
                    <p class="text-gray-500 text-center py-4">Lade aktuelle Stacks...</p>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 class="text-xl font-semibold text-gray-900 mb-6">
                    <i class="fas fa-bolt mr-2 text-yellow-600"></i>
                    Schnellaktionen
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <a href="/products" class="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group">
                        <i class="fas fa-plus text-blue-600 text-xl mr-3 group-hover:scale-110 transition-transform"></i>
                        <div>
                            <div class="font-medium text-gray-900">Produkt hinzufügen</div>
                            <div class="text-sm text-gray-600">Neues Supplement erfassen</div>
                        </div>
                    </a>
                    
                    <a href="/stacks" class="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group">
                        <i class="fas fa-layer-group text-green-600 text-xl mr-3 group-hover:scale-110 transition-transform"></i>
                        <div>
                            <div class="font-medium text-gray-900">Stack erstellen</div>
                            <div class="text-sm text-gray-600">Neue Kombination anlegen</div>
                        </div>
                    </a>
                    
                    <button onclick="app.openDemo()" class="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group">
                        <i class="fas fa-flask text-purple-600 text-xl mr-3 group-hover:scale-110 transition-transform"></i>
                        <div>
                            <div class="font-medium text-gray-900">Demo öffnen</div>
                            <div class="text-sm text-gray-600">Funktionen testen</div>
                        </div>
                    </button>
                    
                    <a href="/products" class="flex items-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors group">
                        <i class="fas fa-search text-orange-600 text-xl mr-3 group-hover:scale-110 transition-transform"></i>
                        <div>
                            <div class="font-medium text-gray-900">Produkte durchsuchen</div>
                            <div class="text-sm text-gray-600">Vorhandene Supplements</div>
                        </div>
                    </a>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="bg-gray-900 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <!-- Brand Column -->
                    <div class="col-span-1 md:col-span-2">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-capsules text-2xl text-blue-400 mr-3"></i>
                            <span class="text-xl font-bold">Supplement Stack</span>
                        </div>
                        <p class="text-gray-300 mb-4 max-w-md">
                            Ihr intelligenter Supplement Manager für eine wissenschaftlich fundierte und sichere Nahrungsergänzung.
                        </p>
                        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
                            <p class="text-yellow-200 text-sm">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                <strong>Wichtiger Hinweis:</strong> Diese Anwendung ersetzt keine medizinische Beratung.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Quick Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Schnellzugriff</h3>
                        <ul class="space-y-2">
                            <li><a href="/" class="text-gray-300 hover:text-white transition-colors">Startseite</a></li>
                            <li><a href="/demo" class="text-gray-300 hover:text-white transition-colors">Demo</a></li>
                            <li><a href="/auth" class="text-gray-300 hover:text-white transition-colors">Anmelden</a></li>
                            <li><a href="/dashboard" class="text-gray-300 hover:text-white transition-colors">Dashboard</a></li>
                        </ul>
                    </div>
                    
                    <!-- Legal Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Rechtliches</h3>
                        <ul class="space-y-2">
                            <li><a href="/datenschutz" class="text-gray-300 hover:text-white transition-colors">Datenschutz</a></li>
                            <li><a href="/impressum" class="text-gray-300 hover:text-white transition-colors">Impressum</a></li>
                            <li><a href="/agb" class="text-gray-300 hover:text-white transition-colors">AGB</a></li>
                            <li><a href="/kontakt" class="text-gray-300 hover:text-white transition-colors">Kontakt</a></li>
                        </ul>
                    </div>
                </div>
                
                <!-- Bottom Bar -->
                <div class="border-t border-gray-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
                    <p class="text-gray-300 text-sm">
                        © 2025 Supplement Stack. Alle Rechte vorbehalten.
                    </p>
                    <div class="flex items-center space-x-4 mt-4 sm:mt-0">
                        <span class="text-gray-300 text-sm">DSGVO-konform</span>
                        <span class="text-gray-300 text-sm">•</span>
                        <span class="text-gray-300 text-sm">Made in Germany</span>
                    </div>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
        <script>
            // Initialize main app when page loads
            document.addEventListener('DOMContentLoaded', function() {
                console.log('Dashboard page loaded, initializing SupplementApp...');
                try {
                    window.app = new SupplementApp();
                    console.log('SupplementApp initialized successfully');
                } catch (error) {
                    console.error('Failed to initialize SupplementApp:', error);
                    document.getElementById('recent-stacks').innerHTML = '<div class="text-center py-8 text-red-600"><i class="fas fa-exclamation-triangle text-2xl mb-2"></i><p>Dashboard konnte nicht geladen werden</p><p class="text-sm">Bitte laden Sie die Seite neu oder melden Sie sich erneut an</p></div>';
                }
            });
        </script>
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
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
        <div class="auth-container max-w-md w-full bg-white rounded-lg shadow-lg p-8 mx-4">
            <!-- Password Reset Form -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">🔑 Neues Passwort</h1>
                <p class="text-gray-600">Erstellen Sie ein sicheres neues Passwort</p>
            </div>
            <form id="resetPasswordForm" class="space-y-4">
                <div>
                    <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                    <input type="password" id="newPassword" name="password" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
        </div>
        <script src="/static/auth.js"></script>
    </body>
    </html>
  `)
})

// =================================
// AUTHENTICATION API ROUTES
// =================================

// User registration
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, confirmPassword } = await c.req.json();

    console.log('Registration attempt for:', email);

    if (!email || !password || !confirmPassword) {
      return c.json({
        error: 'missing_fields',
        message: 'Alle Felder sind erforderlich'
      }, 400);
    }

    if (password !== confirmPassword) {
      return c.json({
        error: 'password_mismatch',
        message: 'Die Passwörter stimmen nicht überein'
      }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({
        error: 'invalid_email_format',
        message: 'Ungültiges E-Mail-Format'
      }, 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({
        error: 'password_too_weak',
        message: passwordValidation.message
      }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existingUser) {
      if (existingUser.email_verified) {
        return c.json({
          error: 'email_already_exists',
          message: 'Diese E-Mail-Adresse ist bereits registriert'
        }, 409);
      } else {
        // Delete unverified user
        await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(existingUser.id).run();
      }
    }

    // Hash password and generate verification token
    const passwordHash = await hashPassword(password);
    const verificationToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    console.log('Creating user with verification token');

    // Create user
    const result = await c.env.DB.prepare(`
      INSERT INTO users (
        email, password_hash, email_verified, 
        email_verification_token, email_verification_expires_at,
        created_at, updated_at
      ) VALUES (?, ?, FALSE, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(email.toLowerCase(), passwordHash, verificationToken, expiresAt).run();

    console.log('User created, sending verification email');

    // Send verification email
    const baseUrl = c.env.ENVIRONMENT === 'production' 
      ? 'https://supplementstack.de' 
      : `https://${c.req.header('host')}`;

    const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
    
    const emailHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0;">🧬 Supplement Stack</h1>
          <p style="margin: 10px 0 0 0;">Willkommen bei Ihrem intelligenten Supplement Manager</p>
        </div>
        <div style="background: #f9f9f9; padding: 30px;">
          <h2>E-Mail-Adresse bestätigen</h2>
          <p>Vielen Dank für Ihre Registrierung bei Supplement Stack. Um die DSGVO-Anforderungen zu erfüllen, müssen wir Ihre E-Mail-Adresse bestätigen.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              E-Mail-Adresse bestätigen
            </a>
          </div>
          <p>Alternativ können Sie auch diesen Link kopieren: <br><code>${verificationLink}</code></p>
          <div style="background: #e8f4f8; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h4>🔒 Datenschutz & DSGVO-Konformität</h4>
            <p>Ihre Daten werden nach den strengsten deutschen und europäischen Datenschutzgesetzen behandelt.</p>
          </div>
        </div>
      </div>
    `;

    const emailText = `Willkommen bei Supplement Stack! Bestätigen Sie Ihre E-Mail-Adresse: ${verificationLink}`;

    try {
      await sendEmail(
        c.env.MAILERSEND_API_KEY,
        email,
        'E-Mail-Adresse bestätigen - Supplement Stack',
        emailHtml,
        emailText
      );

      console.log('Verification email sent successfully');
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue anyway - user can still complete registration manually
    }

    return c.json({
      message: 'Registrierung erfolgreich! Bitte überprüfen Sie Ihre E-Mails und bestätigen Sie Ihre E-Mail-Adresse.',
      emailSent: true
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
    }, 500);
  }
});

// Email verification
app.get('/api/auth/verify-email', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({
        error: 'missing_token',
        message: 'Verifizierungs-Token ist erforderlich'
      }, 400);
    }

    // Find and verify user
    const user = await c.env.DB.prepare(`
      SELECT * FROM users 
      WHERE email_verification_token = ? 
      AND email_verification_expires_at > CURRENT_TIMESTAMP
      AND email_verified = FALSE
    `).bind(token).first();

    if (!user) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>Verifizierung fehlgeschlagen</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen">
            <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                <h1 class="text-2xl font-bold text-red-600 mb-4">❌ Verifizierung fehlgeschlagen</h1>
                <p class="text-gray-600 mb-6">Der Verifizierungs-Link ist ungültig oder abgelaufen.</p>
                <a href="/auth" class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                    Zur Anmeldung
                </a>
            </div>
        </body>
        </html>
      `);
    }

    // Mark email as verified
    await c.env.DB.prepare(`
      UPDATE users 
      SET email_verified = TRUE, 
          email_verification_token = NULL, 
          email_verification_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(user.id).run();

    // Generate JWT token
    const jwtToken = await sign({
      userId: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
    }, c.env.JWT_SECRET);

    // Set auth cookie
    c.header('Set-Cookie', `auth_token=${jwtToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);

    return c.html(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <title>E-Mail erfolgreich bestätigt</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
              <h1 class="text-2xl font-bold text-green-600 mb-4">✅ E-Mail bestätigt!</h1>
              <p class="text-gray-600 mb-6">Ihr Konto ist jetzt aktiviert. Willkommen bei Supplement Stack!</p>
              <div class="space-y-4">
                  <a href="/dashboard" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                      Zum Dashboard
                  </a>
                  <a href="/" class="block w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300">
                      Zur Startseite
                  </a>
              </div>
              <script>
                setTimeout(() => window.location.href = '/dashboard', 3000);
              </script>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Email verification error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// User login (2-step process)
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({
        error: 'missing_fields',
        message: 'E-Mail und Passwort sind erforderlich'
      }, 400);
    }

    // Get user
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!user || !await verifyPassword(password, user.password_hash)) {
      return c.json({
        error: 'invalid_credentials',
        message: 'Ungültige E-Mail-Adresse oder Passwort'
      }, 401);
    }

    if (!user.email_verified) {
      return c.json({
        error: 'email_not_verified',
        message: 'Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse'
      }, 403);
    }

    // Generate login verification token
    const loginToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    await c.env.DB.prepare(`
      INSERT INTO email_verification_tokens (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).bind(user.id, loginToken, expiresAt).run();

    // Send login verification email
    const baseUrl = c.env.ENVIRONMENT === 'production' 
      ? 'https://supplementstack.de' 
      : `https://${c.req.header('host')}`;

    const loginLink = `${baseUrl}/api/auth/verify-login?token=${loginToken}`;
    
    const emailHtml = `
      <h2>Anmeldung bestätigen</h2>
      <p>Jemand möchte sich mit Ihrem Supplement Stack Konto anmelden.</p>
      <p>Falls Sie es waren, klicken Sie hier:</p>
      <a href="${loginLink}" style="background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Anmeldung bestätigen
      </a>
      <p>Link gültig für 15 Minuten. Falls Sie es nicht waren, ignorieren Sie diese E-Mail.</p>
    `;

    const emailText = `Anmeldung bestätigen: ${loginLink}`;

    await sendEmail(
      c.env.MAILERSEND_API_KEY,
      user.email,
      'Anmeldung bestätigen - Supplement Stack',
      emailHtml,
      emailText
    );

    return c.json({
      message: 'Anmeldedaten korrekt. Bitte überprüfen Sie Ihre E-Mails und bestätigen Sie die Anmeldung.',
      emailSent: true,
      requiresVerification: true
    }, 200);

  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Verify login
app.get('/api/auth/verify-login', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({
        error: 'missing_token',
        message: 'Anmelde-Token ist erforderlich'
      }, 400);
    }

    // Get user by token
    const result = await c.env.DB.prepare(`
      SELECT u.* FROM users u
      INNER JOIN email_verification_tokens evt ON u.id = evt.user_id
      WHERE evt.token = ? 
      AND evt.expires_at > CURRENT_TIMESTAMP
      AND evt.used_at IS NULL
    `).bind(token).first();

    if (!result) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>Anmeldung fehlgeschlagen</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen">
            <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                <h1 class="text-2xl font-bold text-red-600 mb-4">❌ Anmeldung fehlgeschlagen</h1>
                <p class="text-gray-600 mb-6">Der Anmelde-Link ist ungültig oder abgelaufen.</p>
                <a href="/auth" class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                    Zur Anmeldung
                </a>
            </div>
        </body>
        </html>
      `);
    }

    // Mark token as used
    await c.env.DB.prepare(`
      UPDATE email_verification_tokens 
      SET used_at = CURRENT_TIMESTAMP 
      WHERE token = ?
    `).bind(token).run();

    // Generate JWT token
    const jwtToken = await sign({
      userId: result.id,
      email: result.email,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
    }, c.env.JWT_SECRET);

    // Set auth cookie
    c.header('Set-Cookie', `auth_token=${jwtToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);

    return c.html(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <title>Anmeldung erfolgreich</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
              <h1 class="text-2xl font-bold text-green-600 mb-4">✅ Anmeldung erfolgreich!</h1>
              <p class="text-gray-600 mb-6">Willkommen zurück bei Supplement Stack!</p>
              <a href="/dashboard" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                  Zum Dashboard
              </a>
              <script>
                setTimeout(() => window.location.href = '/dashboard', 2000);
              </script>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Login verification error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({
        error: 'missing_email',
        message: 'E-Mail-Adresse ist erforderlich'
      }, 400);
    }

    const successMessage = 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Passwort-Reset-E-Mail gesendet.';

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND email_verified = TRUE'
    ).bind(email.toLowerCase()).first();

    if (user) {
      const resetToken = generateSecureToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Delete existing reset tokens
      await c.env.DB.prepare(`
        DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL
      `).bind(user.id).run();

      // Create new reset token
      await c.env.DB.prepare(`
        INSERT INTO email_verification_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `).bind(user.id, resetToken, expiresAt).run();

      // Send reset email
      const baseUrl = c.env.ENVIRONMENT === 'production' 
        ? 'https://supplementstack.de' 
        : `https://${c.req.header('host')}`;

      const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
      
      const emailHtml = `
        <h2>Passwort zurücksetzen</h2>
        <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
        <a href="${resetLink}" style="background: #DC2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Passwort zurücksetzen
        </a>
        <p>Link gültig für 1 Stunde. Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
      `;

      const emailText = `Passwort zurücksetzen: ${resetLink}`;

      await sendEmail(
        c.env.MAILERSEND_API_KEY,
        user.email,
        'Passwort zurücksetzen - Supplement Stack',
        emailHtml,
        emailText
      );
    }

    return c.json({ message: successMessage }, 200);

  } catch (error) {
    console.error('Password reset request error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Health check - with detailed status
app.get('/api/health', async (c) => {
  try {
    // Test database connection
    const dbTest = await c.env.DB.prepare('SELECT 1 as test').first();
    
    return c.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      auth: 'enabled',
      database: dbTest ? 'connected' : 'disconnected',
      environment: c.env.ENVIRONMENT || 'unknown',
      mailersend: c.env.MAILERSEND_API_KEY ? 'configured' : 'not configured'
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
})

export default app