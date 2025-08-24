<?php
/**
 * Impressum
 * All-Inkl Webserver
 */

require_once '../config/config.php';

$pageTitle = 'Impressum - ' . SITE_NAME;
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
            <h1 class="text-3xl font-bold text-gray-900 mb-8">Impressum</h1>
            
            <div class="prose prose-lg max-w-none">
                <p class="text-gray-600 mb-8">
                    Angaben gemäß § 5 TMG (Telemediengesetz)
                </p>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Verantwortlich für den Inhalt</h2>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <p class="text-gray-800">
                            <strong>Nick Krakow</strong><br>
                            [Ihre Straße und Hausnummer]<br>
                            [PLZ] [Ort]<br>
                            Deutschland
                        </p>
                        
                        <div class="mt-4 space-y-2">
                            <p><strong>E-Mail:</strong> <?php echo e(ADMIN_EMAIL); ?></p>
                            <p><strong>Telefon:</strong> [Ihre Telefonnummer] <small class="text-gray-500">(optional)</small></p>
                        </div>
                    </div>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Umsatzsteuer-Identifikationsnummer</h2>
                    <p class="text-gray-700">
                        <strong>USt-IdNr.:</strong> [Falls vorhanden - nur bei gewerblicher Tätigkeit erforderlich]
                    </p>
                    <p class="text-sm text-gray-500 mt-2">
                        <em>Hinweis: Als private Anwendung zur persönlichen Nutzung ist in der Regel keine USt-IdNr. erforderlich.</em>
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
                    <p class="text-gray-700">
                        Nick Krakow<br>
                        [Ihre Adresse]<br>
                        [PLZ] [Ort]
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Haftungsausschluss</h2>
                    
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">Haftung für Inhalte</h3>
                    <p class="mb-4">
                        Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, 
                        Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. 
                        Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten 
                        nach den allgemeinen Gesetzen verantwortlich.
                    </p>
                    
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">Haftung für Links</h3>
                    <p class="mb-4">
                        Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen 
                        Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. 
                        Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der 
                        Seiten verantwortlich.
                    </p>

                    <h3 class="text-xl font-semibold text-gray-800 mb-3">Urheberrecht</h3>
                    <p class="mb-4">
                        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen 
                        dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art 
                        der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen 
                        Zustimmung des jeweiligen Autors bzw. Erstellers.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Hosting und technische Umsetzung</h2>
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Hosting-Anbieter</h3>
                        <p class="text-gray-700 mb-4">
                            Diese Website wird gehostet bei:<br>
                            <strong>ALL-INKL.COM - Neue Medien Münnich</strong><br>
                            Hauptstraße 68<br>
                            02742 Friedersdorf<br>
                            Deutschland
                        </p>
                        
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Technologie-Stack</h3>
                        <ul class="list-disc pl-6 text-gray-700 mb-4">
                            <li>PHP 8.x mit MySQL-Datenbank</li>
                            <li>HTML5, CSS3, JavaScript (ES6+)</li>
                            <li>TailwindCSS Framework</li>
                            <li>SSL/TLS-Verschlüsselung</li>
                        </ul>
                    </div>
                </section>

                <section class="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <h2 class="text-2xl font-bold text-yellow-800 mb-4">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        Wichtiger Medizinischer Hinweis
                    </h2>
                    <p class="text-yellow-800 mb-4">
                        <strong><?php echo e(SITE_NAME); ?></strong> ist eine Anwendung zur persönlichen Dokumentation 
                        und Verwaltung von Nahrungsergänzungsmitteln.
                    </p>
                    <div class="bg-white border border-yellow-300 rounded p-4 text-yellow-900">
                        <h3 class="font-semibold mb-2">Diese Anwendung:</h3>
                        <ul class="list-disc pl-6 space-y-1">
                            <li><strong>Stellt KEINE medizinische Beratung dar</strong></li>
                            <li>Ersetzt NICHT den Besuch bei Arzt oder Apotheker</li>
                            <li>Gibt KEINE Heilversprechen ab</li>
                            <li>Dient ausschließlich der persönlichen Dokumentation</li>
                        </ul>
                        <p class="mt-3 font-medium">
                            Bei gesundheitlichen Fragen oder vor der Einnahme neuer Nahrungsergänzungsmittel 
                            konsultieren Sie bitte qualifiziertes medizinisches Fachpersonal.
                        </p>
                    </div>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Datenschutz</h2>
                    <p class="text-gray-700">
                        Der Schutz Ihrer persönlichen Daten ist uns wichtig. Ausführliche Informationen 
                        zur Verarbeitung Ihrer Daten finden Sie in unserer 
                        <a href="privacy.php" class="text-blue-600 hover:text-blue-500 underline font-medium">
                            Datenschutzerklärung
                        </a>.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Kontakt bei Rechtsverletzungen</h2>
                    <p class="text-gray-700 mb-4">
                        Sollten Sie der Ansicht sein, dass Inhalte auf dieser Website Ihre Rechte verletzen, 
                        kontaktieren Sie uns bitte umgehend:
                    </p>
                    <div class="bg-gray-100 border border-gray-300 rounded-lg p-4">
                        <p><strong>E-Mail:</strong> <?php echo e(ADMIN_EMAIL); ?><br>
                        <strong>Betreff:</strong> Rechtsverletzung - <?php echo e(SITE_NAME); ?></p>
                    </div>
                    <p class="text-sm text-gray-500 mt-2">
                        Wir werden berechtigte Beanstandungen unverzüglich prüfen und entsprechende Maßnahmen ergreifen.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Streitschlichtung</h2>
                    <p class="text-gray-700">
                        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
                        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" class="text-blue-600 hover:text-blue-500 underline">
                            https://ec.europa.eu/consumers/odr/
                        </a>
                    </p>
                    <p class="text-gray-700 mt-2">
                        Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren 
                        vor einer Verbraucherschlichtungsstelle teilzunehmen.
                    </p>
                </section>

                <section class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Änderungen des Impressums</h2>
                    <p class="text-gray-700">
                        Wir behalten uns vor, diese Angaben bei Bedarf zu aktualisieren. 
                        Die aktuelle Version finden Sie stets auf dieser Seite.
                    </p>
                    <p class="text-sm text-gray-500 mt-2">
                        <strong>Letzte Aktualisierung:</strong> <?php echo date('d.m.Y'); ?>
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