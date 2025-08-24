<?php
/**
 * Datenschutzerklärung - DSGVO konform
 * All-Inkl Webserver
 */

require_once '../config/config.php';

$pageTitle = 'Datenschutzerklärung - ' . SITE_NAME;
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
                    <a href="../index.php" class="text-2xl font-bold text-blue-600">
                        <i class="fas fa-capsules mr-2"></i>
                        <?php echo e(SITE_NAME); ?>
                    </a>
                </div>
                <nav class="flex items-center space-x-6">
                    <a href="../index.php" class="text-gray-700 hover:text-blue-600 transition-colors">Startseite</a>
                    <?php if (isset($_SESSION['user_id'])): ?>
                        <a href="../dashboard.php" class="text-gray-700 hover:text-blue-600 transition-colors">Dashboard</a>
                    <?php endif; ?>
                </nav>
            </div>
        </div>
    </header>

    <main class="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div class="bg-white shadow-lg rounded-lg p-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-8">Datenschutzerklärung</h1>
            
            <div class="prose prose-lg max-w-none">
                <p class="text-gray-600 mb-6">
                    <strong>Stand:</strong> <?php echo date('d.m.Y'); ?>
                </p>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">1. Verantwortliche Stelle</h2>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p><strong>Nick Krakow</strong><br>
                        [Ihre Adresse]<br>
                        [PLZ] [Ort]<br>
                        Deutschland</p>
                        <p class="mt-2">
                        E-Mail: <?php echo e(ADMIN_EMAIL); ?><br>
                        Telefon: [Ihre Telefonnummer]
                        </p>
                    </div>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">2. Erhebung und Verarbeitung personenbezogener Daten</h2>
                    
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">2.1 Bei der Registrierung</h3>
                    <p class="mb-4">Bei der Erstellung eines Benutzerkontos erheben wir folgende Daten:</p>
                    <ul class="list-disc pl-6 mb-4">
                        <li><strong>Pflichtdaten:</strong> E-Mail-Adresse, Name, Passwort</li>
                        <li><strong>Optionale Daten:</strong> Alter, Geschlecht, Gewicht, Körpergröße, Aktivitätslevel, Gesundheitsziele, medizinische Bedingungen, Allergien</li>
                    </ul>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">2.2 Bei der Nutzung der Anwendung</h3>
                    <ul class="list-disc pl-6 mb-4">
                        <li>Produktdaten der erfassten Nahrungsergänzungsmittel</li>
                        <li>Stack-Konfigurationen und Dosierungen</li>
                        <li>Aktivitätslogs (Login-Zeiten, durchgeführte Aktionen)</li>
                        <li>Session-Daten zur Aufrechterhaltung der Anmeldung</li>
                    </ul>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">2.3 Automatisch erhobene Daten</h3>
                    <ul class="list-disc pl-6 mb-4">
                        <li>IP-Adresse (zur Sicherheit und Missbrauchsprävention)</li>
                        <li>Browser-Informationen (User-Agent)</li>
                        <li>Zugriffszeitpunkte</li>
                        <li>Session-IDs</li>
                    </ul>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">3. Rechtsgrundlagen der Verarbeitung</h2>
                    <p class="mb-4">Die Verarbeitung Ihrer personenbezogenen Daten erfolgt auf folgenden Rechtsgrundlagen nach DSGVO:</p>
                    <ul class="list-disc pl-6 mb-4">
                        <li><strong>Art. 6 Abs. 1 lit. b DSGVO:</strong> Erfüllung des Vertrags zur Bereitstellung unserer Dienste</li>
                        <li><strong>Art. 6 Abs. 1 lit. a DSGVO:</strong> Einwilligung bei optionalen Profildaten</li>
                        <li><strong>Art. 6 Abs. 1 lit. f DSGVO:</strong> Berechtigte Interessen zur IT-Sicherheit und Missbrauchsprävention</li>
                    </ul>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">4. Zwecke der Datenverarbeitung</h2>
                    <ul class="list-disc pl-6 mb-4">
                        <li>Bereitstellung und Verwaltung Ihres Benutzerkontos</li>
                        <li>Speicherung und Verwaltung Ihrer Supplement-Daten</li>
                        <li>Berechnung von Dosierungen und Kosten</li>
                        <li>Personalisierte Empfehlungen basierend auf Ihren Profildaten</li>
                        <li>Sicherheit der Anwendung und Schutz vor Missbrauch</li>
                        <li>Technische Administration und Fehlerbehebung</li>
                    </ul>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">5. Datenweitergabe und Empfänger</h2>
                    <p class="mb-4">Ihre Daten werden <strong>nicht</strong> an Dritte weitergegeben, außer:</p>
                    <ul class="list-disc pl-6 mb-4">
                        <li>Bei gesetzlichen Verpflichtungen (z.B. behördliche Anordnungen)</li>
                        <li>An unseren Hosting-Anbieter (All-Inkl.com) zur technischen Bereitstellung</li>
                        <li>Bei ausdrücklicher Einwilligung Ihrerseits</li>
                    </ul>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">6. Speicherdauer</h2>
                    <p class="mb-4">Wir speichern Ihre Daten nur so lange, wie es erforderlich ist:</p>
                    <ul class="list-disc pl-6 mb-4">
                        <li><strong>Kontodaten:</strong> Bis zur Löschung Ihres Kontos</li>
                        <li><strong>Session-Daten:</strong> Bis zu 30 Tage nach letzter Aktivität</li>
                        <li><strong>Aktivitätslogs:</strong> 12 Monate für Sicherheitszwecke</li>
                        <li><strong>Backup-Daten:</strong> Bis zu 30 Tage in verschlüsselten Backups</li>
                    </ul>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">7. Ihre Rechte</h2>
                    <p class="mb-4">Nach der DSGVO haben Sie folgende Rechte:</p>
                    <ul class="list-disc pl-6 mb-4">
                        <li><strong>Auskunftsrecht (Art. 15):</strong> Information über gespeicherte Daten</li>
                        <li><strong>Berichtigungsrecht (Art. 16):</strong> Korrektur unrichtiger Daten</li>
                        <li><strong>Löschungsrecht (Art. 17):</strong> Löschen Ihrer Daten unter bestimmten Voraussetzungen</li>
                        <li><strong>Einschränkungsrecht (Art. 18):</strong> Einschränkung der Verarbeitung</li>
                        <li><strong>Datenübertragbarkeit (Art. 20):</strong> Export Ihrer Daten in maschinenlesbarem Format</li>
                        <li><strong>Widerspruchsrecht (Art. 21):</strong> Widerspruch gegen die Verarbeitung</li>
                        <li><strong>Beschwerderecht:</strong> Bei einer Datenschutzaufsichtsbehörde</li>
                    </ul>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">8. Datensicherheit</h2>
                    <p class="mb-4">Wir setzen technische und organisatorische Maßnahmen zum Schutz Ihrer Daten ein:</p>
                    <ul class="list-disc pl-6 mb-4">
                        <li>SSL/TLS-Verschlüsselung für alle Datenübertragungen</li>
                        <li>Passwort-Hashing mit modernen Verfahren</li>
                        <li>Sichere Session-Verwaltung</li>
                        <li>Regelmäßige Sicherheitsupdates</li>
                        <li>Zugriffsbeschränkungen und Benutzerberechtigungen</li>
                        <li>Verschlüsselte Datenbank-Backups</li>
                    </ul>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">9. Cookies und lokale Speicherung</h2>
                    <p class="mb-4">Unsere Anwendung verwendet:</p>
                    <ul class="list-disc pl-6 mb-4">
                        <li><strong>Session-Cookies:</strong> Zur Aufrechterhaltung Ihrer Anmeldung (technisch erforderlich)</li>
                        <li><strong>CSRF-Token:</strong> Zum Schutz vor Cross-Site-Request-Forgery-Angriffen</li>
                        <li><strong>LocalStorage:</strong> Für lokale App-Einstellungen (optional)</li>
                    </ul>
                    <p class="mb-4">Sie können Cookies in Ihrem Browser deaktivieren, jedoch kann dies die Funktionalität einschränken.</p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">10. Änderungen der Datenschutzerklärung</h2>
                    <p class="mb-4">
                        Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen. 
                        Änderungen werden auf dieser Seite veröffentlicht. Bei wesentlichen Änderungen 
                        werden registrierte Benutzer per E-Mail informiert.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">11. Kontakt</h2>
                    <p class="mb-4">
                        Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte kontaktieren Sie uns unter:
                    </p>
                    <div class="bg-gray-100 border border-gray-300 rounded-lg p-4">
                        <p><strong>E-Mail:</strong> <?php echo e(ADMIN_EMAIL); ?><br>
                        <strong>Betreff:</strong> Datenschutz - <?php echo e(SITE_NAME); ?></p>
                    </div>
                </section>

                <section class="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <h2 class="text-2xl font-bold text-yellow-800 mb-4">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        Wichtiger Hinweis
                    </h2>
                    <p class="text-yellow-800">
                        Diese Anwendung dient ausschließlich der Dokumentation und Verwaltung von Nahrungsergänzungsmitteln. 
                        Sie stellt keine medizinische Beratung dar und ersetzt nicht den Besuch bei einem Arzt oder Apotheker. 
                        Bei gesundheitlichen Fragen oder vor der Einnahme neuer Supplements konsultieren Sie bitte 
                        medizinisches Fachpersonal.
                    </p>
                </section>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-gray-900 text-white py-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div class="space-y-2">
                <a href="privacy.php" class="text-gray-400 hover:text-white transition-colors">Datenschutz</a> •
                <a href="terms.php" class="text-gray-400 hover:text-white transition-colors">AGB</a> •
                <a href="imprint.php" class="text-gray-400 hover:text-white transition-colors">Impressum</a>
            </div>
            <div class="mt-4 text-gray-400">
                <p>&copy; <?php echo date('Y'); ?> Nick Krakow. Alle Rechte vorbehalten.</p>
            </div>
        </div>
    </footer>
</body>
</html>