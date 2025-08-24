<?php
/**
 * Supplement Stack PHP - User Profile
 * All-Inkl Webserver kompatibel
 */

require_once 'config/config.php';

// Login erforderlich
requireLogin();

$success = '';
$error = '';

// Profil-Update verarbeiten
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // CSRF-Token prüfen
    if (!validateCSRFToken($_POST['csrf_token'] ?? '')) {
        $error = 'Sicherheitsfehler. Bitte versuchen Sie es erneut.';
    } else {
        $name = sanitizeInput($_POST['name'] ?? '');
        $age = !empty($_POST['age']) ? (int)$_POST['age'] : null;
        $gender = sanitizeInput($_POST['gender'] ?? '');
        $weight = !empty($_POST['weight']) ? (float)$_POST['weight'] : null;
        $height = !empty($_POST['height']) ? (int)$_POST['height'] : null;
        $activity_level = sanitizeInput($_POST['activity_level'] ?? '');
        $health_goals = sanitizeInput($_POST['health_goals'] ?? '');
        $medical_conditions = sanitizeInput($_POST['medical_conditions'] ?? '');
        $allergies = sanitizeInput($_POST['allergies'] ?? '');
        
        if (empty($name)) {
            $error = 'Name ist erforderlich.';
        } else {
            try {
                $pdo = getDBConnection();
                
                $stmt = $pdo->prepare("
                    UPDATE users SET 
                        name = ?, age = ?, gender = ?, weight = ?, height = ?, 
                        activity_level = ?, health_goals = ?, medical_conditions = ?, 
                        allergies = ?, updated_at = NOW()
                    WHERE id = ?
                ");
                
                $stmt->execute([
                    $name, $age, $gender ?: null, $weight, $height,
                    $activity_level ?: null, $health_goals, $medical_conditions,
                    $allergies, $_SESSION['user_id']
                ]);
                
                // Session-Daten aktualisieren
                $_SESSION['user_name'] = $name;
                
                // Aktivitäts-Log
                logActivity($_SESSION['user_id'], 'update_profile', 'user', $_SESSION['user_id'], 'Profil aktualisiert');
                
                $success = 'Profil erfolgreich aktualisiert!';
                
                // Aktualisierte Daten laden
                $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
                $stmt->execute([$_SESSION['user_id']]);
                $currentUser = $stmt->fetch();
                
            } catch (PDOException $e) {
                logMessage("Database error updating profile: " . $e->getMessage(), 'ERROR');
                $error = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
            }
        }
    }
}

