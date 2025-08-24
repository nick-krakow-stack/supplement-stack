    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 mt-12">
        <div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <!-- Über uns -->
                <div class="col-span-1 md:col-span-2">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">
                        <i class="fas fa-capsules mr-2 text-blue-600"></i>
                        <?php echo e(SITE_NAME); ?>
                    </h3>
                    <p class="text-gray-600 text-sm leading-relaxed mb-4">
                        Dein intelligenter Assistent für die Verwaltung von Nahrungsergänzungsmitteln. 
                        Mit wissenschaftlich fundierten Empfehlungen, Interaktionswarnungen und 
                        intelligenter Kostenoptimierung.
                    </p>
                    <div class="flex space-x-4 text-sm text-gray-500">
                        <span><i class="fas fa-shield-alt mr-1"></i>DSGVO konform</span>
                        <span><i class="fas fa-lock mr-1"></i>SSL verschlüsselt</span>
                        <span><i class="fas fa-heart mr-1"></i>Made in Germany</span>
                    </div>
                </div>
                
                <!-- Rechtliches -->
                <div>
                    <h4 class="font-semibold text-gray-900 mb-4">Rechtliches</h4>
                    <ul class="space-y-2 text-sm">
                        <li><a href="<?php echo url('legal/privacy.php'); ?>" class="text-gray-600 hover:text-blue-600 transition-colors">Datenschutzerklärung</a></li>
                        <li><a href="<?php echo url('legal/terms.php'); ?>" class="text-gray-600 hover:text-blue-600 transition-colors">AGB</a></li>
                        <li><a href="<?php echo url('legal/imprint.php'); ?>" class="text-gray-600 hover:text-blue-600 transition-colors">Impressum</a></li>
                        <li><a href="#cookie-settings" onclick="showCookieSettings()" class="text-gray-600 hover:text-blue-600 transition-colors">Cookie-Einstellungen</a></li>
                    </ul>
                </div>
                
                <!-- Support -->
                <div>
                    <h4 class="font-semibold text-gray-900 mb-4">Support</h4>
                    <ul class="space-y-2 text-sm">
                        <?php if (isset($_SESSION['user_id'])): ?>
                            <li><a href="<?php echo url('dashboard.php'); ?>" class="text-gray-600 hover:text-blue-600 transition-colors">Dashboard</a></li>
                            <li><a href="<?php echo url('products.php'); ?>" class="text-gray-600 hover:text-blue-600 transition-colors">Meine Produkte</a></li>
                            <li><a href="<?php echo url('stacks.php'); ?>" class="text-gray-600 hover:text-blue-600 transition-colors">Meine Stacks</a></li>
                            <li><a href="<?php echo url('profile.php'); ?>" class="text-gray-600 hover:text-blue-600 transition-colors">Profil</a></li>
                        <?php else: ?>
                            <li><a href="<?php echo url('register.php'); ?>" class="text-gray-600 hover:text-blue-600 transition-colors">Registrierung</a></li>
                            <li><a href="<?php echo url('login.php'); ?>" class="text-gray-600 hover:text-blue-600 transition-colors">Anmeldung</a></li>
                        <?php endif; ?>
                    </ul>
                </div>
            </div>
            
            <div class="border-t border-gray-200 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
                <p class="text-xs text-gray-500">
                    © <?php echo date('Y'); ?> <?php echo e(SITE_NAME); ?>. Alle Rechte vorbehalten.
                </p>
                <div class="mt-4 sm:mt-0 flex items-center space-x-4 text-xs text-gray-500">
                    <span>Version 1.0</span>
                    <span>•</span>
                    <span>PHP <?php echo PHP_VERSION; ?></span>
                    <span>•</span>
                    <span>Erstellt am <?php echo date('d.m.Y'); ?></span>
                </div>
            </div>
        </div>
    </footer>
    
    <!-- Cookie Consent (DSGVO) -->
    <div id="cookie-banner" class="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50 transform translate-y-full transition-transform duration-300">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <div class="flex-1 mb-4 sm:mb-0 pr-4">
                <p class="text-sm">
                    <i class="fas fa-cookie-bite mr-2"></i>
                    Wir verwenden technisch notwendige Cookies für die Funktion dieser Webseite. 
                    <a href="<?php echo url('legal/privacy.php'); ?>" class="underline hover:text-blue-300">Datenschutz</a>
                </p>
            </div>
            <div class="flex space-x-2">
                <button onclick="acceptCookies()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors">
                    Verstanden
                </button>
            </div>
        </div>
    </div>
    
    <!-- JavaScript -->
    <script src="<?php echo asset('js/stack-manager.js'); ?>"></script>
    <script>
        // Cookie Consent Management
        function acceptCookies() {
            localStorage.setItem('cookies-accepted', 'true');
            document.getElementById('cookie-banner').classList.add('translate-y-full');
        }
        
        function showCookieSettings() {
            document.getElementById('cookie-banner').classList.remove('translate-y-full');
        }
        
        // Cookie Banner anzeigen wenn noch nicht akzeptiert
        document.addEventListener('DOMContentLoaded', function() {
            if (!localStorage.getItem('cookies-accepted')) {
                setTimeout(() => {
                    document.getElementById('cookie-banner').classList.remove('translate-y-full');
                }, 1000);
            }
        });
        
        // User Menu Toggle
        function toggleUserMenu() {
            const menu = document.getElementById('user-menu');
            if (menu) {
                menu.classList.toggle('hidden');
            }
        }
        
        // Close user menu when clicking outside
        document.addEventListener('click', function(event) {
            const userMenuButton = document.getElementById('user-menu-button');
            const userMenu = document.getElementById('user-menu');
            
            if (userMenuButton && userMenu && !userMenuButton.contains(event.target) && !userMenu.contains(event.target)) {
                userMenu.classList.add('hidden');
            }
        });
    </script>
</body>
</html>