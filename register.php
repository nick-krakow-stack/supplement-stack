<?php
/**
 * Supplement Stack PHP - Registration Page
 * All-Inkl Webserver kompatibel
 */

require_once 'config/config.php';

// Redirect wenn schon eingeloggt
if (isset($_SESSION['user_id'])) {
    header('Location: dashboard.php');
    exit;
}

$error = '';
$success = '';
$step = 1;

// Registrierung verarbeiten
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // CSRF-Token prüfen
    if (!validateCSRFToken($_POST['csrf_token'] ?? '')) {
        $error = 'Sicherheitsfehler. Bitte versuchen Sie es erneut.';
    } else {
        $email = sanitizeInput($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        $password_confirm = $_POST['password_confirm'] ?? '';
        $name = sanitizeInput($_POST['name'] ?? '');
        
        // Optionale Profil-Daten
        $age = !empty($_POST['age']) ? (int)$_POST['age'] : null;
        $gender = sanitizeInput($_POST['gender'] ?? '');
        $weight = !empty($_POST['weight']) ? (float)$_POST['weight'] : null;
        $height = !empty($_POST['height']) ? (int)$_POST['height'] : null;
        $activity_level = sanitizeInput($_POST['activity_level'] ?? '');
        $health_goals = sanitizeInput($_POST['health_goals'] ?? '');
        $medical_conditions = sanitizeInput($_POST['medical_conditions'] ?? '');
        $allergies = sanitizeInput($_POST['allergies'] ?? '');
        
        // Basis-Validierung
        if (empty($email) || empty($password) || empty($name)) {
            $error = 'Bitte füllen Sie alle Pflichtfelder aus.';
        } elseif (!isValidEmail($email)) {
            $error = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
        } elseif ($password !== $password_confirm) {
            $error = 'Die Passwörter stimmen nicht überein.';
        } elseif (!isStrongPassword($password)) {
            $error = 'Das Passwort muss mindestens 8 Zeichen lang sein und einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.';
        } else {
            try {
                $pdo = getDBConnection();
                
                // Prüfen ob E-Mail bereits existiert
                $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                $stmt->execute([$email]);
                if ($stmt->fetch()) {
                    $error = 'Ein Account mit dieser E-Mail-Adresse existiert bereits.';
                } else {
                    // Neuen Benutzer erstellen
                    $passwordHash = hashPassword($password);
                    
                    $stmt = $pdo->prepare("
                        INSERT INTO users 
                        (email, password_hash, name, age, gender, weight, height, activity_level, health_goals, medical_conditions, allergies) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ");
                    
                    $stmt->execute([
                        $email,
                        $passwordHash,
                        $name,
                        $age,
                        $gender ?: null,
                        $weight,
                        $height,
                        $activity_level ?: null,
                        $health_goals,
                        $medical_conditions,
                        $allergies
                    ]);
                    
                    $userId = $pdo->lastInsertId();
                    
                    // Automatisch einloggen
                    loginUser($userId, $email, $name);
                    
                    // Aktivitäts-Log
                    logActivity($userId, 'register', 'user', $userId, 'Neuer Benutzer registriert');
                    
                    $success = 'Registrierung erfolgreich! Sie werden weitergeleitet...';
                    
                    // JavaScript-Redirect nach 2 Sekunden
                    echo "<script>setTimeout(function(){ window.location.href = 'dashboard.php'; }, 2000);</script>";
                }
            } catch (PDOException $e) {
                logMessage("Database error during registration: " . $e->getMessage(), 'ERROR');
                $error = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
            }
        }
    }
}

$pageTitle = 'Registrieren - ' . SITE_NAME;
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo e($pageTitle); ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <meta name="description" content="Erstellen Sie Ihren kostenlosen Supplement Stack Account">
</head>
<body class="bg-gray-50 min-h-screen py-8">
    <div class="max-w-2xl mx-auto space-y-8 p-6">
        <!-- Header -->
        <div class="text-center">
            <a href="index.php" class="inline-block">
                <h1 class="text-3xl font-bold text-blue-600">
                    <i class="fas fa-capsules mr-2"></i>
                    <?php echo e(SITE_NAME); ?>
                </h1>
            </a>
            <h2 class="mt-6 text-2xl font-bold text-gray-900">
                Kostenlosen Account erstellen
            </h2>
            <p class="mt-2 text-sm text-gray-600">
                Bereits registriert? 
                <a href="login.php" class="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                    Hier anmelden
                </a>
            </p>
        </div>

        <!-- Registration Form -->
        <div class="bg-white py-8 px-6 shadow-lg rounded-lg">
            <?php if ($error): ?>
                <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                    <div class="flex">
                        <i class="fas fa-exclamation-circle text-red-400 mr-2 mt-1"></i>
                        <p class="text-sm text-red-600"><?php echo e($error); ?></p>
                    </div>
                </div>
            <?php endif; ?>

            <?php if ($success): ?>
                <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                    <div class="flex">
                        <i class="fas fa-check-circle text-green-400 mr-2 mt-1"></i>
                        <p class="text-sm text-green-600"><?php echo e($success); ?></p>
                    </div>
                </div>
            <?php endif; ?>

            <form method="POST" action="register.php" class="space-y-6">
                <input type="hidden" name="csrf_token" value="<?php echo generateCSRFToken(); ?>">
                
                <!-- Schritt 1: Basis-Informationen -->
                <div class="space-y-6">
                    <h3 class="text-lg font-medium text-gray-900 border-b pb-2">
                        <i class="fas fa-user mr-2 text-blue-600"></i>
                        Basis-Informationen
                    </h3>
                    
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label for="name" class="block text-sm font-medium text-gray-700">
                                Name/Vorname *
                            </label>
                            <input 
                                id="name" 
                                name="name" 
                                type="text" 
                                required 
                                value="<?php echo e($_POST['name'] ?? ''); ?>"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Max Mustermann"
                            >
                        </div>
                        
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700">
                                E-Mail-Adresse *
                            </label>
                            <input 
                                id="email" 
                                name="email" 
                                type="email" 
                                required 
                                value="<?php echo e($_POST['email'] ?? ''); ?>"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="max@beispiel.de"
                            >
                        </div>
                    </div>
                    
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700">
                                Passwort *
                            </label>
                            <input 
                                id="password" 
                                name="password" 
                                type="password" 
                                required 
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Mindestens 8 Zeichen"
                            >
                            <p class="mt-1 text-xs text-gray-500">
                                Mindestens 8 Zeichen, 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl
                            </p>
                        </div>
                        
                        <div>
                            <label for="password_confirm" class="block text-sm font-medium text-gray-700">
                                Passwort bestätigen *
                            </label>
                            <input 
                                id="password_confirm" 
                                name="password_confirm" 
                                type="password" 
                                required 
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Passwort wiederholen"
                            >
                        </div>
                    </div>
                </div>

                <!-- Schritt 2: Optionale Profil-Informationen -->
                <div class="space-y-6">
                    <h3 class="text-lg font-medium text-gray-900 border-b pb-2">
                        <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                        Profil-Informationen <span class="text-sm font-normal text-gray-500">(optional)</span>
                    </h3>
                    
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p class="text-sm text-blue-800">
                            <i class="fas fa-info-circle mr-2"></i>
                            Diese Informationen helfen bei personalisierten Dosierungsempfehlungen, sind aber optional.
                        </p>
                    </div>
                    
                    <div class="grid md:grid-cols-3 gap-4">
                        <div>
                            <label for="age" class="block text-sm font-medium text-gray-700">
                                Alter (Jahre)
                            </label>
                            <input 
                                id="age" 
                                name="age" 
                                type="number" 
                                min="16" 
                                max="120"
                                value="<?php echo e($_POST['age'] ?? ''); ?>"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="z.B. 30"
                            >
                        </div>
                        
                        <div>
                            <label for="weight" class="block text-sm font-medium text-gray-700">
                                Gewicht (kg)
                            </label>
                            <input 
                                id="weight" 
                                name="weight" 
                                type="number" 
                                step="0.1" 
                                min="30" 
                                max="300"
                                value="<?php echo e($_POST['weight'] ?? ''); ?>"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="z.B. 75.5"
                            >
                        </div>
                        
                        <div>
                            <label for="height" class="block text-sm font-medium text-gray-700">
                                Größe (cm)
                            </label>
                            <input 
                                id="height" 
                                name="height" 
                                type="number" 
                                min="120" 
                                max="250"
                                value="<?php echo e($_POST['height'] ?? ''); ?>"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="z.B. 180"
                            >
                        </div>
                    </div>
                    
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label for="gender" class="block text-sm font-medium text-gray-700">
                                Geschlecht
                            </label>
                            <select 
                                id="gender" 
                                name="gender"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Bitte wählen</option>
                                <option value="male" <?php echo ($_POST['gender'] ?? '') === 'male' ? 'selected' : ''; ?>>Männlich</option>
                                <option value="female" <?php echo ($_POST['gender'] ?? '') === 'female' ? 'selected' : ''; ?>>Weiblich</option>
                                <option value="diverse" <?php echo ($_POST['gender'] ?? '') === 'diverse' ? 'selected' : ''; ?>>Divers</option>
                            </select>
                        </div>
                        
                        <div>
                            <label for="activity_level" class="block text-sm font-medium text-gray-700">
                                Aktivitätslevel
                            </label>
                            <select 
                                id="activity_level" 
                                name="activity_level"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Bitte wählen</option>
                                <option value="sedentary" <?php echo ($_POST['activity_level'] ?? '') === 'sedentary' ? 'selected' : ''; ?>>Wenig aktiv (Bürojob)</option>
                                <option value="light" <?php echo ($_POST['activity_level'] ?? '') === 'light' ? 'selected' : ''; ?>>Leicht aktiv (1-3x/Woche Sport)</option>
                                <option value="moderate" <?php echo ($_POST['activity_level'] ?? '') === 'moderate' ? 'selected' : ''; ?>>Mäßig aktiv (3-5x/Woche Sport)</option>
                                <option value="active" <?php echo ($_POST['activity_level'] ?? '') === 'active' ? 'selected' : ''; ?>>Sehr aktiv (6-7x/Woche Sport)</option>
                                <option value="very_active" <?php echo ($_POST['activity_level'] ?? '') === 'very_active' ? 'selected' : ''; ?>>Extrem aktiv (2x täglich Sport)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label for="health_goals" class="block text-sm font-medium text-gray-700">
                            Gesundheitsziele
                        </label>
                        <textarea 
                            id="health_goals" 
                            name="health_goals" 
                            rows="3"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="z.B. Muskelaufbau, Gewichtsreduktion, besserer Schlaf, mehr Energie..."
                        ><?php echo e($_POST['health_goals'] ?? ''); ?></textarea>
                    </div>
                    
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label for="medical_conditions" class="block text-sm font-medium text-gray-700">
                                Medizinische Bedingungen
                            </label>
                            <textarea 
                                id="medical_conditions" 
                                name="medical_conditions" 
                                rows="3"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="z.B. Diabetes, Bluthochdruck, Schilddrüsenprobleme..."
                            ><?php echo e($_POST['medical_conditions'] ?? ''); ?></textarea>
                        </div>
                        
                        <div>
                            <label for="allergies" class="block text-sm font-medium text-gray-700">
                                Allergien/Unverträglichkeiten
                            </label>
                            <textarea 
                                id="allergies" 
                                name="allergies" 
                                rows="3"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="z.B. Laktose, Gluten, Nüsse, Fischöl..."
                            ><?php echo e($_POST['allergies'] ?? ''); ?></textarea>
                        </div>
                    </div>
                </div>

                <!-- Terms & Privacy -->
                <div class="border-t pt-6">
                    <div class="flex items-start">
                        <input 
                            id="accept_terms" 
                            name="accept_terms" 
                            type="checkbox" 
                            required
                            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                        >
                        <label for="accept_terms" class="ml-3 text-sm text-gray-700">
                            Ich akzeptiere die 
                            <a href="<?php echo TERMS_OF_SERVICE_URL; ?>" target="_blank" class="text-blue-600 hover:text-blue-500 underline">Allgemeinen Geschäftsbedingungen</a>
                            und die 
                            <a href="<?php echo PRIVACY_POLICY_URL; ?>" target="_blank" class="text-blue-600 hover:text-blue-500 underline">Datenschutzerklärung</a>.
                        </label>
                    </div>
                    
                    <div class="mt-4 flex items-start">
                        <input 
                            id="accept_newsletter" 
                            name="accept_newsletter" 
                            type="checkbox"
                            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                        >
                        <label for="accept_newsletter" class="ml-3 text-sm text-gray-700">
                            Ich möchte gelegentlich Tipps und Updates zu Nahrungsergänzungsmitteln per E-Mail erhalten (optional).
                        </label>
                    </div>
                </div>

                <!-- Submit Button -->
                <div class="pt-6">
                    <button 
                        type="submit" 
                        class="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <i class="fas fa-user-plus mr-2"></i>
                        Kostenlosen Account erstellen
                    </button>
                </div>
            </form>
        </div>

        <!-- Footer -->
        <div class="text-center text-xs text-gray-500 space-y-2">
            <div>
                <a href="<?php echo PRIVACY_POLICY_URL; ?>" class="hover:text-gray-700 transition-colors">Datenschutz</a> •
                <a href="<?php echo TERMS_OF_SERVICE_URL; ?>" class="hover:text-gray-700 transition-colors">AGB</a> •
                <a href="<?php echo IMPRINT_URL; ?>" class="hover:text-gray-700 transition-colors">Impressum</a>
            </div>
            <div>
                <i class="fas fa-exclamation-triangle mr-1"></i>
                Diese Anwendung stellt keine medizinische Beratung dar.
            </div>
        </div>
    </div>

    <script>
        // Passwort-Stärke-Indikator
        document.getElementById('password').addEventListener('input', function() {
            const password = this.value;
            const strength = checkPasswordStrength(password);
            // Hier könnte eine visuelle Passwort-Stärke-Anzeige implementiert werden
        });

        function checkPasswordStrength(password) {
            let strength = 0;
            if (password.length >= 8) strength++;
            if (password.match(/[a-z]/)) strength++;
            if (password.match(/[A-Z]/)) strength++;
            if (password.match(/[0-9]/)) strength++;
            if (password.match(/[^a-zA-Z0-9]/)) strength++;
            return strength;
        }

        // Passwort-Bestätigung prüfen
        document.getElementById('password_confirm').addEventListener('input', function() {
            const password = document.getElementById('password').value;
            const confirm = this.value;
            
            if (confirm && password !== confirm) {
                this.setCustomValidity('Passwörter stimmen nicht überein');
            } else {
                this.setCustomValidity('');
            }
        });

        // Form-Validierung
        document.querySelector('form').addEventListener('submit', function(e) {
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('password_confirm').value;
            const name = document.getElementById('name').value.trim();
            const acceptTerms = document.getElementById('accept_terms').checked;
            
            if (!email || !password || !name) {
                e.preventDefault();
                alert('Bitte füllen Sie alle Pflichtfelder aus.');
                return false;
            }
            
            if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                e.preventDefault();
                alert('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
                return false;
            }
            
            if (password !== passwordConfirm) {
                e.preventDefault();
                alert('Die Passwörter stimmen nicht überein.');
                return false;
            }
            
            if (checkPasswordStrength(password) < 4) {
                e.preventDefault();
                alert('Das Passwort ist zu schwach. Bitte verwenden Sie mindestens 8 Zeichen mit Groß-, Kleinbuchstaben und Zahlen.');
                return false;
            }
            
            if (!acceptTerms) {
                e.preventDefault();
                alert('Bitte akzeptieren Sie die AGB und Datenschutzerklärung.');
                return false;
            }
        });
    </script>
</body>
</html>