<?php
/**
 * Supplement Stack PHP - Products Management
 * All-Inkl Webserver kompatibel
 */

require_once 'config/config.php';

// Login erforderlich
requireLogin();

$pageTitle = 'Produkte - ' . SITE_NAME;
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
                    <span class="ml-4 text-sm text-gray-500">Produkte</span>
                </div>
                
                <!-- Navigation -->
                <nav class="hidden md:flex items-center space-x-6">
                    <a href="dashboard.php" class="text-gray-700 hover:text-blue-600 transition-colors">Dashboard</a>
                    <a href="products.php" class="text-blue-600 font-medium">Produkte</a>
                    <a href="stacks.php" class="text-gray-700 hover:text-blue-600 transition-colors">Stacks</a>
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
                        <i class="fas fa-pills mr-3 text-blue-600"></i>
                        Produkte verwalten
                    </h1>
                    <p class="mt-2 text-gray-600">
                        Erfassen und verwalten Sie Ihre Nahrungsergänzungsmittel mit allen Details.
                    </p>
                </div>
                <button 
                    onclick="openAddProductModal()" 
                    class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <i class="fas fa-plus mr-2"></i>
                    Neues Produkt
                </button>
            </div>
        </div>

        <!-- Search and Filter -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <label for="productSearch" class="block text-sm font-medium text-gray-700 mb-2">
                        Produkte suchen
                    </label>
                    <input 
                        type="text" 
                        id="productSearch" 
                        placeholder="Nach Name, Marke oder Inhaltsstoffen suchen..."
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                </div>
                <div class="md:w-48">
                    <label for="categoryFilter" class="block text-sm font-medium text-gray-700 mb-2">
                        Kategorie
                    </label>
                    <select 
                        id="categoryFilter"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">Alle Kategorien</option>
                        <option value="vitamins">Vitamine</option>
                        <option value="minerals">Mineralstoffe</option>
                        <option value="amino_acids">Aminosäuren</option>
                        <option value="fatty_acids">Fettsäuren</option>
                        <option value="probiotics">Probiotika</option>
                        <option value="herbs">Pflanzenstoffe</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Products List -->
        <div class="bg-white rounded-lg shadow-md">
            <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-lg font-semibold text-gray-900">
                    Ihre Produkte
                    <span id="productCount" class="text-sm text-gray-500 ml-2">(Wird geladen...)</span>
                </h2>
            </div>
            
            <div id="productsList" class="p-6">
                <!-- Loading State -->
                <div class="text-center py-12">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p class="text-gray-500">Produkte werden geladen...</p>
                </div>
            </div>
        </div>

        <!-- Cost Calculator Section -->
        <div class="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">
                <i class="fas fa-calculator mr-2 text-green-600"></i>
                Kostenrechner
            </h2>
            <p class="text-gray-600 mb-4">
                Wählen Sie Produkte aus, um die geschätzten Kosten zu berechnen:
            </p>
            
            <div id="costCalculationResult">
                <!-- Wird von JavaScript gefüllt -->
            </div>
        </div>
    </main>

    <!-- Add Product Modal (wird von JavaScript gesteuert) -->
    <div id="addProductModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center hidden">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-90vh overflow-y-auto">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900">Neues Produkt hinzufügen</h3>
                <button onclick="closeAddProductModal()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <form id="productForm" class="p-6">
                <!-- Formular wird von JavaScript erstellt -->
                <div class="text-center py-8">
                    <p class="text-gray-500">JavaScript wird geladen...</p>
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

        function openAddProductModal() {
            document.getElementById('addProductModal').classList.remove('hidden');
        }

        function closeAddProductModal() {
            document.getElementById('addProductModal').classList.add('hidden');
        }

        // Menu schließen wenn außerhalb geklickt wird
        document.addEventListener('click', function(event) {
            const button = document.getElementById('user-menu-button');
            const menu = document.getElementById('user-menu');
            
            if (!button.contains(event.target) && !menu.contains(event.target)) {
                menu.classList.add('hidden');
            }
        });

        // Produkte laden wenn Seite geladen ist
        document.addEventListener('DOMContentLoaded', function() {
            if (window.stackManager) {
                window.stackManager.loadProducts();
            }
        });
    </script>
</body>
</html>