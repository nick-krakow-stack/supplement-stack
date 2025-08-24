<?php
/**
 * Vereinfachter Installer für Supplement Stack PHP
 * All-Inkl Privat Plus kompatibel
 */

// Fehlerbehandlung aktivieren
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Prüfen ob bereits installiert
if (file_exists('config/installed.lock')) {
    die('<h1>Bereits installiert</h1><p>Das System ist bereits installiert. Löschen Sie install.php und install_simple.php für mehr Sicherheit.</p>');
}

// Session starten
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

$step = $_GET['step'] ?? 1;
$errors = [];
$success = [];

// POST-Verarbeitung
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['step'])) {
        $step = (int)$_POST['step'];
    }
    
    if ($step == 2) {
        // Datenbank konfigurieren
        $dbHost = trim($_POST['db_host'] ?? '');
        $dbName = trim($_POST['db_name'] ?? '');
        $dbUser = trim($_POST['db_user'] ?? '');
        $dbPass = $_POST['db_pass'] ?? '';
        $adminName = trim($_POST['admin_name'] ?? '');
        $adminEmail = trim($_POST['admin_email'] ?? '');
        $adminPassword = $_POST['admin_password'] ?? '';
        $siteName = trim($_POST['site_name'] ?? 'Supplement Stack Manager');
        
        // Validierung
        if (empty($dbHost) || empty($dbName) || empty($dbUser)) {
            $errors[] = 'Datenbankdaten sind unvollständig.';
        }
        
        if (empty($adminName) || empty($adminEmail) || empty($adminPassword)) {
            $errors[] = 'Admin-Daten sind unvollständig.';
        }
        
        if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Ungültige E-Mail-Adresse.';
        }
        
        if (strlen($adminPassword) < 6) {
            $errors[] = 'Passwort muss mindestens 6 Zeichen haben.';
        }
        
        if (empty($errors)) {
            // Datenbankverbindung testen
            try {
                $dsn = "mysql:host=$dbHost;charset=utf8mb4";
                $pdo = new PDO($dsn, $dbUser, $dbPass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
                ]);
                
                // Datenbank erstellen falls sie nicht existiert
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo->exec("USE `$dbName`");
                
                // Schema laden und ausführen
                $schemaFile = __DIR__ . '/database/schema.sql';
                if (!file_exists($schemaFile)) {
                    throw new Exception('Schema-Datei nicht gefunden: ' . $schemaFile);
                }
                
                $schema = file_get_contents($schemaFile);
                $statements = explode(';', $schema);
                
                foreach ($statements as $statement) {
                    $statement = trim($statement);
                    if (!empty($statement)) {
                        $pdo->exec($statement);
                    }
                }
                
                // Admin-Benutzer erstellen
                $passwordHash = password_hash($adminPassword, PASSWORD_ARGON2ID);
                $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash, email_verified, is_admin, created_at) VALUES (?, ?, ?, 1, 1, NOW())");
                $stmt->execute([$adminName, $adminEmail, $passwordHash]);
                
                // Konfigurationsdatei erstellen
                $configContent = createConfigContent($dbHost, $dbName, $dbUser, $dbPass, $siteName);
                
                // Verzeichnisse erstellen
                @mkdir('config', 0755, true);
                @mkdir('logs', 0755, true);
                @mkdir('uploads', 0755, true);
                
                // Config schreiben
                if (!file_put_contents('config/database.php', $configContent)) {
                    throw new Exception('Kann config/database.php nicht schreiben. Prüfen Sie die Verzeichnisberechtigungen.');
                }
                
                // Installation als abgeschlossen markieren
                file_put_contents('config/installed.lock', date('Y-m-d H:i:s'));
                
                $success[] = 'Installation erfolgreich abgeschlossen!';
                $step = 3;
                
            } catch (Exception $e) {
                $errors[] = 'Fehler: ' . $e->getMessage();
            }
        }
    }
}

function createConfigContent($host, $name, $user, $pass, $siteName) {
    $salt = bin2hex(random_bytes(32));
    return '<?php
/**
 * Datenbank-Konfiguration
 * Automatisch generiert durch Installer
 */

// Datenbank-Verbindung
define("DB_HOST", "' . addslashes($host) . '");
define("DB_NAME", "' . addslashes($name) . '");
define("DB_USER", "' . addslashes($user) . '");
define("DB_PASS", "' . addslashes($pass) . '");

// Site-Konfiguration
define("SITE_NAME", "' . addslashes($siteName) . '");
define("SITE_URL", "' . ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . '");

// Sicherheits-Konfiguration
define("PASSWORD_SALT", "' . $salt . '");
define("SECRET_KEY", "' . bin2hex(random_bytes(32)) . '");

// Fehlerbehandlung
define("DEBUG_MODE", false);
define("LOG_ERRORS", true);

/**
 * Datenbankverbindung herstellen
 */
function getDBConnection() {
    static $pdo = null;
    
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
        } catch (PDOException $e) {
            if (DEBUG_MODE) {
                die("Datenbankfehler: " . $e->getMessage());
            } else {
                die("Datenbankverbindung fehlgeschlagen.");
            }
        }
    }
    
    return $pdo;
}

