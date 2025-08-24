<?php
/**
 * Supplement Stack Manager - Installation Script
 * All-Inkl Privat Plus Webserver kompatibel
 * 
 * @author Nick's Supplement Stack System
 * @version 1.0
 * @created 2025-08-24
 */

// Sicherheitsprüfung - Installer nach Installation löschen!
if (file_exists('config/installed.lock')) {
    die('Installation bereits abgeschlossen. Löschen Sie die install.php für Sicherheit.');
}

// Session starten für Installation
session_start();

$step = $_GET['step'] ?? 1;
$errors = [];
$success = [];

// Installation verarbeiten
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    switch ($_POST['action']) {
        case 'check_requirements':
            $step = 2;
            break;
        case 'configure_database':
            $step = processDatabaseConfig();
            break;
        case 'create_admin':
            $step = processAdminCreation();
            break;
        case 'finalize':
            $step = finalizeInstallation();
            break;
    }
}

/**
 * Systemanforderungen prüfen
 */
function checkRequirements() {
    global $errors;
    
    $requirements = [
        'PHP Version' => [
            'required' => '8.0',
            'current' => PHP_VERSION,
            'status' => version_compare(PHP_VERSION, '8.0', '>=')
        ],
        'PDO Extension' => [
            'required' => 'Aktiviert',
            'current' => extension_loaded('pdo') ? 'Aktiviert' : 'Nicht verfügbar',
            'status' => extension_loaded('pdo')
        ],
        'PDO MySQL' => [
            'required' => 'Aktiviert',
            'current' => extension_loaded('pdo_mysql') ? 'Aktiviert' : 'Nicht verfügbar',
            'status' => extension_loaded('pdo_mysql')
        ],
        'OpenSSL' => [
            'required' => 'Aktiviert',
            'current' => extension_loaded('openssl') ? 'Aktiviert' : 'Nicht verfügbar',
            'status' => extension_loaded('openssl')
        ],
        'JSON' => [
            'required' => 'Aktiviert',
            'current' => extension_loaded('json') ? 'Aktiviert' : 'Nicht verfügbar',
            'status' => extension_loaded('json')
        ],
        'Session Support' => [
            'required' => 'Aktiviert',
            'current' => function_exists('session_start') ? 'Aktiviert' : 'Nicht verfügbar',
            'status' => function_exists('session_start')
        ]
    ];
    
    // Verzeichnis-Berechtigungen prüfen
    $directories = ['config', 'uploads', 'logs'];
    foreach ($directories as $dir) {
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }
        
        $requirements["Verzeichnis $dir"] = [
            'required' => 'Schreibbar',
            'current' => is_writable($dir) ? 'Schreibbar' : 'Nicht schreibbar',
            'status' => is_writable($dir)
        ];
    }
    
    return $requirements;
}

/**
 * Datenbankverbindung konfigurieren
 */
function processDatabaseConfig() {
    global $errors, $success;
    
    $dbHost = $_POST['db_host'] ?? '';
    $dbName = $_POST['db_name'] ?? '';
    $dbUser = $_POST['db_user'] ?? '';
    $dbPass = $_POST['db_pass'] ?? '';
    $adminEmail = $_POST['admin_email'] ?? '';
    $siteName = $_POST['site_name'] ?? 'Supplement Stack Manager';
    $passwordSalt = $_POST['password_salt'] ?? '';
    
    // Automatischen Salt generieren falls leer
    if (empty($passwordSalt)) {
        $passwordSalt = bin2hex(random_bytes(32));
    }
    
    // Validierung
    if (empty($dbHost) || empty($dbName) || empty($dbUser) || empty($adminEmail)) {
        $errors[] = 'Bitte füllen Sie alle Pflichtfelder aus.';
        return 2;
    }
    
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
        return 2;
    }
    
    // Datenbankverbindung testen
    try {
        $dsn = "mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4";
        $pdo = new PDO($dsn, $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        
        // Konfigurationsdateien erstellen
        createConfigFiles($dbHost, $dbName, $dbUser, $dbPass, $adminEmail, $siteName, $passwordSalt);
        
        // Datenbankschema erstellen
        createDatabaseSchema($pdo);
        
        // Session-Daten für nächsten Schritt speichern
        $_SESSION['install_data'] = [
            'admin_email' => $adminEmail,
            'site_name' => $siteName
        ];
        
        $success[] = 'Datenbankverbindung erfolgreich und Schema erstellt!';
        return 3;
        
    } catch (PDOException $e) {
        $errors[] = 'Datenbankverbindung fehlgeschlagen: ' . $e->getMessage();
        return 2;
    }
}

