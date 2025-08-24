<?php
/**
 * MySQL PDO Quick Fix
 * Für bestehende Installationen mit PDO-Fehler
 */

echo "<!DOCTYPE html><html><head><title>MySQL PDO Fix</title></head><body>";
echo "<h1>🔧 MySQL PDO Quick Fix</h1>";

// 1. Config-Datei reparieren
$configFile = 'config/database.php';
if (file_exists($configFile)) {
    $content = file_get_contents($configFile);
    
    // PDO::MYSQL_ATTR_USE_BUFFERED_QUERY hinzufügen falls nicht vorhanden
    if (strpos($content, 'PDO::MYSQL_ATTR_USE_BUFFERED_QUERY') === false) {
        $search = 'PDO::ATTR_EMULATE_PREPARES => false,';
        $replace = 'PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,';
        
        $newContent = str_replace($search, $replace, $content);
        
        if ($newContent !== $content) {
            file_put_contents($configFile, $newContent);
            echo "<p>✅ <strong>Config repariert:</strong> PDO Buffering aktiviert in $configFile</p>";
        } else {
            echo "<p>ℹ️ Config scheint bereits korrekt zu sein.</p>";
        }
    } else {
        echo "<p>✅ Config ist bereits repariert.</p>";
    }
} else {
    echo "<p>❌ Config-Datei nicht gefunden: $configFile</p>";
}

// 2. Datenbankverbindung testen
try {
    if (file_exists($configFile)) {
        include_once $configFile;
        
        if (function_exists('getDBConnection')) {
            $pdo = getDBConnection();
            echo "<p>✅ <strong>Datenbankverbindung:</strong> Erfolgreich mit reparierter PDO-Konfiguration!</p>";
            
            // Test-Abfrage
            $stmt = $pdo->query("SELECT COUNT(*) as count FROM users");
            $result = $stmt->fetch();
            echo "<p>ℹ️ Benutzer in Datenbank: " . $result['count'] . "</p>";
            
        } else {
            echo "<p>❌ getDBConnection() Funktion nicht gefunden.</p>";
        }
    }
} catch (Exception $e) {
    echo "<p>❌ <strong>Datenbankfehler:</strong> " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p>💡 <strong>Lösung:</strong> Verwenden Sie <a href='install_fixed.php'>install_fixed.php</a> für Neuinstallation.</p>";
}

// 3. Weitere Checks
echo "<h2>🔍 System Status</h2>";
echo "<p><strong>PHP Version:</strong> " . PHP_VERSION . "</p>";
echo "<p><strong>PDO MySQL:</strong> " . (extension_loaded('pdo_mysql') ? '✅ Verfügbar' : '❌ Nicht verfügbar') . "</p>";

if (file_exists('config/installed.lock')) {
    echo "<p><strong>Installation:</strong> ✅ Abgeschlossen (" . file_get_contents('config/installed.lock') . ")</p>";
} else {
    echo "<p><strong>Installation:</strong> ❌ Nicht abgeschlossen</p>";
}

echo "<h2>🚀 Nächste Schritte</h2>";
echo "<ul>";
echo "<li><a href='index.php'>Zur Startseite</a></li>";
echo "<li><a href='login.php'>Zur Anmeldung</a></li>";
echo "<li><a href='debug.php'>Debug-Informationen</a></li>";
if (!file_exists('config/installed.lock')) {
    echo "<li><strong><a href='install_fixed.php'>Neuinstallation mit PDO-Fix</a></strong></li>";
}
echo "</ul>";

echo "<hr><p><small>MySQL PDO Fix - " . date('Y-m-d H:i:s') . "</small></p>";
echo "</body></html>";
?>