/**
 * Sicherheitsfunktionen
 */
function hashPassword($password) {
    return password_hash($password . PASSWORD_SALT, PASSWORD_ARGON2ID);
}

function verifyPassword($password, $hash) {
    return password_verify($password . PASSWORD_SALT, $hash);
}

function generateCSRFToken() {
    if (session_status() == PHP_SESSION_NONE) {
        session_start();
    }
    
    if (empty($_SESSION["csrf_token"])) {
        $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
    }
    
    return $_SESSION["csrf_token"];
}

function verifyCSRFToken($token) {
    if (session_status() == PHP_SESSION_NONE) {
        session_start();
    }
    
    return isset($_SESSION["csrf_token"]) && hash_equals($_SESSION["csrf_token"], $token);
}

function e($string) {
    return htmlspecialchars($string, ENT_QUOTES, "UTF-8");
}

function url($path = "") {
    return rtrim(SITE_URL, "/") . "/" . ltrim($path, "/");
}

function asset($path) {
    return url("assets/" . ltrim($path, "/"));
}

function requireLogin() {
    if (session_status() == PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!isset($_SESSION["user_id"])) {
        header("Location: " . url("login.php"));
        exit;
    }
}

function logMessage($message, $level = "INFO") {
    if (LOG_ERRORS) {
        $logFile = __DIR__ . "/../logs/app.log";
        $timestamp = date("Y-m-d H:i:s");
        $logEntry = "[$timestamp] [$level] $message" . PHP_EOL;
        @file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
    }
}

