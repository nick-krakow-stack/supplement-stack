<?php
/**
 * Supplement Stack PHP - Main Index
 * Für All-Inkl Webserver
 */

require_once 'config/config.php';

// Redirect zu Dashboard wenn eingeloggt
if (isset($_SESSION['user_id'])) {
    header('Location: dashboard.php');
    exit;
}

$pageTitle = 'Supplement Stack - Dein intelligenter Supplement Manager';
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    
    <meta name="description" content="Verwalte deine Nahrungsergänzungsmittel intelligent - mit Dosierungsempfehlungen, Interaktionswarnungen und Preisvergleichen.">
    <meta name="theme-color" content="#2563eb">
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <h1 class="text-2xl font-bold text-blue-600">
                        <i class="fas fa-capsules mr-2"></i>
                        <?php echo SITE_NAME; ?>
                    </h1>
                </div>
                <nav class="hidden md:flex items-center space-x-6">
                    <a href="#features" class="text-gray-700 hover:text-blue-600 transition-colors">Features</a>
                    <a href="legal/privacy.php" class="text-gray-700 hover:text-blue-600 transition-colors">Datenschutz</a>
                    <a href="legal/imprint.php" class="text-gray-700 hover:text-blue-600 transition-colors">Kontakt</a>
                    <a href="login.php" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Anmelden</a>
                </nav>
            </div>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 class="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                Dein intelligenter<br>
                <span class="text-blue-600">Supplement Manager</span>
            </h1>
            <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Verwalte deine Nahrungsergänzungsmittel professionell. Mit wissenschaftlich fundierten Dosierungsempfehlungen, 
                Interaktionswarnungen und automatischer Preisberechnung.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="register.php" class="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors">
                    Kostenlos registrieren
                </a>
                <a href="demo.php" class="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors">
                    Demo anschauen
                </a>
            </div>
            
            <!-- Disclaimer -->
            <div class="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg inline-block">
                <p class="text-sm text-yellow-800">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <strong>Hinweis:</strong> Diese Anwendung stellt keine medizinische Beratung dar. 
                    Konsultieren Sie bei gesundheitlichen Fragen immer einen Arzt oder Apotheker.
                </p>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-20 bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 class="text-3xl font-bold text-center text-gray-900 mb-16">
                Alles für deine Supplement-Verwaltung
            </h2>
            
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Feature 1 -->
                <div class="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <i class="fas fa-pills text-blue-600 text-xl"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Produkt-Management</h3>
                    <p class="text-gray-600">Erfasse deine Supplements mit allen Wirkstoffen, Dosierungen und Preisen. Automatische Dubletten-Erkennung inklusive.</p>
                </div>
                
                <!-- Feature 2 -->
                <div class="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                        <i class="fas fa-layer-group text-green-600 text-xl"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Stack-Verwaltung</h3>
                    <p class="text-gray-600">Erstelle individuelle Supplement-Kombinationen mit intelligenten Dosierungsvorschlägen basierend auf DGE oder Studien.</p>
                </div>
                
                <!-- Feature 3 -->
                <div class="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                        <i class="fas fa-exclamation-triangle text-red-600 text-xl"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Interaktions-Warnungen</h3>
                    <p class="text-gray-600">Erhalte automatische Warnungen bei Überdosierungen oder negativen Wechselwirkungen zwischen Nährstoffen.</p>
                </div>
                
                <!-- Feature 4 -->
                <div class="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                        <i class="fas fa-calculator text-purple-600 text-xl"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Preisberechnung</h3>
                    <p class="text-gray-600">Automatische Berechnung der Kosten pro Tag, Woche und Monat. Verbrauchsübersicht und Nachbestellungsreminder.</p>
                </div>
                
                <!-- Feature 5 -->
                <div class="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                        <i class="fas fa-chart-line text-yellow-600 text-xl"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Intelligente Analyse</h3>
                    <p class="text-gray-600">Analysiere deine Supplement-Aufnahme und erkenne Überdosierungen oder Mangelerscheinungen frühzeitig.</p>
                </div>
                
                <!-- Feature 6 -->
                <div class="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                        <i class="fas fa-book text-indigo-600 text-xl"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Wissensdatenbank</h3>
                    <p class="text-gray-600">Detaillierte Informationen zu jedem Nährstoff, Mangelerscheinungen und Überdosierungsrisiken.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="bg-blue-600 py-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 class="text-3xl font-bold text-white mb-4">
                Bereit für intelligente Supplement-Verwaltung?
            </h2>
            <p class="text-xl text-blue-100 mb-8">
                Starte jetzt kostenlos und optimiere deine Nahrungsergänzung.
            </p>
            <a href="register.php" class="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors">
                Jetzt kostenlos registrieren
            </a>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-gray-900 text-white py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid md:grid-cols-4 gap-8">
                <div>
                    <h3 class="text-lg font-semibold mb-4"><?php echo SITE_NAME; ?></h3>
                    <p class="text-gray-400">Dein intelligenter Partner für optimale Nahrungsergänzung.</p>
                </div>
                <div>
                    <h4 class="font-semibold mb-4">Produkt</h4>
                    <ul class="space-y-2 text-gray-400">
                        <li><a href="#features" class="hover:text-white transition-colors">Features</a></li>
                        <li><a href="register.php" class="hover:text-white transition-colors">Registrieren</a></li>
                        <li><a href="login.php" class="hover:text-white transition-colors">Anmelden</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-semibold mb-4">Support</h4>
                    <ul class="space-y-2 text-gray-400">
                        <li><a href="legal/imprint.php" class="hover:text-white transition-colors">Impressum</a></li>
                        <li><a href="legal/imprint.php" class="hover:text-white transition-colors">Kontakt</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-semibold mb-4">Legal</h4>
                    <ul class="space-y-2 text-gray-400">
                        <li><a href="legal/privacy.php" class="hover:text-white transition-colors">Datenschutz</a></li>
                        <li><a href="legal/terms.php" class="hover:text-white transition-colors">AGB</a></li>
                        <li><a href="legal/imprint.php" class="hover:text-white transition-colors">Impressum</a></li>
                    </ul>
                </div>
            </div>
            
            <div class="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
                <p>&copy; <?php echo date('Y'); ?> Nick Krakow. Alle Rechte vorbehalten.</p>
                <p class="mt-2 text-sm">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    Diese Anwendung stellt keine medizinische Beratung dar.
                </p>
            </div>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</body>
</html>