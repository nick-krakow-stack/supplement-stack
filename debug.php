<?php
/**
 * Debug-Script für Supplement Stack PHP
 * Hilft bei der Fehlerdiagnose
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<!DOCTYPE html><html><head><title>Debug Info</title></head><body>";
echo "<h1>🔍 Debug Information</h1>";

echo "<h2>PHP Information</h2>";
echo "<p><strong>PHP Version:</strong> " . PHP_VERSION . "</p>";
echo "<p><strong>Server Software:</strong> " . ($_SERVER['SERVER_SOFTWARE'] ?? 'Unknown') . "</p>";
echo "<p><strong>Document Root:</strong> " . ($_SERVER['DOCUMENT_ROOT'] ?? 'Unknown') . "</p>";
echo "<p><strong>Script Path:</strong> " . __FILE__ . "</p>";

echo "<h2>Required Extensions</h2>";
$extensions = ['pdo', 'pdo_mysql', 'json', 'openssl', 'mbstring'];
foreach ($extensions as $ext) {
    $loaded = extension_loaded($ext);
    echo "<p><strong>$ext:</strong> " . ($loaded ? '✅ Loaded' : '❌ Not loaded') . "</p>";
}

echo "<h2>File Permissions</h2>";
$dirs = ['.', 'config', 'database', 'assets', 'api'];
foreach ($dirs as $dir) {
    if (file_exists($dir)) {
        $perms = substr(sprintf('%o', fileperms($dir)), -4);
        $readable = is_readable($dir) ? '✅' : '❌';
        $writable = is_writable($dir) ? '✅' : '❌';
        echo "<p><strong>$dir/:</strong> $perms | Readable: $readable | Writable: $writable</p>";
    } else {
        echo "<p><strong>$dir/:</strong> ❌ Not found</p>";
    }
}

echo "<h2>Files Check</h2>";
$files = ['database/schema.sql', 'config/config.php', 'install.php', 'install_simple.php'];
foreach ($files as $file) {
    if (file_exists($file)) {
        $size = filesize($file);
        $readable = is_readable($file) ? '✅' : '❌';
        echo "<p><strong>$file:</strong> ✅ Exists ($size bytes) | Readable: $readable</p>";
        
        // Ersten Teil der Datei anzeigen
        if (is_readable($file) && $size > 0) {
            $content = file_get_contents($file, false, null, 0, 200);
            echo "<pre style='background:#f5f5f5;padding:10px;font-size:12px;'>" . htmlspecialchars($content) . "...</pre>";
        }
    } else {
        echo "<p><strong>$file:</strong> ❌ Not found</p>";
    }
}

echo "<h2>Error Log Check</h2>";
$errorLog = ini_get('error_log');
echo "<p><strong>Error Log Location:</strong> " . ($errorLog ?: 'Default system log') . "</p>";

// PHP Error Log der letzten Zeilen
if ($errorLog && file_exists($errorLog)) {
    $lines = file($errorLog);
    $recentLines = array_slice($lines, -10);
    echo "<h3>Recent Error Log Entries:</h3>";
    echo "<pre style='background:#ffeeee;padding:10px;font-size:12px;'>";
    foreach ($recentLines as $line) {
        echo htmlspecialchars($line);
    }
    echo "</pre>";
}

echo "<h2>Quick Tests</h2>";

// Test database connection if config exists
if (file_exists('config/database.php')) {
    echo "<p><strong>Database Config:</strong> ✅ Found</p>";
    try {
        include_once 'config/database.php';
        if (function_exists('getDBConnection')) {
            $pdo = getDBConnection();
            echo "<p><strong>Database Connection:</strong> ✅ Success</p>";
        } else {
            echo "<p><strong>Database Connection:</strong> ❌ getDBConnection() not found</p>";
        }
    } catch (Exception $e) {
        echo "<p><strong>Database Connection:</strong> ❌ " . htmlspecialchars($e->getMessage()) . "</p>";
    }
} else {
    echo "<p><strong>Database Config:</strong> ❌ Not configured yet</p>";
}

// Session test
try {
    if (session_status() == PHP_SESSION_NONE) {
        session_start();
    }
    $_SESSION['test'] = 'working';
    echo "<p><strong>Sessions:</strong> ✅ Working</p>";
} catch (Exception $e) {
    echo "<p><strong>Sessions:</strong> ❌ " . htmlspecialchars($e->getMessage()) . "</p>";
}

echo "<h2>Next Steps</h2>";
echo "<ul>";
echo "<li><a href='install_simple.php'>Try Simple Installer</a></li>";
echo "<li><a href='install.php'>Try Original Installer</a></li>";
echo "<li><a href='index.php'>Go to Homepage</a></li>";
echo "</ul>";

echo "</body></html>";
?>