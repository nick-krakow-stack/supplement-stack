<?php
/**
 * Globale Konfiguration für Supplement Stack System
 * All-Inkl Privat Plus Webserver
 * 
 * @author Nick's Supplement Stack System
 * @version 1.0
 * @created 2025-08-24
 */

// Sicherheitskonstante definieren
define('SUPPLEMENT_STACK', true);

// Error Reporting für Produktionsumgebung
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Zeitzone setzen
date_default_timezone_set('Europe/Berlin');

// Site-Konfiguration
define('SITE_NAME', 'Supplement Stack Manager');
define('SITE_DESCRIPTION', 'Intelligentes Nahrungsergänzungsmittel-Management');
define('SITE_URL', 'https://' . $_SERVER['HTTP_HOST']); // Automatisch für All-Inkl
define('ADMIN_EMAIL', 'admin@deine-domain.de'); // ANPASSEN!

// Pfad-Konfiguration
define('ROOT_PATH', dirname(__DIR__));
define('CONFIG_PATH', ROOT_PATH . '/config');
define('INCLUDES_PATH', ROOT_PATH . '/includes');
define('ASSETS_PATH', ROOT_PATH . '/assets');
define('UPLOAD_PATH', ROOT_PATH . '/uploads');

// URL-Pfade
define('ASSETS_URL', '/assets');
define('UPLOAD_URL', '/uploads');

// Upload-Konfiguration
define('MAX_UPLOAD_SIZE', 5 * 1024 * 1024); // 5MB
define('ALLOWED_IMAGE_TYPES', ['jpg', 'jpeg', 'png', 'gif', 'webp']);

// DSGVO/Cookie-Konfiguration
define('COOKIE_CONSENT_REQUIRED', true);
define('ANALYTICS_ENABLED', false); // Auf true setzen wenn Google Analytics gewünscht
define('GOOGLE_ANALYTICS_ID', ''); // GA-ID einfügen falls verwendet

// Sicherheitskonfiguration
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_LOCKOUT_TIME', 900); // 15 Minuten
define('SESSION_TIMEOUT', 7200); // 2 Stunden

// Email-Konfiguration für All-Inkl SMTP
define('SMTP_HOST', 'smtp.all-inkl.com');
define('SMTP_PORT', 587);
define('SMTP_SECURE', 'tls');
define('SMTP_USERNAME', 'deine-email@deine-domain.de'); // ANPASSEN!
define('SMTP_PASSWORD', 'dein-email-passwort'); // ANPASSEN!
define('FROM_EMAIL', 'noreply@deine-domain.de'); // ANPASSEN!
define('FROM_NAME', 'Supplement Stack Manager');

// Pagination
define('ITEMS_PER_PAGE', 20);
define('MAX_PAGINATION_LINKS', 10);

// Cache-Konfiguration
define('CACHE_ENABLED', true);
define('CACHE_LIFETIME', 3600); // 1 Stunde

// Debug-Modus (nur für Entwicklung)
define('DEBUG_MODE', false); // Auf false für Produktion!

// Sprach-Konfiguration
define('DEFAULT_LANGUAGE', 'de');
define('SUPPORTED_LANGUAGES', ['de', 'en']);

// Feature-Flags
define('FEATURE_EMAIL_VERIFICATION', false); // Email-Verifizierung aktivieren?
define('FEATURE_TWO_FACTOR_AUTH', false); // 2FA aktivieren?
define('FEATURE_API_ACCESS', true); // API-Zugriff aktivieren?
define('FEATURE_EXPORT_DATA', true); // Datenexport aktivieren?

// Nahrungsergänzungsmittel-spezifische Konfiguration
define('DEFAULT_CURRENCY', 'EUR');
define('CURRENCY_SYMBOL', '€');
define('DEFAULT_WEIGHT_UNIT', 'kg');
define('DEFAULT_SUPPLEMENT_UNIT', 'mg');

// Warnstufen für Inhaltsstoffe
define('WARNING_LEVEL_LOW', 0.7); // 70% der Tageslimit
define('WARNING_LEVEL_HIGH', 0.9); // 90% der Tageslimit
define('DANGER_LEVEL', 1.0); // 100% der Tageslimit

// API-Rate-Limiting
define('API_RATE_LIMIT', 100); // Requests pro Stunde
define('API_RATE_WINDOW', 3600); // 1 Stunde

// Backup-Konfiguration
define('BACKUP_ENABLED', true);
define('BACKUP_FREQUENCY', 'weekly'); // daily, weekly, monthly
define('BACKUP_RETENTION_DAYS', 30);

