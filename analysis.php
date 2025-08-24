<?php
/**
 * Supplement Stack PHP - Analysis Page
 * All-Inkl Webserver kompatibel
 */

require_once 'config/config.php';

// Login erforderlich
requireLogin();

$pageTitle = 'Nährstoff-Analyse - ' . SITE_NAME;
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
                    <span class="ml-4 text-sm text-gray-500">Analyse</span>
                </div>
                
                <!-- Navigation -->
                <nav class="hidden md:flex items-center space-x-6">
                    <a href="dashboard.php" class="text-gray-700 hover:text-blue-600 transition-colors">Dashboard</a>
                    <a href="products.php" class="text-gray-700 hover:text-blue-600 transition-colors">Produkte</a>
                    <a href="stacks.php" class="text-gray-700 hover:text-blue-600 transition-colors">Stacks</a>
                    <a href="analysis.php" class="text-purple-600 font-medium">Analyse</a>
                </nav>
                
                <!-- User Menu -->
                <div class="relative">
                    <button 
                        id="user-menu-button"
                        class="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors"
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
                            <a href="settings.php" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
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

    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <!-- Page Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">
                <i class="fas fa-chart-line mr-3 text-purple-600"></i>
                Nährstoff-Analyse
            </h1>
            <p class="mt-2 text-gray-600">
                Analysieren Sie Ihre Nährstoffzufuhr und erhalten Sie Warnungen bei Überdosierungen.
            </p>
        </div>

        <!-- Analysis Coming Soon -->
        <div class="bg-white rounded-lg shadow-md p-8 text-center">
            <div class="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="fas fa-chart-line text-3xl text-purple-600"></i>
            </div>
            
            <h2 class="text-2xl font-bold text-gray-900 mb-4">
                Erweiterte Analyse-Features kommen bald
            </h2>
            
            <p class="text-gray-600 mb-8 max-w-2xl mx-auto">
                Wir arbeiten an fortgeschrittenen Analyse-Tools, die Ihnen helfen werden, 
                Ihre Nährstoffzufuhr zu optimieren und potentielle Überdosierungen zu erkennen.
            </p>

            <div class="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 mb-8">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Geplante Features:</h3>
                
                <div class="grid md:grid-cols-2 gap-6 text-left">
                    <div class="space-y-3">
                        <div class="flex items-start">
                            <i class="fas fa-exclamation-triangle text-yellow-500 mr-3 mt-1"></i>
                            <div>
                                <h4 class="font-medium text-gray-900">Überdosierungs-Warnungen</h4>
                                <p class="text-sm text-gray-600">Automatische Benachrichtigungen bei kritischen Dosierungen</p>
                            </div>
                        </div>
                        
                        <div class="flex items-start">
                            <i class="fas fa-chart-pie text-blue-500 mr-3 mt-1"></i>
                            <div>
                                <h4 class="font-medium text-gray-900">Nährstoff-Bilanz</h4>
                                <p class="text-sm text-gray-600">Visualisierung Ihrer täglichen Nährstoffaufnahme</p>
                            </div>
                        </div>
                        
                        <div class="flex items-start">
                            <i class="fas fa-user-md text-green-500 mr-3 mt-1"></i>
                            <div>
                                <h4 class="font-medium text-gray-900">Personalisierte Empfehlungen</h4>
                                <p class="text-sm text-gray-600">Basierend auf Ihrem Profil und Ihren Zielen</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <div class="flex items-start">
                            <i class="fas fa-interactions text-red-500 mr-3 mt-1"></i>
                            <div>
                                <h4 class="font-medium text-gray-900">Wechselwirkungen</h4>
                                <p class="text-sm text-gray-600">Erkennung von Nährstoff-Interaktionen</p>
                            </div>
                        </div>
                        
                        <div class="flex items-start">
                            <i class="fas fa-calendar-alt text-purple-500 mr-3 mt-1"></i>
                            <div>
                                <h4 class="font-medium text-gray-900">Verlaufsverfolgung</h4>
                                <p class="text-sm text-gray-600">Langzeit-Trends Ihrer Supplementierung</p>
                            </div>
                        </div>
                        
                        <div class="flex items-start">
                            <i class="fas fa-file-export text-indigo-500 mr-3 mt-1"></i>
                            <div>
                                <h4 class="font-medium text-gray-900">Export-Funktionen</h4>
                                <p class="text-sm text-gray-600">PDF-Berichte für Ihren Arzt oder Therapeuten</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Temporary Basic Analysis -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 class="text-lg font-semibold text-blue-800 mb-3">
                    <i class="fas fa-lightbulb mr-2"></i>
                    Basis-Analyse verfügbar
                </h3>
                <p class="text-blue-700 mb-4">
                    Nutzen Sie in der Zwischenzeit die Kostenberechnung in der Produkt-Verwaltung, 
                    um einen Überblick über Ihre aktuelle Supplementierung zu erhalten.
                </p>
                <div class="space-x-4">
                    <a href="products.php" class="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        <i class="fas fa-pills mr-2"></i>
                        Zu den Produkten
                    </a>
                    <a href="stacks.php" class="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                        <i class="fas fa-layer-group mr-2"></i>
                        Zu den Stacks
                    </a>
                </div>
            </div>
        </div>

        <!-- Medical Disclaimer -->
        <div class="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div class="flex">
                <i class="fas fa-exclamation-triangle text-yellow-600 mr-3 mt-1"></i>
                <div>
                    <h4 class="text-lg font-semibold text-yellow-800 mb-2">Wichtiger medizinischer Hinweis</h4>
                    <p class="text-yellow-700">
                        Diese Analyse-Tools dienen ausschließlich der Information und stellen keine medizinische Beratung dar. 
                        Konsultieren Sie bei Fragen zu Dosierungen, Wechselwirkungen oder gesundheitlichen Bedenken 
                        immer einen qualifizierten Arzt oder Apotheker.
                    </p>
                </div>
            </div>
        </div>
    </main>

    <script>
        function toggleUserMenu() {
            const menu = document.getElementById('user-menu');
            menu.classList.toggle('hidden');
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