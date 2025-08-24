<?php
/**
 * Supplement Stack PHP - Dashboard
 * All-Inkl Webserver kompatibel
 */

require_once 'config/config.php';

// Login erforderlich
requireLogin();

// Benutzerdaten und Statistiken laden
try {
    $pdo = getDBConnection();
    
    // Basis-Statistiken
    $stats = [];
    
    // Anzahl Produkte
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM products WHERE user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $stats['products_count'] = $stmt->fetchColumn();
    
    // Anzahl Stacks
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM stacks WHERE user_id = ? AND is_active = 1");
    $stmt->execute([$_SESSION['user_id']]);
    $stats['stacks_count'] = $stmt->fetchColumn();
    
    // Aktive Stack-Elemente
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM stack_items si 
        JOIN stacks s ON si.stack_id = s.id 
        WHERE s.user_id = ? AND s.is_active = 1 AND si.is_active = 1
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $stats['active_items'] = $stmt->fetchColumn();
    
    // Geschätzte monatliche Kosten
    $stmt = $pdo->prepare("
        SELECT SUM(p.unit_cost * si.dosage * si.frequency_per_day * 30) as monthly_cost
        FROM stack_items si 
        JOIN stacks s ON si.stack_id = s.id 
        JOIN products p ON si.product_id = p.id
        WHERE s.user_id = ? AND s.is_active = 1 AND si.is_active = 1 AND p.unit_cost IS NOT NULL
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $stats['monthly_cost'] = $stmt->fetchColumn() ?? 0;
    
    // Kürzlich hinzugefügte Produkte
    $stmt = $pdo->prepare("
        SELECT name, brand, created_at 
        FROM products 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 5
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $recent_products = $stmt->fetchAll();
    
    // Aktive Stacks
    $stmt = $pdo->prepare("
        SELECT s.*, COUNT(si.id) as item_count
        FROM stacks s 
        LEFT JOIN stack_items si ON s.id = si.stack_id AND si.is_active = 1
        WHERE s.user_id = ? AND s.is_active = 1
        GROUP BY s.id
        ORDER BY s.updated_at DESC
        LIMIT 5
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $active_stacks = $stmt->fetchAll();

} catch (PDOException $e) {
    logMessage("Database error in dashboard: " . $e->getMessage(), 'ERROR');
    $stats = ['products_count' => 0, 'stacks_count' => 0, 'active_items' => 0, 'monthly_cost' => 0];
    $recent_products = [];
    $active_stacks = [];
}

$pageTitle = 'Dashboard - ' . SITE_NAME;
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo e($pageTitle); ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <meta name="description" content="Ihr persönliches Supplement Stack Dashboard">
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <h1 class="text-2xl font-bold text-blue-600">
                        <i class="fas fa-capsules mr-2"></i>
                        <?php echo e(SITE_NAME); ?>
                    </h1>
                    <span class="ml-4 text-sm text-gray-500">Dashboard</span>
                </div>
                
                <!-- Navigation -->
                <nav class="hidden md:flex items-center space-x-6">
                    <a href="dashboard.php" class="text-blue-600 font-medium">Dashboard</a>
                    <a href="products.php" class="text-gray-700 hover:text-blue-600 transition-colors">Produkte</a>
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
        <!-- Welcome Section -->
        <div class="mb-8">
            <h2 class="text-3xl font-bold text-gray-900">
                Willkommen zurück, <?php echo e($currentUser['name'] ?? 'Benutzer'); ?>!
            </h2>
            <p class="mt-2 text-gray-600">
                Hier ist eine Übersicht über Ihre Supplement-Verwaltung.
            </p>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <!-- Produkte -->
            <div class="bg-white overflow-hidden shadow-lg rounded-lg">
                <div class="p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                                <i class="fas fa-pills text-white"></i>
                            </div>
                        </div>
                        <div class="ml-4 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">
                                    Produkte
                                </dt>
                                <dd class="text-2xl font-bold text-gray-900">
                                    <?php echo number_format($stats['products_count']); ?>
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 px-6 py-3">
                    <div class="text-sm">
                        <a href="products.php" class="font-medium text-blue-600 hover:text-blue-500">
                            Alle anzeigen <i class="fas fa-arrow-right ml-1"></i>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Stacks -->
            <div class="bg-white overflow-hidden shadow-lg rounded-lg">
                <div class="p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                                <i class="fas fa-layer-group text-white"></i>
                            </div>
                        </div>
                        <div class="ml-4 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">
                                    Aktive Stacks
                                </dt>
                                <dd class="text-2xl font-bold text-gray-900">
                                    <?php echo number_format($stats['stacks_count']); ?>
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 px-6 py-3">
                    <div class="text-sm">
                        <a href="stacks.php" class="font-medium text-green-600 hover:text-green-500">
                            Verwalten <i class="fas fa-arrow-right ml-1"></i>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Stack Items -->
            <div class="bg-white overflow-hidden shadow-lg rounded-lg">
                <div class="p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                                <i class="fas fa-capsules text-white"></i>
                            </div>
                        </div>
                        <div class="ml-4 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">
                                    Aktive Supplements
                                </dt>
                                <dd class="text-2xl font-bold text-gray-900">
                                    <?php echo number_format($stats['active_items']); ?>
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 px-6 py-3">
                    <div class="text-sm">
                        <a href="analysis.php" class="font-medium text-purple-600 hover:text-purple-500">
                            Analysieren <i class="fas fa-arrow-right ml-1"></i>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Monatliche Kosten -->
            <div class="bg-white overflow-hidden shadow-lg rounded-lg">
                <div class="p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                                <i class="fas fa-euro-sign text-white"></i>
                            </div>
                        </div>
                        <div class="ml-4 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">
                                    Monatliche Kosten
                                </dt>
                                <dd class="text-2xl font-bold text-gray-900">
                                    <?php echo formatPrice($stats['monthly_cost']); ?>
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 px-6 py-3">
                    <div class="text-sm">
                        <span class="text-gray-500">Geschätzt basierend auf aktiven Stacks</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick Actions -->
        <div class="mb-8">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Schnellaktionen</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <a href="products.php?action=add" class="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-plus text-blue-600"></i>
                        </div>
                        <div class="ml-4">
                            <h4 class="text-lg font-medium text-gray-900">Produkt hinzufügen</h4>
                            <p class="text-sm text-gray-500">Neues Supplement erfassen</p>
                        </div>
                    </div>
                </a>
                
                <a href="stacks.php?action=create" class="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-layer-group text-green-600"></i>
                        </div>
                        <div class="ml-4">
                            <h4 class="text-lg font-medium text-gray-900">Stack erstellen</h4>
                            <p class="text-sm text-gray-500">Neue Kombination planen</p>
                        </div>
                    </div>
                </a>
                
                <a href="analysis.php" class="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-chart-line text-purple-600"></i>
                        </div>
                        <div class="ml-4">
                            <h4 class="text-lg font-medium text-gray-900">Analyse starten</h4>
                            <p class="text-sm text-gray-500">Nährstoffbilanz prüfen</p>
                        </div>
                    </div>
                </a>
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Kürzlich hinzugefügte Produkte -->
            <div class="bg-white shadow-lg rounded-lg">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">
                        <i class="fas fa-clock mr-2 text-blue-600"></i>
                        Kürzlich hinzugefügt
                    </h3>
                </div>
                <div class="px-6 py-4">
                    <?php if (empty($recent_products)): ?>
                        <div class="text-center py-8">
                            <i class="fas fa-pills text-gray-300 text-4xl mb-4"></i>
                            <p class="text-gray-500">Noch keine Produkte hinzugefügt.</p>
                            <a href="products.php?action=add" class="mt-2 inline-block text-blue-600 hover:text-blue-500">
                                Erstes Produkt hinzufügen
                            </a>
                        </div>
                    <?php else: ?>
                        <div class="space-y-4">
                            <?php foreach ($recent_products as $product): ?>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="font-medium text-gray-900"><?php echo e($product['name']); ?></h4>
                                        <?php if ($product['brand']): ?>
                                            <p class="text-sm text-gray-500"><?php echo e($product['brand']); ?></p>
                                        <?php endif; ?>
                                    </div>
                                    <div class="text-sm text-gray-500">
                                        <?php echo formatDate($product['created_at'], 'd.m.Y'); ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <div class="mt-4 pt-4 border-t border-gray-200">
                            <a href="products.php" class="text-sm font-medium text-blue-600 hover:text-blue-500">
                                Alle Produkte anzeigen <i class="fas fa-arrow-right ml-1"></i>
                            </a>
                        </div>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Aktive Stacks -->
            <div class="bg-white shadow-lg rounded-lg">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">
                        <i class="fas fa-layer-group mr-2 text-green-600"></i>
                        Aktive Stacks
                    </h3>
                </div>
                <div class="px-6 py-4">
                    <?php if (empty($active_stacks)): ?>
                        <div class="text-center py-8">
                            <i class="fas fa-layer-group text-gray-300 text-4xl mb-4"></i>
                            <p class="text-gray-500">Noch keine Stacks erstellt.</p>
                            <a href="stacks.php?action=create" class="mt-2 inline-block text-green-600 hover:text-green-500">
                                Ersten Stack erstellen
                            </a>
                        </div>
                    <?php else: ?>
                        <div class="space-y-4">
                            <?php foreach ($active_stacks as $stack): ?>
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="font-medium text-gray-900"><?php echo e($stack['name']); ?></h4>
                                        <p class="text-sm text-gray-500">
                                            <?php echo $stack['item_count']; ?> Element<?php echo $stack['item_count'] != 1 ? 'e' : ''; ?>
                                            <?php if ($stack['target_goal']): ?>
                                                • <?php echo e($stack['target_goal']); ?>
                                            <?php endif; ?>
                                        </p>
                                    </div>
                                    <div class="text-sm text-gray-500">
                                        <?php echo formatDate($stack['updated_at'], 'd.m.Y'); ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <div class="mt-4 pt-4 border-t border-gray-200">
                            <a href="stacks.php" class="text-sm font-medium text-green-600 hover:text-green-500">
                                Alle Stacks verwalten <i class="fas fa-arrow-right ml-1"></i>
                            </a>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- Warning Disclaimer -->
        <div class="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div class="flex">
                <i class="fas fa-exclamation-triangle text-yellow-600 mr-3 mt-1"></i>
                <div>
                    <h4 class="text-sm font-medium text-yellow-800">Wichtiger Hinweis</h4>
                    <p class="text-sm text-yellow-700 mt-1">
                        Diese Anwendung stellt keine medizinische Beratung dar. Konsultieren Sie bei gesundheitlichen Fragen 
                        oder vor der Einnahme neuer Nahrungsergänzungsmittel immer einen Arzt oder Apotheker.
                    </p>
                </div>
            </div>
        </div>
    </main>

    <!-- Mobile Menu Toggle für Navigation -->
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