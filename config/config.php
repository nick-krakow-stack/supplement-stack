<?php
/**
 * Basis-Konfiguration - Falls durch Installer nicht überschrieben
 * All-Inkl Webserver kompatibel
 */

// Lade Datenbank-Konfiguration falls vorhanden
if (file_exists(__DIR__ . '/database.php')) {
    require_once __DIR__ . '/database.php';
} else {
    // Fallback-Konfiguration
    define('SITE_NAME', 'Supplement Stack Manager');
    define('SITE_URL', 'http://localhost');
    define('DEBUG_MODE', true);
    define('LOG_ERRORS', true);
}

// Session-Konfiguration 
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Basis-Funktionen falls nicht definiert
if (!function_exists('e')) {
    function e($string) {
        return htmlspecialchars($string, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('url')) {
    function url($path = '') {
        $baseUrl = defined('SITE_URL') ? SITE_URL : 
            (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . 
            '://' . $_SERVER['HTTP_HOST'];
        return rtrim($baseUrl, '/') . '/' . ltrim($path, '/');
    }
}

if (!function_exists('asset')) {
    function asset($path) {
        return url('assets/' . ltrim($path, '/'));
    }
}

// Konfiguration als geladen markieren
define('CONFIG_LOADED', true);
?>