/**
 * Konfigurationsdateien erstellen
 */
function createConfigFiles($dbHost, $dbName, $dbUser, $dbPass, $adminEmail, $siteName, $passwordSalt) {
    // database.php anpassen
    $databaseConfig = file_get_contents('config/database.php');
    $databaseConfig = str_replace("define('DB_HOST', 'localhost');", "define('DB_HOST', '$dbHost');", $databaseConfig);
    $databaseConfig = str_replace("define('DB_NAME', 'supplement_stack');", "define('DB_NAME', '$dbName');", $databaseConfig);
    $databaseConfig = str_replace("define('DB_USER', 'db_username');", "define('DB_USER', '$dbUser');", $databaseConfig);
    $databaseConfig = str_replace("define('DB_PASS', 'db_password');", "define('DB_PASS', '$dbPass');", $databaseConfig);
    $databaseConfig = str_replace("define('PASSWORD_SALT', 'dein_individueller_salt_string_hier');", "define('PASSWORD_SALT', '$passwordSalt');", $databaseConfig);
    
    file_put_contents('config/database.php', $databaseConfig);
    
    // config.php anpassen
    $mainConfig = file_get_contents('config/config.php');
    $mainConfig = str_replace("define('SITE_NAME', 'Supplement Stack Manager');", "define('SITE_NAME', '$siteName');", $mainConfig);
    $mainConfig = str_replace("define('ADMIN_EMAIL', 'admin@deine-domain.de');", "define('ADMIN_EMAIL', '$adminEmail');", $mainConfig);
    
    file_put_contents('config/config.php', $mainConfig);
}

/**
 * Datenbankschema erstellen
 */
function createDatabaseSchema($pdo) {
    $schema = file_get_contents('database/schema.sql');
    
    // SQL-Befehle aufteilen und ausführen
    $statements = array_filter(array_map('trim', explode(';', $schema)));
    
    foreach ($statements as $statement) {
        if (!empty($statement) && !preg_match('/^--/', $statement)) {
            $pdo->exec($statement);
        }
    }
}

/**
 * Admin-Benutzer erstellen
 */