function sendJsonResponse($data, $message = null, $status = 200) {
    http_response_code($status);
    header("Content-Type: application/json");
    
    $response = [
        "success" => $status >= 200 && $status < 300,
        "data" => $data
    ];
    
    if ($message) {
        $response["message"] = $message;
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

function sendErrorResponse($message, $status = 400) {
    sendJsonResponse(null, $message, $status);
}

function sendSuccessResponse($data, $message = null) {
    sendJsonResponse($data, $message, 200);
}

// Session-Konfiguration
ini_set("session.cookie_httponly", 1);
ini_set("session.use_only_cookies", 1);
ini_set("session.cookie_secure", isset($_SERVER["HTTPS"]));

// Konfiguration als geladen markieren
define("CONFIG_LOADED", true);
?>';
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Supplement Stack - Installation</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50 min-h-screen">
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
            <div class="text-center">
                <h1 class="text-3xl font-bold text-blue-600">
                    <i class="fas fa-capsules mr-2"></i>
                    Supplement Stack
                </h1>
                <p class="mt-2 text-gray-600">Installation für All-Inkl Server</p>
            </div>

            <?php if (!empty($errors)): ?>
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <?php foreach ($errors as $error): ?>
                        <p><i class="fas fa-exclamation-circle mr-2"></i><?php echo htmlspecialchars($error); ?></p>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <?php if (!empty($success)): ?>
                <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                    <?php foreach ($success as $msg): ?>
                        <p><i class="fas fa-check-circle mr-2"></i><?php echo htmlspecialchars($msg); ?></p>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <?php if ($step == 1): ?>
                <!-- Schritt 1: Systemprüfung -->
                <div class="bg-white shadow rounded-lg p-6">
                    <h2 class="text-xl font-semibold mb-4">Schritt 1: Systemprüfung</h2>
                    
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span>PHP Version:</span>
                            <span class="<?php echo version_compare(PHP_VERSION, '8.0', '>=') ? 'text-green-600' : 'text-red-600'; ?>">
                                <?php echo PHP_VERSION; ?>
                                <i class="fas fa-<?php echo version_compare(PHP_VERSION, '8.0', '>=') ? 'check' : 'times'; ?>"></i>
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span>PDO MySQL:</span>
                            <span class="<?php echo extension_loaded('pdo_mysql') ? 'text-green-600' : 'text-red-600'; ?>">
                                <?php echo extension_loaded('pdo_mysql') ? 'Verfügbar' : 'Nicht verfügbar'; ?>
                                <i class="fas fa-<?php echo extension_loaded('pdo_mysql') ? 'check' : 'times'; ?>"></i>
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span>JSON:</span>
                            <span class="<?php echo extension_loaded('json') ? 'text-green-600' : 'text-red-600'; ?>">
                                <?php echo extension_loaded('json') ? 'Verfügbar' : 'Nicht verfügbar'; ?>
                                <i class="fas fa-<?php echo extension_loaded('json') ? 'check' : 'times'; ?>"></i>
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span>OpenSSL:</span>
                            <span class="<?php echo extension_loaded('openssl') ? 'text-green-600' : 'text-red-600'; ?>">
                                <?php echo extension_loaded('openssl') ? 'Verfügbar' : 'Nicht verfügbar'; ?>
                                <i class="fas fa-<?php echo extension_loaded('openssl') ? 'check' : 'times'; ?>"></i>
                            </span>
                        </div>
                    </div>
                    
                    <div class="mt-6">
                        <form method="GET">
                            <input type="hidden" name="step" value="2">
                            <button type="submit" class="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors">
                                Weiter zur Konfiguration
                            </button>
                        </form>
                    </div>
                </div>
            <?php elseif ($step == 2): ?>
                <!-- Schritt 2: Konfiguration -->
                <form method="POST" class="bg-white shadow rounded-lg p-6">
                    <h2 class="text-xl font-semibold mb-4">Schritt 2: Konfiguration</h2>
                    <input type="hidden" name="step" value="2">
                    
                    <div class="space-y-4">
                        <h3 class="font-medium text-gray-900">Datenbankverbindung</h3>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700">MySQL Server</label>
                            <input type="text" name="db_host" value="<?php echo htmlspecialchars($_POST['db_host'] ?? ''); ?>" 
                                   class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" 
                                   placeholder="z.B. mysql5.all-inkl.com" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Datenbankname</label>
                            <input type="text" name="db_name" value="<?php echo htmlspecialchars($_POST['db_name'] ?? ''); ?>" 
                                   class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" 
                                   placeholder="Ihre MySQL-Datenbank" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Benutzername</label>
                            <input type="text" name="db_user" value="<?php echo htmlspecialchars($_POST['db_user'] ?? ''); ?>" 
                                   class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" 
                                   placeholder="MySQL-Benutzername" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Passwort</label>
                            <input type="password" name="db_pass" 
                                   class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" 
                                   placeholder="MySQL-Passwort">
                        </div>
                        
                        <hr class="my-4">
                        
                        <h3 class="font-medium text-gray-900">Administrator-Account</h3>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Name</label>
                            <input type="text" name="admin_name" value="<?php echo htmlspecialchars($_POST['admin_name'] ?? ''); ?>" 
                                   class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" 
                                   placeholder="Ihr Name" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700">E-Mail</label>
                            <input type="email" name="admin_email" value="<?php echo htmlspecialchars($_POST['admin_email'] ?? ''); ?>" 
                                   class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" 
                                   placeholder="admin@example.com" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Passwort</label>
                            <input type="password" name="admin_password" 
                                   class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" 
                                   placeholder="Mindestens 6 Zeichen" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Site-Name</label>
                            <input type="text" name="site_name" value="<?php echo htmlspecialchars($_POST['site_name'] ?? 'Supplement Stack Manager'); ?>" 
                                   class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" 
                                   placeholder="Supplement Stack Manager">
                        </div>
                    </div>
                    
                    <div class="mt-6">
                        <button type="submit" class="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors">
                            Installation starten
                        </button>
                    </div>
                </form>
            <?php elseif ($step == 3): ?>
                <!-- Schritt 3: Abschluss -->
                <div class="bg-white shadow rounded-lg p-6 text-center">
                    <div class="text-green-600 text-5xl mb-4">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h2 class="text-2xl font-semibold mb-4">Installation abgeschlossen!</h2>
                    <p class="text-gray-600 mb-6">
                        Ihr Supplement Stack System ist jetzt einsatzbereit.
                    </p>
                    
                    <div class="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
                        <p class="text-sm text-yellow-800">
                            <strong>Wichtig:</strong> Löschen Sie diese Installationsdateien für mehr Sicherheit:
                            <br><code>install.php</code> und <code>install_simple.php</code>
                        </p>
                    </div>
                    
                    <div class="space-x-4">
                        <a href="login.php" class="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 transition-colors">
                            Zur Anmeldung
                        </a>
                        <a href="index.php" class="bg-gray-200 text-gray-700 py-2 px-6 rounded hover:bg-gray-300 transition-colors">
                            Zur Startseite
                        </a>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>