$pageTitle = 'Profil - ' . SITE_NAME;
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
                    <span class="ml-4 text-sm text-gray-500">Profil</span>
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
                            <a href="profile.php" class="block px-4 py-2 text-sm text-blue-600 bg-blue-50 font-medium">
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

    <main class="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <!-- Page Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">
                <i class="fas fa-user mr-3 text-blue-600"></i>
                Mein Profil
            </h1>
            <p class="mt-2 text-gray-600">
                Verwalten Sie Ihre persönlichen Daten für personalisierte Empfehlungen.
            </p>
        </div>

        <!-- Messages -->
        <?php if ($error): ?>
            <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div class="flex">
                    <i class="fas fa-exclamation-circle text-red-400 mr-2 mt-1"></i>
                    <p class="text-sm text-red-600"><?php echo e($error); ?></p>
                </div>
            </div>
        <?php endif; ?>

        <?php if ($success): ?>
            <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div class="flex">
                    <i class="fas fa-check-circle text-green-400 mr-2 mt-1"></i>
                    <p class="text-sm text-green-600"><?php echo e($success); ?></p>
                </div>
            </div>
        <?php endif; ?>

        <!-- Profile Form -->
        <div class="bg-white shadow-lg rounded-lg">
            <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-lg font-semibold text-gray-900">Persönliche Informationen</h2>
            </div>
            
            <form method="POST" action="profile.php" class="p-6 space-y-6">
                <input type="hidden" name="csrf_token" value="<?php echo generateCSRFToken(); ?>">
                
                <!-- Basis-Daten -->
                <div class="grid md:grid-cols-2 gap-6">
                    <div>
                        <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
                            Name *
                        </label>
                        <input 
                            type="text" 
                            id="name" 
                            name="name" 
                            required
                            value="<?php echo e($currentUser['name'] ?? ''); ?>"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                    </div>
                    
                    <div>
                        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                            E-Mail-Adresse
                        </label>
                        <input 
                            type="email" 
                            id="email" 
                            value="<?php echo e($currentUser['email'] ?? ''); ?>"
                            disabled
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500"
                        >
                        <p class="mt-1 text-xs text-gray-500">E-Mail-Adresse kann nicht geändert werden</p>
                    </div>
                </div>

                <!-- Körperliche Daten -->
                <div class="border-t pt-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Körperliche Daten</h3>
                    
                    <div class="grid md:grid-cols-3 gap-6">
                        <div>
                            <label for="age" class="block text-sm font-medium text-gray-700 mb-2">
                                Alter (Jahre)
                            </label>
                            <input 
                                type="number" 
                                id="age" 
                                name="age" 
                                min="16" 
                                max="120"
                                value="<?php echo e($currentUser['age'] ?? ''); ?>"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                        </div>
                        
                        <div>
                            <label for="weight" class="block text-sm font-medium text-gray-700 mb-2">
                                Gewicht (kg)
                            </label>
                            <input 
                                type="number" 
                                id="weight" 
                                name="weight" 
                                step="0.1" 
                                min="30" 
                                max="300"
                                value="<?php echo e($currentUser['weight'] ?? ''); ?>"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                        </div>
                        
                        <div>
                            <label for="height" class="block text-sm font-medium text-gray-700 mb-2">
                                Größe (cm)
                            </label>
                            <input 
                                type="number" 
                                id="height" 
                                name="height" 
                                min="120" 
                                max="250"
                                value="<?php echo e($currentUser['height'] ?? ''); ?>"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                        </div>
                    </div>
                    
                    <div class="grid md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label for="gender" class="block text-sm font-medium text-gray-700 mb-2">
                                Geschlecht
                            </label>
                            <select 
                                id="gender" 
                                name="gender"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Bitte wählen</option>
                                <option value="male" <?php echo ($currentUser['gender'] ?? '') === 'male' ? 'selected' : ''; ?>>Männlich</option>
                                <option value="female" <?php echo ($currentUser['gender'] ?? '') === 'female' ? 'selected' : ''; ?>>Weiblich</option>
                                <option value="diverse" <?php echo ($currentUser['gender'] ?? '') === 'diverse' ? 'selected' : ''; ?>>Divers</option>
                            </select>
                        </div>
                        
                        <div>
                            <label for="activity_level" class="block text-sm font-medium text-gray-700 mb-2">
                                Aktivitätslevel
                            </label>
                            <select 
                                id="activity_level" 
                                name="activity_level"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Bitte wählen</option>
                                <option value="sedentary" <?php echo ($currentUser['activity_level'] ?? '') === 'sedentary' ? 'selected' : ''; ?>>Wenig aktiv (Bürojob)</option>
                                <option value="light" <?php echo ($currentUser['activity_level'] ?? '') === 'light' ? 'selected' : ''; ?>>Leicht aktiv (1-3x/Woche Sport)</option>
                                <option value="moderate" <?php echo ($currentUser['activity_level'] ?? '') === 'moderate' ? 'selected' : ''; ?>>Mäßig aktiv (3-5x/Woche Sport)</option>
                                <option value="active" <?php echo ($currentUser['activity_level'] ?? '') === 'active' ? 'selected' : ''; ?>>Sehr aktiv (6-7x/Woche Sport)</option>
                                <option value="very_active" <?php echo ($currentUser['activity_level'] ?? '') === 'very_active' ? 'selected' : ''; ?>>Extrem aktiv (2x täglich Sport)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Gesundheitsdaten -->
                <div class="border-t pt-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Gesundheitsinformationen</h3>
                    
                    <div class="space-y-6">
                        <div>
                            <label for="health_goals" class="block text-sm font-medium text-gray-700 mb-2">
                                Gesundheitsziele
                            </label>
                            <textarea 
                                id="health_goals" 
                                name="health_goals" 
                                rows="3"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="z.B. Muskelaufbau, Gewichtsreduktion, besserer Schlaf, mehr Energie..."
                            ><?php echo e($currentUser['health_goals'] ?? ''); ?></textarea>
                        </div>
                        
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <label for="medical_conditions" class="block text-sm font-medium text-gray-700 mb-2">
                                    Medizinische Bedingungen
                                </label>
                                <textarea 
                                    id="medical_conditions" 
                                    name="medical_conditions" 
                                    rows="3"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="z.B. Diabetes, Bluthochdruck, Schilddrüsenprobleme..."
                                ><?php echo e($currentUser['medical_conditions'] ?? ''); ?></textarea>
                            </div>
                            
                            <div>
                                <label for="allergies" class="block text-sm font-medium text-gray-700 mb-2">
                                    Allergien/Unverträglichkeiten
                                </label>
                                <textarea 
                                    id="allergies" 
                                    name="allergies" 
                                    rows="3"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="z.B. Laktose, Gluten, Nüsse, Fischöl..."
                                ><?php echo e($currentUser['allergies'] ?? ''); ?></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Buttons -->
                <div class="border-t pt-6 flex justify-end space-x-3">
                    <a 
                        href="dashboard.php" 
                        class="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Abbrechen
                    </a>
                    <button 
                        type="submit"
                        class="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        <i class="fas fa-save mr-2"></i>
                        Profil speichern
                    </button>
                </div>
            </form>
        </div>

        <!-- Info Box -->
        <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex">
                <i class="fas fa-info-circle text-blue-600 mr-2 mt-1"></i>
                <div>
                    <p class="text-blue-800 text-sm">
                        <strong>Hinweis:</strong> Diese Informationen werden verwendet, um Ihnen personalisierte 
                        Dosierungsempfehlungen zu geben. Alle Daten werden vertraulich behandelt und nicht an Dritte weitergegeben.
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