function processAdminCreation() {
    global $errors, $success;
    
    require_once 'config/config.php';
    
    $adminName = $_POST['admin_name'] ?? '';
    $adminEmail = $_SESSION['install_data']['admin_email'] ?? '';
    $adminPassword = $_POST['admin_password'] ?? '';
    $adminPasswordConfirm = $_POST['admin_password_confirm'] ?? '';
    
    // Validierung
    if (empty($adminName) || empty($adminPassword)) {
        $errors[] = 'Bitte füllen Sie alle Felder aus.';
        return 3;
    }
    
    if ($adminPassword !== $adminPasswordConfirm) {
        $errors[] = 'Die Passwörter stimmen nicht überein.';
        return 3;
    }
    
    if (strlen($adminPassword) < 8) {
        $errors[] = 'Das Passwort muss mindestens 8 Zeichen lang sein.';
        return 3;
    }
    
    try {
        $pdo = getDBConnection();
        
        // Prüfen ob bereits ein Benutzer existiert
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users");
        $stmt->execute();
        $userCount = $stmt->fetchColumn();
        
        if ($userCount > 0) {
            $errors[] = 'Es existiert bereits ein Benutzer in der Datenbank.';
            return 3;
        }
        
        // Admin-Benutzer erstellen
        $passwordHash = hashPassword($adminPassword);
        
        $stmt = $pdo->prepare("
            INSERT INTO users (email, password_hash, name, created_at) 
            VALUES (?, ?, ?, NOW())
        ");
        
        $stmt->execute([$adminEmail, $passwordHash, $adminName]);
        
        $success[] = 'Admin-Benutzer erfolgreich erstellt!';
        return 4;
        
    } catch (PDOException $e) {
        $errors[] = 'Fehler beim Erstellen des Admin-Benutzers: ' . $e->getMessage();
        return 3;
    }
}

/**
 * Installation abschließen
 */
function finalizeInstallation() {
    global $success;
    
    // .htaccess für Sicherheit erstellen
    $htaccess = "# Supplement Stack Manager - Security Rules
# Generated by installer

# Deny access to sensitive files
<Files \"install.php\">
    Order Allow,Deny
    Deny from all
</Files>

<Files \"*.sql\">
    Order Allow,Deny
    Deny from all
</Files>

<FilesMatch \"\.(log|bak|backup|conf)$\">
    Order Allow,Deny
    Deny from all
</FilesMatch>

# Deny access to config directory
<Directory \"config\">
    Order Allow,Deny
    Deny from all
</Directory>

# Enable HTTPS redirect (uncomment if needed)
# RewriteEngine On
# RewriteCond %{HTTPS} off
# RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection \"1; mode=block\"
    Header always set Referrer-Policy \"strict-origin-when-cross-origin\"
    Header always set Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self';\"
</IfModule>

# PHP settings
<IfModule mod_php7.c>
    php_flag display_errors off
    php_flag log_errors on
    php_value memory_limit 128M
    php_value upload_max_filesize 5M
    php_value post_max_size 10M
</IfModule>

<IfModule mod_php8.c>
    php_flag display_errors off
    php_flag log_errors on
    php_value memory_limit 128M
    php_value upload_max_filesize 5M
    php_value post_max_size 10M
</IfModule>
";
    
    file_put_contents('.htaccess', $htaccess);
    
    // Lock-Datei erstellen
    file_put_contents('config/installed.lock', date('Y-m-d H:i:s') . " - Installation completed\n");
    
    // Session-Daten löschen
    unset($_SESSION['install_data']);
    
    $success[] = 'Installation erfolgreich abgeschlossen!';
    $success[] = 'Löschen Sie die install.php aus Sicherheitsgründen!';
    
    return 5;
}

?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Installation - Supplement Stack Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .step-active { @apply bg-blue-600 text-white; }
        .step-completed { @apply bg-green-600 text-white; }
        .step-pending { @apply bg-gray-300 text-gray-600; }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-4xl w-full space-y-8">
            <!-- Header -->
            <div class="text-center">
                <h1 class="text-4xl font-bold text-gray-900">
                    <i class="fas fa-capsules text-blue-600 mr-3"></i>
                    Supplement Stack Manager
                </h1>
                <p class="mt-2 text-xl text-gray-600">Installation für All-Inkl Privat Plus</p>
            </div>

            <!-- Progress Steps -->
            <div class="bg-white rounded-lg shadow-lg p-6">
                <div class="flex items-center justify-between">
                    <?php
                    $steps = [
                        1 => 'Willkommen',
                        2 => 'Konfiguration',
                        3 => 'Admin-Benutzer',
                        4 => 'Abschluss',
                        5 => 'Fertig'
                    ];
                    
                    foreach ($steps as $stepNum => $stepName):
                        $class = 'step-pending';
                        if ($stepNum < $step) $class = 'step-completed';
                        if ($stepNum == $step) $class = 'step-active';
                    ?>
                        <div class="flex items-center">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium <?php echo $class; ?>">
                                <?php echo $stepNum <= $step - 1 ? '<i class="fas fa-check"></i>' : $stepNum; ?>
                            </div>
                            <?php if ($stepNum < count($steps)): ?>
                                <div class="w-12 h-1 bg-gray-300 mx-2"></div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
                <div class="flex justify-between mt-4">
                    <?php foreach ($steps as $stepNum => $stepName): ?>
                        <div class="text-sm text-center">
                            <p class="<?php echo $stepNum == $step ? 'font-semibold text-blue-600' : 'text-gray-500'; ?>">
                                <?php echo $stepName; ?>
                            </p>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Messages -->
            <?php if (!empty($errors)): ?>
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex">
                        <i class="fas fa-exclamation-circle text-red-400 mr-2 mt-1"></i>
                        <div>
                            <h3 class="text-sm font-medium text-red-800">Fehler aufgetreten:</h3>
                            <ul class="mt-2 text-sm text-red-700 list-disc list-inside">
                                <?php foreach ($errors as $error): ?>
                                    <li><?php echo htmlspecialchars($error); ?></li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <?php if (!empty($success)): ?>
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="flex">
                        <i class="fas fa-check-circle text-green-400 mr-2 mt-1"></i>
                        <div>
                            <h3 class="text-sm font-medium text-green-800">Erfolgreich:</h3>
                            <ul class="mt-2 text-sm text-green-700 list-disc list-inside">
                                <?php foreach ($success as $msg): ?>
                                    <li><?php echo htmlspecialchars($msg); ?></li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <!-- Installation Content -->
            <div class="bg-white shadow-lg rounded-lg p-8">
                <?php switch ($step): 
                    case 1: ?>
                        <!-- Willkommen & Systemanforderungen -->
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">
                            <i class="fas fa-rocket mr-2 text-blue-600"></i>
                            Willkommen zur Installation
                        </h2>
                        
                        <div class="prose max-w-none mb-8">
                            <p class="text-lg text-gray-700 mb-4">
                                Dieser Installer richtet Ihr Supplement Stack Management System auf Ihrem 
                                All-Inkl Privat Plus Webserver ein.
                            </p>
                            
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <h3 class="text-lg font-semibold text-yellow-800 mb-2">
                                    <i class="fas fa-exclamation-triangle mr-2"></i>
                                    Wichtige Hinweise
                                </h3>
                                <ul class="text-yellow-800 space-y-1">
                                    <li>• Stellen Sie sicher, dass eine MySQL-Datenbank verfügbar ist</li>
                                    <li>• Halten Sie Ihre All-Inkl Zugangsdaten bereit</li>
                                    <li>• Diese Anwendung stellt keine medizinische Beratung dar</li>
                                    <li>• Löschen Sie install.php nach der Installation!</li>
                                </ul>
                            </div>
                        </div>

                        <h3 class="text-xl font-semibold text-gray-900 mb-4">Systemanforderungen</h3>
                        <div class="overflow-x-auto mb-8">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anforderung</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Erforderlich</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verfügbar</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    <?php $requirements = checkRequirements(); ?>
                                    <?php foreach ($requirements as $name => $req): ?>
                                        <tr>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"><?php echo $name; ?></td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><?php echo $req['required']; ?></td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><?php echo $req['current']; ?></td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <?php if ($req['status']): ?>
                                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        <i class="fas fa-check mr-1"></i> OK
                                                    </span>
                                                <?php else: ?>
                                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                        <i class="fas fa-times mr-1"></i> Fehlt
                                                    </span>
                                                <?php endif; ?>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>

                        <form method="post" class="text-center">
                            <input type="hidden" name="action" value="check_requirements">
                            <button type="submit" class="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors">
                                <i class="fas fa-arrow-right mr-2"></i>
                                Installation fortsetzen
                            </button>
                        </form>

                    <?php break;
                    case 2: ?>
                        <!-- Datenbankverbindung -->
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">
                            <i class="fas fa-database mr-2 text-blue-600"></i>
                            Datenbankverbindung konfigurieren
                        </h2>

                        <form method="post" class="space-y-6">
                            <input type="hidden" name="action" value="configure_database">
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label for="db_host" class="block text-sm font-medium text-gray-700">MySQL Host *</label>
                                    <input type="text" id="db_host" name="db_host" value="localhost" required
                                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                    <p class="mt-1 text-sm text-gray-500">Meist "localhost" bei All-Inkl</p>
                                </div>
                                
                                <div>
                                    <label for="db_name" class="block text-sm font-medium text-gray-700">Datenbankname *</label>
                                    <input type="text" id="db_name" name="db_name" required
                                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                    <p class="mt-1 text-sm text-gray-500">Der Name Ihrer MySQL-Datenbank</p>
                                </div>
                                
                                <div>
                                    <label for="db_user" class="block text-sm font-medium text-gray-700">MySQL Benutzer *</label>
                                    <input type="text" id="db_user" name="db_user" required
                                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                
                                <div>
                                    <label for="db_pass" class="block text-sm font-medium text-gray-700">MySQL Passwort</label>
                                    <input type="password" id="db_pass" name="db_pass"
                                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                    <p class="mt-1 text-sm text-gray-500">Falls erforderlich</p>
                                </div>
                            </div>

                            <div class="border-t pt-6">
                                <h3 class="text-lg font-semibold text-gray-900 mb-4">Website-Konfiguration</h3>
                                
                                <div class="grid grid-cols-1 gap-6">
                                    <div>
                                        <label for="site_name" class="block text-sm font-medium text-gray-700">Website-Name</label>
                                        <input type="text" id="site_name" name="site_name" value="Supplement Stack Manager"
                                               class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                    
                                    <div>
                                        <label for="admin_email" class="block text-sm font-medium text-gray-700">Administrator E-Mail *</label>
                                        <input type="email" id="admin_email" name="admin_email" required
                                               class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                    
                                    <div>
                                        <label for="password_salt" class="block text-sm font-medium text-gray-700">Sicherheits-Salt</label>
                                        <input type="text" id="password_salt" name="password_salt" value="<?php echo bin2hex(random_bytes(16)); ?>"
                                               class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                        <p class="mt-1 text-sm text-gray-500">Automatisch generiert - nicht ändern außer Sie wissen was Sie tun</p>
                                    </div>
                                </div>
                            </div>

                            <div class="flex justify-between pt-6">
                                <a href="?step=1" class="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors">
                                    <i class="fas fa-arrow-left mr-2"></i>Zurück
                                </a>
                                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                                    Datenbank testen & Schema erstellen
                                    <i class="fas fa-arrow-right ml-2"></i>
                                </button>
                            </div>
                        </form>

                    <?php break;
                    case 3: ?>
                        <!-- Admin-Benutzer -->
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">
                            <i class="fas fa-user-shield mr-2 text-blue-600"></i>
                            Administrator-Account erstellen
                        </h2>

                        <form method="post" class="space-y-6">
                            <input type="hidden" name="action" value="create_admin">
                            
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <p class="text-blue-800">
                                    <i class="fas fa-info-circle mr-2"></i>
                                    Erstellen Sie Ihren Administrator-Account für den ersten Zugang zur Anwendung.
                                </p>
                            </div>

                            <div class="grid grid-cols-1 gap-6">
                                <div>
                                    <label for="admin_name" class="block text-sm font-medium text-gray-700">Name *</label>
                                    <input type="text" id="admin_name" name="admin_name" required
                                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                
                                <div>
                                    <label for="admin_email_display" class="block text-sm font-medium text-gray-700">E-Mail-Adresse</label>
                                    <input type="email" id="admin_email_display" value="<?php echo htmlspecialchars($_SESSION['install_data']['admin_email'] ?? ''); ?>" disabled
                                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100">
                                    <p class="mt-1 text-sm text-gray-500">Aus der Konfiguration übernommen</p>
                                </div>
                                
                                <div>
                                    <label for="admin_password" class="block text-sm font-medium text-gray-700">Passwort *</label>
                                    <input type="password" id="admin_password" name="admin_password" required
                                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                    <p class="mt-1 text-sm text-gray-500">Mindestens 8 Zeichen</p>
                                </div>
                                
                                <div>
                                    <label for="admin_password_confirm" class="block text-sm font-medium text-gray-700">Passwort bestätigen *</label>
                                    <input type="password" id="admin_password_confirm" name="admin_password_confirm" required
                                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                </div>
                            </div>

                            <div class="flex justify-between pt-6">
                                <a href="?step=2" class="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors">
                                    <i class="fas fa-arrow-left mr-2"></i>Zurück
                                </a>
                                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                                    Admin-Account erstellen
                                    <i class="fas fa-arrow-right ml-2"></i>
                                </button>
                            </div>
                        </form>

                    <?php break;
                    case 4: ?>
                        <!-- Installation abschließen -->
                        <h2 class="text-2xl font-bold text-gray-900 mb-6">
                            <i class="fas fa-check-circle mr-2 text-green-600"></i>
                            Installation abschließen
                        </h2>

                        <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                            <h3 class="text-lg font-semibold text-green-800 mb-2">Fast geschafft!</h3>
                            <p class="text-green-700">
                                Die Datenbankverbindung wurde erfolgreich konfiguriert und Ihr Administrator-Account wurde erstellt.
                                Klicken Sie auf "Installation abschließen" um die letzten Schritte durchzuführen.
                            </p>
                        </div>

                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                            <h3 class="text-lg font-semibold text-yellow-800 mb-2">
                                <i class="fas fa-shield-alt mr-2"></i>
                                Sicherheitsmaßnahmen
                            </h3>
                            <p class="text-yellow-800 mb-3">
                                Der Installer wird folgende Sicherheitsmaßnahmen durchführen:
                            </p>
                            <ul class="text-yellow-800 space-y-1">
                                <li>• .htaccess-Datei mit Sicherheitsregeln erstellen</li>
                                <li>• Zugriff auf sensible Dateien blockieren</li>
                                <li>• Installation als abgeschlossen markieren</li>
                                <li>• PHP-Sicherheitseinstellungen konfigurieren</li>
                            </ul>
                        </div>

                        <div class="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                            <h3 class="text-lg font-semibold text-red-800 mb-2">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                Wichtig nach der Installation
                            </h3>
                            <ul class="text-red-800 space-y-1">
                                <li>• <strong>Löschen Sie die install.php aus Sicherheitsgründen!</strong></li>
                                <li>• Überprüfen Sie die Einstellungen in den Konfigurationsdateien</li>
                                <li>• Aktivieren Sie SSL/HTTPS für Ihre Domain</li>
                                <li>• Führen Sie regelmäßige Backups durch</li>
                            </ul>
                        </div>

                        <form method="post" class="text-center">
                            <input type="hidden" name="action" value="finalize">
                            <button type="submit" class="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors">
                                <i class="fas fa-check mr-2"></i>
                                Installation abschließen
                            </button>
                        </form>

                    <?php break;
                    case 5: ?>
                        <!-- Installation abgeschlossen -->
                        <div class="text-center">
                            <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <i class="fas fa-check text-3xl text-green-600"></i>
                            </div>
                            
                            <h2 class="text-3xl font-bold text-gray-900 mb-4">
                                Installation erfolgreich abgeschlossen! 🎉
                            </h2>
                            
                            <p class="text-xl text-gray-600 mb-8">
                                Ihr Supplement Stack Manager ist einsatzbereit.
                            </p>

                            <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-8 text-left">
                                <h3 class="text-lg font-semibold text-green-800 mb-4">Was wurde eingerichtet:</h3>
                                <ul class="text-green-700 space-y-2">
                                    <li><i class="fas fa-check mr-2"></i> MySQL-Datenbank mit vollständigem Schema</li>
                                    <li><i class="fas fa-check mr-2"></i> Administrator-Account erstellt</li>
                                    <li><i class="fas fa-check mr-2"></i> Sicherheitskonfiguration aktiviert</li>
                                    <li><i class="fas fa-check mr-2"></i> 20+ Standard-Inhaltsstoffe eingefügt</li>
                                    <li><i class="fas fa-check mr-2"></i> DSGVO-konforme rechtliche Seiten</li>
                                </ul>
                            </div>

                            <div class="bg-red-50 border border-red-200 rounded-lg p-6 mb-8 text-left">
                                <h3 class="text-lg font-semibold text-red-800 mb-3">
                                    <i class="fas fa-shield-alt mr-2"></i>
                                    Wichtige Sicherheitsschritte
                                </h3>
                                <ol class="text-red-800 space-y-2 list-decimal list-inside">
                                    <li><strong>Löschen Sie sofort die install.php!</strong></li>
                                    <li>Überprüfen Sie die .htaccess-Datei</li>
                                    <li>Aktivieren Sie SSL/HTTPS für Ihre Domain</li>
                                    <li>Führen Sie ein erstes Backup durch</li>
                                </ol>
                            </div>

                            <div class="space-y-4">
                                <a href="index.php" class="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors">
                                    <i class="fas fa-home mr-2"></i>
                                    Zur Startseite
                                </a>
                                
                                <br>
                                
                                <a href="login.php" class="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                                    <i class="fas fa-sign-in-alt mr-2"></i>
                                    Zum Login
                                </a>
                            </div>

                            <div class="mt-8 text-sm text-gray-500">
                                <p>
                                    <i class="fas fa-exclamation-triangle mr-1"></i>
                                    Denken Sie daran: Diese Anwendung stellt keine medizinische Beratung dar.
                                </p>
                            </div>
                        </div>

                    <?php break;
                endswitch; ?>
            </div>

            <!-- Footer -->
            <div class="text-center text-sm text-gray-500">
                <p>&copy; <?php echo date('Y'); ?> Nick Krakow - Supplement Stack Manager</p>
                <p class="mt-1">All-Inkl Privat Plus kompatibel</p>
            </div>
        </div>
    </div>

    <script>
        // Passwort-Bestätigung prüfen
        document.addEventListener('DOMContentLoaded', function() {
            const password = document.getElementById('admin_password');
            const passwordConfirm = document.getElementById('admin_password_confirm');
            
            if (password && passwordConfirm) {
                passwordConfirm.addEventListener('input', function() {
                    if (password.value !== this.value) {
                        this.setCustomValidity('Passwörter stimmen nicht überein');
                    } else {
                        this.setCustomValidity('');
                    }
                });
            }
        });

        // Auto-generate salt
        function generateSalt() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < 64; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            document.getElementById('password_salt').value = result;
        }
    </script>
</body>
</html>