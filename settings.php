<?php
/**
 * Supplement Stack PHP - User Settings
 * All-Inkl Webserver kompatibel
 */

require_once 'config/config.php';

// Login erforderlich
requireLogin();

$pageTitle = 'Einstellungen - ' . SITE_NAME;
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo e($pageTitle); ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="<?php echo asset('css/style.css'); ?>" rel="stylesheet">
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <a href="dashboard.php" class="text-2xl font-bold text-blue-600">
                        <i class="fas fa-capsules mr-2"></i>
                        <?php echo e(SITE_NAME); ?>
                    </a>
                    <span class="ml-4 text-sm text-gray-500">Einstellungen</span>
                </div>
                
                <!-- Navigation -->
                <nav class="hidden md:flex items-center space-x-6">
                    <a href="dashboard.php" class="text-gray-700 hover:text-blue-600 transition-colors">Dashboard</a>
                    <a href="products.php" class="text-gray-700 hover:text-blue-600 transition-colors">Produkte</a>
                    <a href="stacks.php" class="text-gray-700 hover:text-blue-600 transition-colors">Stacks</a>
                    <a href="analysis.php" class="text-gray-700 hover:text-blue-600 transition-colors">Analyse</a>
                </nav>
                
                <!-- User Menu -->
                <div class="relative">
                    <button 
                        id="user-menu-button"
                        class="flex items-center space-x-2 text-blue-600 font-medium"
                        onclick="toggleUserMenu()"
                    >
                        <i class="fas fa-user-circle text-2xl"></i>
                        <span class="hidden sm:block"><?php echo e($currentUser['name'] ?? 'Benutzer'); ?></span>
                        <i class="fas fa-chevron-down text-sm"></i>
                    </button>
                    
                    <div 
                        id="user-menu"
                        class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 hidden"
                    >
                        <div class="py-1">
                            <a href="profile.php" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <i class="fas fa-user mr-2"></i>Profil
                            </a>
                            <a href="settings.php" class="block px-4 py-2 text-sm text-blue-600 bg-blue-50 font-medium">
                                <i class="fas fa-cog mr-2"></i>Einstellungen
                            </a>
                            <div class="border-t border-gray-100"></div>
                            <a href="logout.php" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <i class="fas fa-sign-out-alt mr-2"></i>Abmelden
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <main class="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <!-- Page Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">
                <i class="fas fa-cog mr-3 text-blue-600"></i>
                Einstellungen
            </h1>
            <p class="mt-2 text-gray-600">
                Verwalten Sie Ihre Account-Einstellungen und Präferenzen.
            </p>
        </div>

        <!-- Settings Categories -->
        <div class="space-y-6">
            <!-- Account Security -->
            <div class="bg-white shadow-lg rounded-lg">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">
                        <i class="fas fa-shield-alt mr-2 text-red-600"></i>
                        Account-Sicherheit
                    </h2>
                </div>
                
                <div class="p-6 space-y-4">
                    <div class="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div class="flex items-center">
                            <i class="fas fa-key text-yellow-600 mr-3"></i>
                            <div>
                                <h3 class="font-medium text-gray-900">Passwort ändern</h3>
                                <p class="text-sm text-gray-600">Aktualisieren Sie Ihr Passwort regelmäßig</p>
                            </div>
                        </div>
                        <button class="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors" disabled>
                            In Kürze verfügbar
                        </button>
                    </div>
                    
                    <div class="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div class="flex items-center">
                            <i class="fas fa-mobile-alt text-gray-600 mr-3"></i>
                            <div>
                                <h3 class="font-medium text-gray-900">Zwei-Faktor-Authentifizierung</h3>
                                <p class="text-sm text-gray-600">Zusätzliche Sicherheit für Ihren Account</p>
                            </div>
                        </div>
                        <button class="bg-gray-400 text-white px-4 py-2 rounded-lg cursor-not-allowed" disabled>
                            Zukünftig verfügbar
                        </button>
                    </div>
                    
                    <div class="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div class="flex items-center">
                            <i class="fas fa-history text-green-600 mr-3"></i>
                            <div>
                                <h3 class="font-medium text-gray-900">Aktivitätsverlauf</h3>
                                <p class="text-sm text-gray-600">Sehen Sie Ihre letzten Aktivitäten</p>
                            </div>
                        </div>
                        <button class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors" disabled>
                            In Entwicklung
                        </button>
                    </div>
                </div>
            </div>

            <!-- Data Management -->
            <div class="bg-white shadow-lg rounded-lg">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">
                        <i class="fas fa-database mr-2 text-blue-600"></i>
                        Daten-Verwaltung
                    </h2>
                </div>
                
                <div class="p-6 space-y-4">
                    <div class="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div class="flex items-center">
                            <i class="fas fa-download text-blue-600 mr-3"></i>
                            <div>
                                <h3 class="font-medium text-gray-900">Daten exportieren</h3>
                                <p class="text-sm text-gray-600">Laden Sie alle Ihre Daten herunter</p>
                            </div>
                        </div>
                        <button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors" disabled>
                            Bald verfügbar
                        </button>
                    </div>
                    
                    <div class="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div class="flex items-center">
                            <i class="fas fa-upload text-purple-600 mr-3"></i>
                            <div>
                                <h3 class="font-medium text-gray-900">Daten importieren</h3>
                                <p class="text-sm text-gray-600">Importieren Sie Daten aus anderen Quellen</p>
                            </div>
                        </div>
                        <button class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors" disabled>
                            Geplant für v1.1
                        </button>
                    </div>
                    
                    <div class="border-t pt-4">
                        <div class="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div class="flex items-center">
                                <i class="fas fa-trash-alt text-red-600 mr-3"></i>
                                <div>
                                    <h3 class="font-medium text-gray-900">Account löschen</h3>
                                    <p class="text-sm text-gray-600">Permanent alle Daten löschen</p>
                                </div>
                            </div>
                            <button class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors" onclick="showDeleteWarning()">
                                Account löschen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Privacy Settings -->
            <div class="bg-white shadow-lg rounded-lg">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">
                        <i class="fas fa-user-secret mr-2 text-green-600"></i>
                        Datenschutz-Einstellungen
                    </h2>
                </div>
                
                <div class="p-6 space-y-4">
                    <div class="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div class="flex items-center">
                            <i class="fas fa-cookie-bite text-brown-600 mr-3"></i>
                            <div>
                                <h3 class="font-medium text-gray-900">Cookie-Einstellungen</h3>
                                <p class="text-sm text-gray-600">Verwalten Sie Ihre Cookie-Präferenzen</p>
                            </div>
                        </div>
                        <button class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors" disabled>
                            Automatisch verwaltet
                        </button>
                    </div>
                    
                    <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div class="flex items-start">
                            <i class="fas fa-shield-alt text-green-600 mr-3 mt-1"></i>
                            <div>
                                <h3 class="font-medium text-gray-900 mb-2">DSGVO-Compliance</h3>
                                <p class="text-sm text-gray-600 mb-3">
                                    Ihre Daten werden gemäß der Datenschutz-Grundverordnung (DSGVO) verarbeitet.
                                </p>
                                <div class="space-x-2">
                                    <a href="legal/privacy.php" class="text-green-600 hover:text-green-700 text-sm underline">
                                        Datenschutzerklärung lesen
                                    </a>
                                    <span class="text-gray-400">•</span>
                                    <a href="legal/terms.php" class="text-green-600 hover:text-green-700 text-sm underline">
                                        AGB einsehen
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- App Information -->
            <div class="bg-white shadow-lg rounded-lg">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">
                        <i class="fas fa-info-circle mr-2 text-purple-600"></i>
                        Anwendungsinformationen
                    </h2>
                </div>
                
                <div class="p-6">
                    <div class="grid md:grid-cols-2 gap-6">
                        <div>
                            <h3 class="font-medium text-gray-900 mb-2">Version</h3>
                            <p class="text-sm text-gray-600">1.0.0 (Release)</p>
                        </div>
                        
                        <div>
                            <h3 class="font-medium text-gray-900 mb-2">Letztes Update</h3>
                            <p class="text-sm text-gray-600"><?php echo date('d.m.Y'); ?></p>
                        </div>
                        
                        <div>
                            <h3 class="font-medium text-gray-900 mb-2">Registriert seit</h3>
                            <p class="text-sm text-gray-600">
                                <?php echo formatDate($currentUser['created_at'] ?? date('Y-m-d H:i:s'), 'd.m.Y'); ?>
                            </p>
                        </div>
                        
                        <div>
                            <h3 class="font-medium text-gray-900 mb-2">Support</h3>
                            <a href="legal/imprint.php" class="text-sm text-blue-600 hover:text-blue-700 underline">
                                Kontakt & Impressum
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Medical Disclaimer -->
        <div class="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div class="flex">
                <i class="fas fa-exclamation-triangle text-yellow-600 mr-3 mt-1"></i>
                <div>
                    <h4 class="text-lg font-semibold text-yellow-800 mb-2">Wichtiger Hinweis</h4>
                    <p class="text-yellow-700">
                        Diese Anwendung dient ausschließlich der persönlichen Dokumentation und stellt keine 
                        medizinische Beratung dar. Bei gesundheitlichen Fragen oder vor der Einnahme neuer 
                        Nahrungsergänzungsmittel konsultieren Sie bitte qualifiziertes medizinisches Fachpersonal.
                    </p>
                </div>
            </div>
        </div>
    </main>

    <!-- Delete Warning Modal -->
    <div id="deleteWarningModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center hidden">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div class="p-6">
                <div class="flex items-center mb-4">
                    <i class="fas fa-exclamation-triangle text-red-600 text-2xl mr-3"></i>
                    <h3 class="text-lg font-semibold text-gray-900">Account löschen</h3>
                </div>
                
                <p class="text-gray-600 mb-6">
                    Diese Funktion ist noch nicht verfügbar. Wenn Sie Ihren Account löschen möchten, 
                    kontaktieren Sie uns bitte über das Impressum.
                </p>
                
                <div class="flex justify-end space-x-3">
                    <button 
                        onclick="hideDeleteWarning()" 
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Schließen
                    </button>
                    <a 
                        href="legal/imprint.php"
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Kontakt aufnehmen
                    </a>
                </div>
            </div>
        </div>
    </div>

    <script>
        function toggleUserMenu() {
            const menu = document.getElementById('user-menu');
            menu.classList.toggle('hidden');
        }

        function showDeleteWarning() {
            document.getElementById('deleteWarningModal').classList.remove('hidden');
        }

        function hideDeleteWarning() {
            document.getElementById('deleteWarningModal').classList.add('hidden');
        }

        // Menu schließen wenn außerhalb geklickt wird
        document.addEventListener('click', function(event) {
            const button = document.getElementById('user-menu-button');
            const menu = document.getElementById('user-menu');
            
            if (!button.contains(event.target) && !menu.contains(event.target)) {
                menu.classList.add('hidden');
            }
        });
    </script>
</body>
</html>