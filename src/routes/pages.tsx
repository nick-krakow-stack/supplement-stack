import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database;
}

export const pageRoutes = new Hono<{ Bindings: Bindings }>()

// Homepage
pageRoutes.get('/', (c) => {
  const authCookie = getCookie(c, 'auth')
  const isAuthenticated = authCookie === 'authenticated'

  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Supplement Stack - Intelligente Supplement-Verwaltung</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <meta name="description" content="Verwalte deine Nahrungsergänzungsmittel intelligent mit Dosierungsempfehlungen und Kostenoptimierung.">
        <meta name="theme-color" content="#2563eb">
    </head>
    <body class="bg-gray-50 min-h-screen">
        <!-- Navigation -->
        <nav class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <h1 class="text-2xl font-bold text-blue-600">
                            <i class="fas fa-capsules mr-2"></i>
                            Supplement Stack
                        </h1>
                    </div>
                    <div class="flex items-center space-x-4">
                        ${isAuthenticated ? `
                            <a href="/dashboard" class="text-gray-700 hover:text-blue-600">Dashboard</a>
                            <button onclick="logout()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                                Abmelden
                            </button>
                        ` : `
                            <button onclick="showLogin()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                                Anmelden
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <div class="max-w-7xl mx-auto px-4 py-16">
            <div class="text-center">
                <h2 class="text-4xl font-bold text-gray-900 mb-4">
                    Intelligente Supplement-Verwaltung
                </h2>
                <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                    Verwalte deine Nahrungsergänzungsmittel smart: Mit automatischen Dosierungsempfehlungen, 
                    Kostenoptimierung und Stack-Management für optimale Gesundheitsergebnisse.
                </p>
                
                ${!isAuthenticated ? `
                    <button onclick="showLogin()" class="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition-colors">
                        Jetzt starten
                    </button>
                ` : `
                    <a href="/dashboard" class="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition-colors inline-block">
                        Zum Dashboard
                    </a>
                `}
            </div>
        </div>

        <!-- Features -->
        <div class="max-w-7xl mx-auto px-4 py-16 bg-white rounded-lg shadow-sm">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="text-center">
                    <div class="text-4xl text-blue-600 mb-4">
                        <i class="fas fa-pills"></i>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">Produkt-Management</h3>
                    <p class="text-gray-600">
                        Erfasse und verwalte deine Supplemente mit detaillierten Informationen zu Dosierung und Kosten.
                    </p>
                </div>
                
                <div class="text-center">
                    <div class="text-4xl text-blue-600 mb-4">
                        <i class="fas fa-layer-group"></i>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">Stack-System</h3>
                    <p class="text-gray-600">
                        Erstelle personalisierte Supplement-Kombinationen für verschiedene Gesundheitsziele.
                    </p>
                </div>
                
                <div class="text-center">
                    <div class="text-4xl text-blue-600 mb-4">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">Kostenanalyse</h3>
                    <p class="text-gray-600">
                        Behalte deine Supplement-Kosten im Blick und optimiere dein Budget automatisch.
                    </p>
                </div>
            </div>
        </div>

        <!-- Login Modal -->
        <div id="loginModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 w-96">
                <h3 class="text-xl font-semibold mb-4">Anmelden</h3>
                <form onsubmit="handleLogin(event)">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">E-Mail</label>
                        <input type="email" id="loginEmail" value="admin@supplement-stack.com" 
                               class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                    </div>
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Passwort</label>
                        <input type="password" id="loginPassword" value="admin123"
                               class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" onclick="hideLogin()" 
                                class="px-4 py-2 text-gray-600 hover:text-gray-800">
                            Abbrechen
                        </button>
                        <button type="submit" 
                                class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            Anmelden
                        </button>
                    </div>
                </form>
                <div class="mt-4 p-3 bg-gray-100 rounded text-sm">
                    <strong>Demo-Zugang:</strong><br>
                    E-Mail: admin@supplement-stack.com<br>
                    Passwort: admin123
                </div>
            </div>
        </div>

        <script>
            function showLogin() {
                document.getElementById('loginModal').classList.remove('hidden');
            }
            
            function hideLogin() {
                document.getElementById('loginModal').classList.add('hidden');
            }
            
            async function handleLogin(event) {
                event.preventDefault();
                
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                
                try {
                    const response = await fetch('/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        window.location.reload();
                    } else {
                        alert('Login fehlgeschlagen: ' + data.error);
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    alert('Login fehlgeschlagen');
                }
            }
            
            async function logout() {
                try {
                    await fetch('/auth/logout', { method: 'POST' });
                    window.location.reload();
                } catch (error) {
                    console.error('Logout error:', error);
                }
            }
        </script>
    </body>
    </html>
  `)
})

