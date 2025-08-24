<?php
/**
 * Supplement Stack PHP - Stacks Management
 * All-Inkl Webserver kompatibel
 */

require_once 'config/config.php';

// Login erforderlich
requireLogin();

$pageTitle = 'Stacks - ' . SITE_NAME;
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
                    <span class="ml-4 text-sm text-gray-500">Stacks</span>
                </div>
                
                <!-- Navigation -->
                <nav class="hidden md:flex items-center space-x-6">
                    <a href="dashboard.php" class="text-gray-700 hover:text-blue-600 transition-colors">Dashboard</a>
                    <a href="products.php" class="text-gray-700 hover:text-blue-600 transition-colors">Produkte</a>
                    <a href="stacks.php" class="text-blue-600 font-medium">Stacks</a>
                    <a href="analysis.php" class="text-gray-700 hover:text-blue-600 transition-colors">Analyse</a>
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
            <div class="flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">
                        <i class="fas fa-layer-group mr-3 text-green-600"></i>
                        Stack-Verwaltung
                    </h1>
                    <p class="mt-2 text-gray-600">
                        Erstellen und verwalten Sie Ihre personalisierten Supplement-Kombinationen.
                    </p>
                </div>
                <button 
                    onclick="openCreateStackModal()" 
                    class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                    <i class="fas fa-plus mr-2"></i>
                    Neuer Stack
                </button>
            </div>
        </div>

        <!-- Search and Filter -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <label for="stackSearch" class="block text-sm font-medium text-gray-700 mb-2">
                        Stacks suchen
                    </label>
                    <input 
                        type="text" 
                        id="stackSearch" 
                        placeholder="Nach Stack-Namen oder Zielen suchen..."
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    >
                </div>
                <div class="md:w-48">
                    <label for="statusFilter" class="block text-sm font-medium text-gray-700 mb-2">
                        Status
                    </label>
                    <select 
                        id="statusFilter"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    >
                        <option value="">Alle Stacks</option>
                        <option value="active">Nur aktive</option>
                        <option value="inactive">Nur inaktive</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Stacks Grid -->
        <div id="stacksList" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Loading State -->
            <div class="col-span-full text-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p class="text-gray-500">Stacks werden geladen...</p>
            </div>
        </div>

        <!-- Empty State -->
        <div id="emptyState" class="hidden text-center py-12">
            <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-layer-group text-3xl text-gray-400"></i>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Noch keine Stacks erstellt</h3>
            <p class="text-gray-500 mb-6">Erstellen Sie Ihren ersten Stack, um loszulegen.</p>
            <button 
                onclick="openCreateStackModal()" 
                class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
                <i class="fas fa-plus mr-2"></i>
                Ersten Stack erstellen
            </button>
        </div>
    </main>

    <!-- Create Stack Modal -->
    <div id="createStackModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center hidden">
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900">Neuen Stack erstellen</h3>
                <button onclick="closeCreateStackModal()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <form id="stackForm" class="p-6">
                <div class="space-y-4">
                    <div>
                        <label for="stackName" class="block text-sm font-medium text-gray-700 mb-2">
                            Stack-Name *
                        </label>
                        <input 
                            type="text" 
                            id="stackName" 
                            name="name" 
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                            placeholder="z.B. Morgen-Stack, Training, Immunsystem"
                        >
                    </div>
                    
                    <div>
                        <label for="stackDescription" class="block text-sm font-medium text-gray-700 mb-2">
                            Beschreibung
                        </label>
                        <textarea 
                            id="stackDescription" 
                            name="description" 
                            rows="3"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                            placeholder="Beschreiben Sie den Zweck dieses Stacks..."
                        ></textarea>
                    </div>
                    
                    <div>
                        <label for="stackGoal" class="block text-sm font-medium text-gray-700 mb-2">
                            Ziel/Zweck
                        </label>
                        <input 
                            type="text" 
                            id="stackGoal" 
                            name="target_goal"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                            placeholder="z.B. Immunsystem stärken, Energie steigern"
                        >
                    </div>
                    
                    <div class="flex items-center">
                        <input 
                            type="checkbox" 
                            id="stackActive" 
                            name="is_active" 
                            checked
                            class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        >
                        <label for="stackActive" class="ml-2 block text-sm text-gray-900">
                            Stack aktiv (wird bei Berechnungen berücksichtigt)
                        </label>
                    </div>
                </div>
                
                <div class="flex justify-end space-x-3 mt-6">
                    <button 
                        type="button" 
                        onclick="closeCreateStackModal()"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Abbrechen
                    </button>
                    <button 
                        type="submit"
                        class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                    >
                        <i class="fas fa-plus mr-1"></i>
                        Stack erstellen
                    </button>
                </div>
            </form>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="<?php echo asset('js/stack-manager.js'); ?>"></script>
    <script>
        function toggleUserMenu() {
            const menu = document.getElementById('user-menu');
            menu.classList.toggle('hidden');
        }

        function openCreateStackModal() {
            document.getElementById('createStackModal').classList.remove('hidden');
        }

        function closeCreateStackModal() {
            document.getElementById('createStackModal').classList.add('hidden');
            document.getElementById('stackForm').reset();
        }

        // Menu schließen wenn außerhalb geklickt wird
        document.addEventListener('click', function(event) {
            const button = document.getElementById('user-menu-button');
            const menu = document.getElementById('user-menu');
            
            if (!button.contains(event.target) && !menu.contains(event.target)) {
                menu.classList.add('hidden');
            }
        });

        // Stacks laden wenn Seite geladen ist
        document.addEventListener('DOMContentLoaded', function() {
            if (window.stackManager) {
                window.stackManager.loadStacks();
            }
        });
    </script>
</body>
</html>