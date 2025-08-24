# 🚨 Fehlerbehebung - Internal Server Error

## Problem: "Not Found" oder "Internal Server Error"

### 🔍 Sofort-Diagnose:
1. **Debug-Script ausführen:** `https://deine-domain.de/debug.php`
2. **System-Status prüfen:** Zeigt PHP-Version, Extensions, Berechtigungen

### 🛠️ Häufige Lösungen:

#### Problem 1: PHP-Version zu alt
**Symptom:** Internal Server Error  
**Lösung:** PHP 8.0+ bei All-Inkl aktivieren

#### Problem 2: Fehlende Extensions
**Symptom:** Weiße Seite oder Fehler  
**Lösung:** PDO_MySQL Extension aktivieren

#### Problem 3: Dateiberechtigungen
**Symptom:** Cannot write to directory  
**Lösung:** 
```bash
chmod 755 verzeichnisse/
chmod 644 *.php
```

#### Problem 4: .htaccess Probleme
**Symptom:** 500 Internal Server Error  
**Lösung:** .htaccess temporär umbenennen in .htaccess_backup

### 🚀 Alternative: Vereinfachter Installer
Falls `install.php` nicht funktioniert:
```
https://deine-domain.de/install_simple.php
```

### 📞 All-Inkl Support
Bei anhaltenden Problemen:
- PHP-Version auf 8.0+ setzen lassen
- mod_rewrite aktivieren lassen  
- Error-Logs einsehen lassen

### ✅ Erfolgreich installiert?
Dann lösche:
- `install.php`
- `install_simple.php`  
- `debug.php`