// Social Media / Meta Tags
define('OG_IMAGE', ASSETS_URL . '/images/og-image.jpg');
define('TWITTER_HANDLE', '@dein_twitter'); // Optional

// Datenschutz-URLs (für All-Inkl)
define('PRIVACY_POLICY_URL', '/legal/privacy.php');
define('TERMS_OF_SERVICE_URL', '/legal/terms.php');
define('IMPRINT_URL', '/legal/imprint.php');

// Cookie-Namen
define('COOKIE_CONSENT', 'supplement_cookie_consent');
define('COOKIE_PREFERENCES', 'supplement_preferences');

// JavaScript/CSS Versioning für Caching
define('ASSETS_VERSION', '1.0.0');

// Logging-Konfiguration
define('LOG_ENABLED', true);
define('LOG_LEVEL', 'INFO'); // DEBUG, INFO, WARNING, ERROR
define('LOG_FILE', ROOT_PATH . '/logs/app.log');

// Erstelle Upload- und Log-Verzeichnisse falls nicht vorhanden
if (!file_exists(UPLOAD_PATH)) {
    mkdir(UPLOAD_PATH, 0755, true);
}

if (!file_exists(ROOT_PATH . '/logs')) {
    mkdir(ROOT_PATH . '/logs', 0755, true);
}

// .htaccess für Upload-Sicherheit erstellen
$htaccess_upload = UPLOAD_PATH . '/.htaccess';
if (!file_exists($htaccess_upload)) {
    file_put_contents($htaccess_upload, "Options -ExecCGI\nAddHandler cgi-script .php .pl .py .jsp .asp .sh .cgi\nOptions -Indexes");
}

// Datenbankverbindung einbinden
require_once CONFIG_PATH . '/database.php';

/**
 * Autoloader für Klassen
 */
spl_autoload_register(function ($className) {
    $paths = [
        INCLUDES_PATH . '/classes/',
        INCLUDES_PATH . '/models/',
        INCLUDES_PATH . '/controllers/'
    ];
    
    foreach ($paths as $path) {
        $file = $path . $className . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

/**
 * Einfache Logging-Funktion
 */
function logMessage($message, $level = 'INFO') {
    if (!LOG_ENABLED) return;
    
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] [{$level}] {$message}" . PHP_EOL;
    
    file_put_contents(LOG_FILE, $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * Saubere URL-Generierung
 */
function url($path = '') {
    return SITE_URL . '/' . ltrim($path, '/');
}

/**
 * Asset-URL mit Versionierung
 */
function asset($path) {
    return ASSETS_URL . '/' . ltrim($path, '/') . '?v=' . ASSETS_VERSION;
}

/**
 * Übersetzungsfunktion (einfache Version)
 */
function __($key, $default = null) {
    // Hier könnte später ein vollständiges Übersetzungssystem implementiert werden
    static $translations = [
        'login' => 'Anmelden',
        'register' => 'Registrieren',
        'logout' => 'Abmelden',
        'dashboard' => 'Dashboard',
        'profile' => 'Profil',
        'settings' => 'Einstellungen',
        'save' => 'Speichern',
        'cancel' => 'Abbrechen',
        'delete' => 'Löschen',
        'edit' => 'Bearbeiten',
        'add' => 'Hinzufügen',
        'search' => 'Suchen',
        'filter' => 'Filtern',
        'export' => 'Exportieren',
        'import' => 'Importieren',
        'back' => 'Zurück',
        'next' => 'Weiter',
        'previous' => 'Zurück',
        'loading' => 'Laden...',
        'success' => 'Erfolgreich',
        'error' => 'Fehler',
        'warning' => 'Warnung',
        'info' => 'Information'
    ];
    
    return $translations[$key] ?? ($default ?? $key);
}

/**
 * Sichere Ausgabe von HTML
 */
function e($string) {
    return htmlspecialchars($string ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Formatierung von Zahlen für deutsche Darstellung
 */
function formatNumber($number, $decimals = 2) {
    return number_format($number, $decimals, ',', '.');
}

/**
 * Formatierung von Preisen
 */
function formatPrice($price) {
    return formatNumber($price, 2) . ' ' . CURRENCY_SYMBOL;
}

/**
 * Formatierung von Daten
 */
function formatDate($date, $format = 'd.m.Y H:i') {
    if (is_string($date)) {
        $date = new DateTime($date);
    }
    return $date instanceof DateTime ? $date->format($format) : '';
}

// Globale Variablen setzen
$currentUser = null;
if (isset($_SESSION['user_id'])) {
    // Benutzerdaten laden wenn eingeloggt
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $currentUser = $stmt->fetch();
}
?>