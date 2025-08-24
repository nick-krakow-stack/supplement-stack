<?php
/**
 * Datenbank-Konfiguration für Supplement Stack System
 * All-Inkl Privat Plus Webserver kompatibel
 * 
 * @author Nick's Supplement Stack System
 * @version 1.0
 * @created 2025-08-24
 */

// Prevent direct access
if (!defined('SUPPLEMENT_STACK')) {
    die('Direct access not permitted');
}

// Datenbankverbindung Konfiguration für All-Inkl
define('DB_HOST', 'localhost'); // All-Inkl verwendet meist localhost
define('DB_NAME', 'supplement_stack'); // Anpassen an tatsächlichen DB-Namen
define('DB_USER', 'db_username'); // Anpassen an All-Inkl MySQL User
define('DB_PASS', 'db_password'); // Anpassen an All-Inkl MySQL Passwort
define('DB_CHARSET', 'utf8mb4');

// Sicherheitskonfiguration
define('PASSWORD_SALT', 'dein_individueller_salt_string_hier'); // ÄNDERN!
define('SESSION_NAME', 'supplement_stack_session');
define('CSRF_TOKEN_NAME', 'csrf_token');

// Session-Konfiguration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', isset($_SERVER['HTTPS'])); 
ini_set('session.use_strict_mode', 1);

/**
 * Sichere Datenbankverbindung erstellen
 */
function getDBConnection() {
    static $pdo = null;
    
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,  // Fix für MySQL PDO Fehler
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET
            ];
            
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            die("Datenbankverbindung fehlgeschlagen. Bitte versuchen Sie es später erneut.");
        }
    }
    
    return $pdo;
}

/**
 * Sichere Passwort-Hash-Erstellung
 */
function hashPassword($password) {
    return password_hash($password . PASSWORD_SALT, PASSWORD_DEFAULT);
}

/**
 * Passwort-Verifikation
 */
function verifyPassword($password, $hash) {
    return password_verify($password . PASSWORD_SALT, $hash);
}

/**
 * CSRF-Token generieren
 */
function generateCSRFToken() {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    
    return $_SESSION['csrf_token'];
}

/**
 * CSRF-Token validieren
 */
function validateCSRFToken($token) {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Benutzer-Authentifizierung prüfen
 */
function requireLogin() {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_email'])) {
        header('Location: login.php?redirect=' . urlencode($_SERVER['REQUEST_URI']));
        exit;
    }
    
    // Session-Aktivität aktualisieren
    updateSessionActivity();
}

/**
 * Benutzer einloggen
 */
function loginUser($userId, $email, $name = null) {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    
    // Session regenerieren für Sicherheit
    session_regenerate_id(true);
    
    $_SESSION['user_id'] = $userId;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_name'] = $name;
    $_SESSION['login_time'] = time();
    
    // Session in Datenbank speichern
    saveSessionToDB($userId);
}

/**
 * Benutzer ausloggen
 */
function logoutUser() {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    
    // Session aus Datenbank löschen
    if (isset($_SESSION['user_id'])) {
        deleteSessionFromDB($_SESSION['user_id'], session_id());
    }
    
    // Session-Daten löschen
    $_SESSION = array();
    
    // Session-Cookie löschen
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    
    session_destroy();
}

/**
 * Session in Datenbank speichern
 */
function saveSessionToDB($userId) {
    $pdo = getDBConnection();
    
    $stmt = $pdo->prepare("
        INSERT INTO user_sessions (id, user_id, ip_address, user_agent, last_activity) 
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        last_activity = NOW(),
        ip_address = VALUES(ip_address),
        user_agent = VALUES(user_agent)
    ");
    
    $stmt->execute([
        session_id(),
        $userId,
        $_SERVER['REMOTE_ADDR'] ?? null,
        $_SERVER['HTTP_USER_AGENT'] ?? null
    ]);
}

/**
 * Session-Aktivität aktualisieren
 */
function updateSessionActivity() {
    if (isset($_SESSION['user_id'])) {
        $pdo = getDBConnection();
        
        $stmt = $pdo->prepare("
            UPDATE user_sessions 
            SET last_activity = NOW() 
            WHERE id = ? AND user_id = ?
        ");
        
        $stmt->execute([session_id(), $_SESSION['user_id']]);
    }
}

/**
 * Session aus Datenbank löschen
 */
function deleteSessionFromDB($userId, $sessionId) {
    $pdo = getDBConnection();
    
    $stmt = $pdo->prepare("
        DELETE FROM user_sessions 
        WHERE id = ? AND user_id = ?
    ");
    
    $stmt->execute([$sessionId, $userId]);
}

/**
 * Alte Sessions bereinigen (kann via Cronjob aufgerufen werden)
 */
function cleanupOldSessions($maxAge = 86400) { // 24 Stunden Standard
    $pdo = getDBConnection();
    
    $stmt = $pdo->prepare("
        DELETE FROM user_sessions 
        WHERE last_activity < DATE_SUB(NOW(), INTERVAL ? SECOND)
    ");
    
    $stmt->execute([$maxAge]);
}

/**
 * Aktivitäts-Log erstellen
 */
function logActivity($userId, $action, $entityType = null, $entityId = null, $description = null) {
    $pdo = getDBConnection();
    
    $stmt = $pdo->prepare("
        INSERT INTO activity_logs 
        (user_id, action, entity_type, entity_id, description, ip_address, user_agent) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([
        $userId,
        $action,
        $entityType,
        $entityId,
        $description,
        $_SERVER['REMOTE_ADDR'] ?? null,
        $_SERVER['HTTP_USER_AGENT'] ?? null
    ]);
}

/**
 * JSON-Antwort senden
 */
function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Fehler-JSON-Antwort senden
 */
function sendErrorResponse($message, $statusCode = 400, $errors = []) {
    sendJsonResponse([
        'success' => false,
        'message' => $message,
        'errors' => $errors
    ], $statusCode);
}

/**
 * Erfolg-JSON-Antwort senden
 */
function sendSuccessResponse($data = [], $message = 'Operation erfolgreich') {
    sendJsonResponse([
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
}

/**
 * Input sanitization
 */
function sanitizeInput($data) {
    if (is_array($data)) {
        foreach ($data as $key => $value) {
            $data[$key] = sanitizeInput($value);
        }
        return $data;
    }
    
    return htmlspecialchars(trim($data), ENT_QUOTES, 'UTF-8');
}

/**
 * Email-Validierung
 */
function isValidEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Sichere Passwort-Prüfung
 */
function isStrongPassword($password) {
    // Mindestens 8 Zeichen, ein Großbuchstabe, ein Kleinbuchstabe, eine Zahl
    return preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/', $password);
}

/**
 * Rate Limiting für API-Endpunkte
 */
function checkRateLimit($action, $limit = 60, $window = 3600) { // 60 Requests pro Stunde Standard
    $key = 'rate_limit_' . $action . '_' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    
    if (!isset($_SESSION[$key])) {
        $_SESSION[$key] = ['count' => 0, 'reset' => time() + $window];
    }
    
    $rateData = $_SESSION[$key];
    
    if (time() > $rateData['reset']) {
        $_SESSION[$key] = ['count' => 1, 'reset' => time() + $window];
        return true;
    }
    
    if ($rateData['count'] >= $limit) {
        return false;
    }
    
    $_SESSION[$key]['count']++;
    return true;
}

// Session starten wenn nicht bereits aktiv
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name(SESSION_NAME);
    session_start();
}

// Alte Sessions gelegentlich bereinigen (1% Chance)
if (mt_rand(1, 100) === 1) {
    cleanupOldSessions();
}
?>