<?php
/**
 * Gemeinsame Navigation für alle authentifizierten Seiten
 * All-Inkl Webserver kompatibel
 */

if (!defined('CONFIG_LOADED')) {
    require_once __DIR__ . '/../config/config.php';
}

// Aktueller Benutzer laden falls eingeloggt
$currentUser = null;
if (isset($_SESSION['user_id'])) {
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT name, email FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $currentUser = $stmt->fetch();
    } catch (PDOException $e) {
        logMessage("Error loading current user: " . $e->getMessage(), 'ERROR');
    }
}

// Aktuelle Seite bestimmen
$currentPage = basename($_SERVER['PHP_SELF'], '.php');
?>

<!-- Header Navigation -->
<header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
            <div class="flex items-center">
                <a href="<?php echo url('dashboard.php'); ?>" class="text-2xl font-bold text-blue-600">
                    <i class="fas fa-capsules mr-2"></i>
                    <?php echo e(SITE_NAME); ?>
                </a>
                <?php if (isset($pageSubtitle)): ?>
                    <span class="ml-4 text-sm text-gray-500"><?php echo e($pageSubtitle); ?></span>
                <?php endif; ?>
            </div>
            
            <!-- Hauptnavigation -->
            <nav class="hidden md:flex items-center space-x-6">
                <a href="<?php echo url('dashboard.php'); ?>" 
                   class="<?php echo $currentPage === 'dashboard' ? 'text-blue-600 font-medium' : 'text-gray-700 hover:text-blue-600'; ?> transition-colors">
                    <i class="fas fa-tachometer-alt mr-1"></i>Dashboard
                </a>
                <a href="<?php echo url('products.php'); ?>" 
                   class="<?php echo $currentPage === 'products' ? 'text-blue-600 font-medium' : 'text-gray-700 hover:text-blue-600'; ?> transition-colors">
                    <i class="fas fa-pills mr-1"></i>Produkte
                </a>
                <a href="<?php echo url('stacks.php'); ?>" 
                   class="<?php echo $currentPage === 'stacks' ? 'text-blue-600 font-medium' : 'text-gray-700 hover:text-blue-600'; ?> transition-colors">
                    <i class="fas fa-layer-group mr-1"></i>Stacks
                </a>
                <a href="<?php echo url('analysis.php'); ?>" 
                   class="<?php echo $currentPage === 'analysis' ? 'text-blue-600 font-medium' : 'text-gray-700 hover:text-blue-600'; ?> transition-colors">
                    <i class="fas fa-chart-line mr-1"></i>Analyse
                </a>
            </nav>
            
            <!-- User Menu -->
            <div class="relative">
                <?php if (isset($_SESSION['user_id'])): ?>
                    <!-- Authenticated User Menu -->
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
                            <div class="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
                                Angemeldet als <strong><?php echo e($currentUser['name'] ?? 'Benutzer'); ?></strong>
                            </div>
                            <a href="<?php echo url('profile.php'); ?>" 
                               class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 <?php echo $currentPage === 'profile' ? 'bg-blue-50 text-blue-600' : ''; ?>">
                                <i class="fas fa-user mr-2"></i>Profil
                            </a>
                            <a href="<?php echo url('settings.php'); ?>" 
                               class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 <?php echo $currentPage === 'settings' ? 'bg-blue-50 text-blue-600' : ''; ?>">
                                <i class="fas fa-cog mr-2"></i>Einstellungen
                            </a>
                            <div class="border-t border-gray-100"></div>
                            <a href="<?php echo url('logout.php'); ?>" 
                               class="block px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                <i class="fas fa-sign-out-alt mr-2"></i>Abmelden
                            </a>
                        </div>
                    </div>
                <?php else: ?>
                    <!-- Guest Menu -->
                    <div class="flex items-center space-x-4">
                        <a href="<?php echo url('login.php'); ?>" 
                           class="text-gray-700 hover:text-blue-600 transition-colors">
                            Anmelden
                        </a>
                        <a href="<?php echo url('register.php'); ?>" 
                           class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                            Registrieren
                        </a>
                    </div>
                <?php endif; ?>
            </div>
            
            <!-- Mobile Menu Button -->
            <div class="md:hidden">
                <button 
                    id="mobile-menu-button"
                    class="text-gray-700 hover:text-blue-600 p-2"
                    onclick="toggleMobileMenu()"
                >
                    <i class="fas fa-bars text-xl"></i>
                </button>
            </div>
        </div>
    </div>
    
    <!-- Mobile Navigation -->
    <div id="mobile-menu" class="hidden md:hidden bg-white border-t border-gray-200">
        <div class="px-4 py-2 space-y-1">
            <?php if (isset($_SESSION['user_id'])): ?>
                <a href="<?php echo url('dashboard.php'); ?>" 
                   class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md <?php echo $currentPage === 'dashboard' ? 'bg-blue-50 text-blue-600' : ''; ?>">
                    <i class="fas fa-tachometer-alt mr-2"></i>Dashboard
                </a>
                <a href="<?php echo url('products.php'); ?>" 
                   class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md <?php echo $currentPage === 'products' ? 'bg-blue-50 text-blue-600' : ''; ?>">
                    <i class="fas fa-pills mr-2"></i>Produkte
                </a>
                <a href="<?php echo url('stacks.php'); ?>" 
                   class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md <?php echo $currentPage === 'stacks' ? 'bg-blue-50 text-blue-600' : ''; ?>">
                    <i class="fas fa-layer-group mr-2"></i>Stacks
                </a>
                <a href="<?php echo url('analysis.php'); ?>" 
                   class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md <?php echo $currentPage === 'analysis' ? 'bg-blue-50 text-blue-600' : ''; ?>">
                    <i class="fas fa-chart-line mr-2"></i>Analyse
                </a>
                <div class="border-t border-gray-100 mt-2 pt-2">
                    <a href="<?php echo url('profile.php'); ?>" 
                       class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <i class="fas fa-user mr-2"></i>Profil
                    </a>
                    <a href="<?php echo url('settings.php'); ?>" 
                       class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <i class="fas fa-cog mr-2"></i>Einstellungen
                    </a>
                    <a href="<?php echo url('logout.php'); ?>" 
                       class="block px-3 py-2 text-red-600 hover:bg-red-50 rounded-md">
                        <i class="fas fa-sign-out-alt mr-2"></i>Abmelden
                    </a>
                </div>
            <?php else: ?>
                <a href="<?php echo url('login.php'); ?>" 
                   class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                    Anmelden
                </a>
                <a href="<?php echo url('register.php'); ?>" 
                   class="block px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Registrieren
                </a>
            <?php endif; ?>
        </div>
    </div>
</header>

<script>
// Mobile Menu Toggle
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}
</script>