// Dashboard Page
pageRoutes.get('/dashboard', async (c) => {
  const authCookie = getCookie(c, 'auth')
  
  if (authCookie !== 'authenticated') {
    return c.redirect('/')
  }

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
    <body class="bg-gray-50 min-h-screen">
        <!-- Navigation -->
        <nav class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <a href="/" class="text-2xl font-bold text-blue-600">
                            <i class="fas fa-capsules mr-2"></i>
                            Supplement Stack
                        </a>
                        <span class="ml-4 text-sm text-gray-500">Dashboard</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/dashboard" class="text-blue-600 font-medium">Dashboard</a>
                        <button onclick="logout()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                            Abmelden
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Dashboard Content -->
        <div class="max-w-7xl mx-auto px-4 py-6">
            <!-- Welcome Section -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">Willkommen im Dashboard</h1>
                <p class="text-gray-600">Verwalte deine Supplemente und Stacks</p>
            </div>

            <!-- Quick Actions -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-white p-6 rounded-lg shadow-sm border">
                    <div class="flex items-center">
                        <div class="text-2xl text-blue-600 mr-4">
                            <i class="fas fa-pills"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold">Produkte</h3>
                            <p class="text-gray-600 text-sm">Verwalte Supplemente</p>
                        </div>
                    </div>
                    <button onclick="showProductModal()" class="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                        Produkt hinzufügen
                    </button>
                </div>

                <div class="bg-white p-6 rounded-lg shadow-sm border">
                    <div class="flex items-center">
                        <div class="text-2xl text-green-600 mr-4">
                            <i class="fas fa-layer-group"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold">Stacks</h3>
                            <p class="text-gray-600 text-sm">Erstelle Kombinationen</p>
                        </div>
                    </div>
                    <button onclick="showStackModal()" class="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                        Stack erstellen
                    </button>
                </div>

                <div class="bg-white p-6 rounded-lg shadow-sm border">
                    <div class="flex items-center">
                        <div class="text-2xl text-purple-600 mr-4">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold">Analyse</h3>
                            <p class="text-gray-600 text-sm">Kosten & Trends</p>
                        </div>
                    </div>
                    <button class="mt-4 w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700">
                        Analyse öffnen
                    </button>
                </div>

                <div class="bg-white p-6 rounded-lg shadow-sm border">
                    <div class="flex items-center">
                        <div class="text-2xl text-orange-600 mr-4">
                            <i class="fas fa-cog"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold">Einstellungen</h3>
                            <p class="text-gray-600 text-sm">Konfiguration</p>
                        </div>
                    </div>
                    <button class="mt-4 w-full bg-orange-600 text-white py-2 rounded hover:bg-orange-700">
                        Einstellungen
                    </button>
                </div>
            </div>

            <!-- Data Tables -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Products Table -->
                <div class="bg-white rounded-lg shadow-sm border">
                    <div class="p-6 border-b">
                        <h2 class="text-xl font-semibold">Meine Produkte</h2>
                    </div>
                    <div class="p-6">
                        <div id="productsContainer">
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl"></i>
                                <p class="mt-2">Lade Produkte...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stacks Table -->
                <div class="bg-white rounded-lg shadow-sm border">
                    <div class="p-6 border-b">
                        <h2 class="text-xl font-semibold">Meine Stacks</h2>
                    </div>
                    <div class="p-6">
                        <div id="stacksContainer">
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl"></i>
                                <p class="mt-2">Lade Stacks...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Product Modal -->
        <div id="productModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
                <h3 class="text-xl font-semibold mb-4">Neues Produkt</h3>
                <form onsubmit="handleProductSubmit(event)">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                            <input type="text" id="productName" class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Marke *</label>
                            <input type="text" id="productBrand" class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Portionsgröße *</label>
                            <input type="text" id="productServingSize" class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Kosten/Portion *</label>
                                <input type="number" id="productCostPerServing" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Portionen *</label>
                                <input type="number" id="productServingsPerContainer" class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                            <select id="productCategory" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                <option value="">Wählen...</option>
                                <option value="Vitamine">Vitamine</option>
                                <option value="Mineralien">Mineralien</option>
                                <option value="Protein">Protein</option>
                                <option value="Pre-Workout">Pre-Workout</option>
                                <option value="Post-Workout">Post-Workout</option>
                                <option value="Sonstige">Sonstige</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end space-x-2 mt-6">
                        <button type="button" onclick="hideProductModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800">
                            Abbrechen
                        </button>
                        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            Speichern
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Stack Modal -->
        <div id="stackModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 w-96">
                <h3 class="text-xl font-semibold mb-4">Neuer Stack</h3>
                <form onsubmit="handleStackSubmit(event)">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                            <input type="text" id="stackName" class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                            <textarea id="stackDescription" class="w-full border border-gray-300 rounded-md px-3 py-2" rows="3"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Ziel</label>
                            <select id="stackGoal" class="w-full border border-gray-300 rounded-md px-3 py-2">
                                <option value="">Wählen...</option>
                                <option value="Muskelaufbau">Muskelaufbau</option>
                                <option value="Gewichtsverlust">Gewichtsverlust</option>
                                <option value="Gesundheit">Allgemeine Gesundheit</option>
                                <option value="Energie">Mehr Energie</option>
                                <option value="Recovery">Regeneration</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end space-x-2 mt-6">
                        <button type="button" onclick="hideStackModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800">
                            Abbrechen
                        </button>
                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                            Erstellen
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="/static/dashboard.js"></script>
    </body>
    </html>
  `)
})