<?php
/**
 * Allgemeine Geschäftsbedingungen (AGB)
 * All-Inkl Webserver
 */

require_once '../config/config.php';

$pageTitle = 'Allgemeine Geschäftsbedingungen - ' . SITE_NAME;
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
            <h1 class="text-3xl font-bold text-gray-900 mb-8">Allgemeine Geschäftsbedingungen</h1>
            
            <div class="prose prose-lg max-w-none">
                <p class="text-gray-600 mb-6">
                    <strong>Stand:</strong> <?php echo date('d.m.Y'); ?>
                </p>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">1. Geltungsbereich</h2>
                    <p class="mb-4">
                        Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung des 
                        <strong><?php echo e(SITE_NAME); ?></strong> (nachfolgend "Dienst" oder "Anwendung") 
                        von Nick Krakow (nachfolgend "Anbieter").
                    </p>
                    <p class="mb-4">
                        Mit der Registrierung und Nutzung der Anwendung akzeptieren Sie diese AGB 
                        in ihrer jeweils aktuellen Fassung.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">2. Beschreibung des Dienstes</h2>
                    <p class="mb-4">
                        <?php echo e(SITE_NAME); ?> ist eine webbasierte Anwendung zur Verwaltung und 
                        Organisation von Nahrungsergänzungsmitteln. Der Dienst bietet folgende Funktionen:
                    </p>
                    <ul class="list-disc pl-6 mb-4">
                        <li>Erfassung und Verwaltung von Supplement-Produkten</li>
                        <li>Erstellung und Verwaltung von Supplement-Stacks</li>
                        <li>Dosierungsberechnung und Kostenübersicht</li>
                        <li>Tracking von Inhaltsstoffen und Nährstoffen</li>
                        <li>Analyse der Nährstoffzufuhr</li>
                    </ul>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">3. Registrierung und Nutzerkonto</h2>
                    
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">3.1 Registrierungsvoraussetzungen</h3>
                    <p class="mb-4">
                        Die Nutzung der Anwendung erfordert eine kostenlose Registrierung. 
                        Sie müssen mindestens 16 Jahre alt sein oder die Zustimmung eines 
                        Sorgeberechtigten besitzen.
                    </p>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">3.2 Konto-Sicherheit</h3>
                    <ul class="list-disc pl-6 mb-4">
                        <li>Sie sind für die Sicherheit Ihrer Zugangsdaten verantwortlich</li>
                        <li>Teilen Sie Ihre Zugangsdaten nicht mit Dritten</li>
                        <li>Informieren Sie uns umgehend bei Verdacht auf Missbrauch</li>
                        <li>Verwenden Sie ein sicheres Passwort</li>
                    </ul>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">3.3 Wahrhaftige Angaben</h3>
                    <p class="mb-4">
                        Sie verpflichten sich, bei der Registrierung wahre und vollständige Angaben zu machen 
                        und diese aktuell zu halten.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">4. Nutzungsbestimmungen</h2>
                    
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">4.1 Erlaubte Nutzung</h3>
                    <p class="mb-4">
                        Die Anwendung darf ausschließlich für persönliche, nicht-kommerzielle Zwecke 
                        zur Verwaltung Ihrer eigenen Nahrungsergänzungsmittel verwendet werden.
                    </p>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">4.2 Verbotene Aktivitäten</h3>
                    <p class="mb-4">Es ist untersagt:</p>
                    <ul class="list-disc pl-6 mb-4">
                        <li>Die Anwendung für kommerzielle Zwecke zu nutzen</li>
                        <li>Schädliche Software oder Viren zu verbreiten</li>
                        <li>Fremde Konten oder Daten zu manipulieren</li>
                        <li>Die technische Infrastruktur zu überlasten</li>
                        <li>Automatisierte Tools für Massenzugriffe zu verwenden</li>
                        <li>Rechte Dritter zu verletzen</li>
                        <li>Falsche oder irreführende Informationen zu verbreiten</li>
                    </ul>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">5. Verfügbarkeit des Dienstes</h2>
                    <p class="mb-4">
                        Wir bemühen uns um eine hohe Verfügbarkeit der Anwendung, können jedoch 
                        keine 100%ige Verfügbarkeit garantieren. Wartungsarbeiten und technische 
                        Störungen können zu temporären Ausfällen führen.
                    </p>
                    <p class="mb-4">
                        Geplante Wartungsarbeiten werden nach Möglichkeit vorab angekündigt.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">6. Geistiges Eigentum</h2>
                    
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">6.1 Anbieter-Rechte</h3>
                    <p class="mb-4">
                        Alle Rechte an der Anwendung, einschließlich Design, Code, Datenbank-Struktur 
                        und Dokumentation, verbleiben beim Anbieter.
                    </p>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">6.2 Nutzer-Daten</h3>
                    <p class="mb-4">
                        Sie behalten alle Rechte an den von Ihnen eingegebenen Daten. 
                        Mit der Nutzung gewähren Sie uns die notwendigen Rechte zur 
                        Bereitstellung des Dienstes.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">7. Datenschutz</h2>
                    <p class="mb-4">
                        Der Schutz Ihrer persönlichen Daten ist uns wichtig. Details zur 
                        Datenverarbeitung finden Sie in unserer 
                        <a href="privacy.php" class="text-blue-600 hover:text-blue-500 underline">
                            Datenschutzerklärung
                        </a>.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">8. Haftungsausschluss</h2>
                    
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">8.1 Medizinischer Haftungsausschluss</h3>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                        <p class="text-red-800 font-semibold mb-2">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            WICHTIGER HINWEIS:
                        </p>
                        <p class="text-red-800">
                            Diese Anwendung stellt <strong>keine medizinische Beratung</strong> dar und 
                            ersetzt nicht den Besuch bei einem Arzt, Apotheker oder anderen 
                            Gesundheitsfachkräften. Die bereitgestellten Informationen dienen 
                            ausschließlich der persönlichen Dokumentation.
                        </p>
                    </div>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">8.2 Keine Gewähr für Richtigkeit</h3>
                    <p class="mb-4">
                        Wir übernehmen keine Gewähr für die Richtigkeit, Vollständigkeit oder 
                        Aktualität der bereitgestellten Informationen zu Nährstoffen, Dosierungen 
                        oder Wechselwirkungen.
                    </p>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">8.3 Eigenverantwortung</h3>
                    <p class="mb-4">
                        Die Verwendung von Nahrungsergänzungsmitteln erfolgt auf eigene Verantwortung. 
                        Konsultieren Sie vor der Einnahme neuer Supplements oder bei Unsicherheiten 
                        medizinisches Fachpersonal.
                    </p>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">8.4 Technische Haftung</h3>
                    <p class="mb-4">
                        Die Haftung für Schäden durch die Nutzung der Anwendung ist auf Vorsatz 
                        und grobe Fahrlässigkeit beschränkt, soweit gesetzlich zulässig.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">9. Kündigung</h2>
                    
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">9.1 Kündigung durch den Nutzer</h3>
                    <p class="mb-4">
                        Sie können Ihr Konto jederzeit ohne Angabe von Gründen löschen. 
                        Kontaktieren Sie uns unter <?php echo e(ADMIN_EMAIL); ?> oder 
                        verwenden Sie die Löschfunktion in den Kontoeinstellungen.
                    </p>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">9.2 Kündigung durch den Anbieter</h3>
                    <p class="mb-4">
                        Wir können Ihr Konto bei Verstößen gegen diese AGB oder aus 
                        wichtigen Gründen mit angemessener Frist kündigen.
                    </p>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">9.3 Datenbehandlung nach Kündigung</h3>
                    <p class="mb-4">
                        Nach der Kontolöschung werden Ihre Daten gemäß unserer Datenschutzerklärung 
                        gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten bestehen.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">10. Änderungen der AGB</h2>
                    <p class="mb-4">
                        Wir behalten uns vor, diese AGB bei Bedarf zu ändern. 
                        Wesentliche Änderungen werden den Nutzern per E-Mail mitgeteilt. 
                        Widersprechen Sie nicht innerhalb von 4 Wochen, gelten die 
                        Änderungen als akzeptiert.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">11. Anwendbares Recht und Gerichtsstand</h2>
                    <p class="mb-4">
                        Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. 
                        Gerichtsstand für alle Streitigkeiten ist [Ihr Gerichtsstand], 
                        soweit der Nutzer Kaufmann, juristische Person des öffentlichen Rechts 
                        oder öffentlich-rechtliches Sondervermögen ist.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">12. Salvatorische Klausel</h2>
                    <p class="mb-4">
                        Sollten einzelne Bestimmungen dieser AGB unwirksam sein, 
                        berührt dies nicht die Wirksamkeit der übrigen Bestimmungen.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">13. Kontakt</h2>
                    <p class="mb-4">
                        Bei Fragen zu diesen AGB kontaktieren Sie uns:
                    </p>
                    <div class="bg-gray-100 border border-gray-300 rounded-lg p-4">
                        <p><strong>E-Mail:</strong> <?php echo e(ADMIN_EMAIL); ?><br>
                        <strong>Betreff:</strong> AGB - <?php echo e(SITE_NAME); ?></p>
                    </div>
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