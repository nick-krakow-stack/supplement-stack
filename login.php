<?php
/**
 * Supplement Stack PHP - Login Page
 * All-Inkl Webserver kompatibel
 */

require_once 'config/config.php';

// Redirect wenn schon eingeloggt
if (isset($_SESSION['user_id'])) {
    header('Location: dashboard.php');
    exit;
}

$error = '';
$success = '';

// Login verarbeiten
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // CSRF-Token prüfen
    if (!validateCSRFToken($_POST['csrf_token'] ?? '')) {
        $error = 'Sicherheitsfehler. Bitte versuchen Sie es erneut.';
    } else {
        $email = sanitizeInput($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        
        if (empty($email) || empty($password)) {
            $error = 'Bitte füllen Sie alle Felder aus.';
        } elseif (!isValidEmail($email)) {
            $error = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
        } else {
            try {
                $pdo = getDBConnection();
                $stmt = $pdo->prepare("SELECT id, password_hash, name FROM users WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();
                
                if ($user && verifyPassword($password, $user['password_hash'])) {
                    // Login erfolgreich
                    loginUser($user['id'], $email, $user['name']);
                    
                    // Aktivitäts-Log
                    logActivity($user['id'], 'login', 'user', $user['id'], 'Benutzer erfolgreich eingeloggt');
                    
                    // Redirect zu gewünschter Seite oder Dashboard
                    $redirect = $_GET['redirect'] ?? 'dashboard.php';
                    header('Location: ' . $redirect);
                    exit;
                } else {
                    $error = 'E-Mail oder Passwort ist falsch.';
                    logMessage("Failed login attempt for email: $email", 'WARNING');
                }
            } catch (PDOException $e) {
                logMessage("Database error during login: " . $e->getMessage(), 'ERROR');
                $error = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
            }
        }
    }
}

$pageTitle = 'Anmelden - ' . SITE_NAME;
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo e($pageTitle); ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <meta name="description" content="Melden Sie sich bei Ihrem Supplement Stack Account an">
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <div class="max-w-md w-full space-y-8 p-6">
        <!-- Logo/Header -->
        <div class="text-center">
            <a href="index.php" class="inline-block">
                <h1 class="text-3xl font-bold text-blue-600">
                    <i class="fas fa-capsules mr-2"></i>
                    <?php echo e(SITE_NAME); ?>
                </h1>
            </a>
            <h2 class="mt-6 text-2xl font-bold text-gray-900">
                Bei Ihrem Account anmelden
            </h2>
            <p class="mt-2 text-sm text-gray-600">
                Oder 
                <a href="register.php" class="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                    erstellen Sie einen neuen Account
                </a>
            </p>
        </div>

        <!-- Login Form -->
        <div class="bg-white py-8 px-6 shadow-lg rounded-lg">
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

            <form method="POST" action="login.php" class="space-y-6">
                <input type="hidden" name="csrf_token" value="<?php echo generateCSRFToken(); ?>">
                
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700">
                        E-Mail-Adresse *
                    </label>
                    <div class="mt-1 relative">
                        <input 
                            id="email" 
                            name="email" 
                            type="email" 
                            autocomplete="email" 
                            required 
                            value="<?php echo e($_POST['email'] ?? ''); ?>"
                            class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="ihre@email.de"
                        >
                        <i class="fas fa-envelope absolute right-3 top-2.5 text-gray-400"></i>
                    </div>
                </div>

                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700">
                        Passwort *
                    </label>
                    <div class="mt-1 relative">
                        <input 
                            id="password" 
                            name="password" 
                            type="password" 
                            autocomplete="current-password" 
                            required 
                            class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="Ihr Passwort"
                        >
                        <i class="fas fa-lock absolute right-3 top-2.5 text-gray-400"></i>
                    </div>
                </div>

                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <input 
                            id="remember_me" 
                            name="remember_me" 
                            type="checkbox" 
                            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        >
                        <label for="remember_me" class="ml-2 block text-sm text-gray-900">
                            Angemeldet bleiben
                        </label>
                    </div>

                    <div class="text-sm">
                        <a href="forgot-password.php" class="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                            Passwort vergessen?
                        </a>
                    </div>
                </div>

                <div>
                    <button 
                        type="submit" 
                        class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                            <i class="fas fa-sign-in-alt text-blue-500 group-hover:text-blue-400" aria-hidden="true"></i>
                        </span>
                        Anmelden
                    </button>
                </div>
            </form>
        </div>

        <!-- Footer -->
        <div class="text-center text-xs text-gray-500 space-y-2">
            <div>
                <a href="<?php echo PRIVACY_POLICY_URL; ?>" class="hover:text-gray-700 transition-colors">Datenschutz</a> •
                <a href="<?php echo TERMS_OF_SERVICE_URL; ?>" class="hover:text-gray-700 transition-colors">AGB</a> •
                <a href="<?php echo IMPRINT_URL; ?>" class="hover:text-gray-700 transition-colors">Impressum</a>
            </div>
            <div>
                <i class="fas fa-exclamation-triangle mr-1"></i>
                Diese Anwendung stellt keine medizinische Beratung dar.
            </div>
        </div>
    </div>

    <script>
        // Auto-Focus auf erstes leeres Feld
        document.addEventListener('DOMContentLoaded', function() {
            const emailField = document.getElementById('email');
            const passwordField = document.getElementById('password');
            
            if (!emailField.value) {
                emailField.focus();
            } else {
                passwordField.focus();
            }
        });

        // Form-Validierung
        document.querySelector('form').addEventListener('submit', function(e) {
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                e.preventDefault();
                alert('Bitte füllen Sie alle Pflichtfelder aus.');
                return false;
            }
            
            if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                e.preventDefault();
                alert('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
                return false;
            }
        });
    </script>
</body>
</html>