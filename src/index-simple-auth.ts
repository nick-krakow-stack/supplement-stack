import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database;
  MAILERSEND_API_KEY: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// =================================
// UTILITY FUNCTIONS
// =================================

// Hash password using SHA-256 with salt
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = generateSecureToken().substring(0, 16);
  const saltedPassword = password + salt;
  
  const data = encoder.encode(saltedPassword);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return salt + hashHex;
}

// Verify password against hash
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const salt = hash.substring(0, 16);
    const storedHash = hash.substring(16);
    
    const saltedPassword = password + salt;
    const data = encoder.encode(saltedPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return computedHash === storedHash;
  } catch (error) {
    return false;
  }
}

// Generate secure random token
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Validate email format
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Passwort muss mindestens 8 Zeichen lang sein' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens einen Großbuchstaben enthalten' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens einen Kleinbuchstaben enthalten' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens eine Zahl enthalten' };
  }
  
  if (!/[!@#$%^&*()_+\\-=\\[\\]{};':"\\\\|,.<>\\?]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens ein Sonderzeichen enthalten' };
  }
  
  return { valid: true };
}

// Send email via MailerSend
async function sendEmail(apiKey: string, to: string, subject: string, html: string, text: string) {
  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: {
        email: 'noreply@supplementstack.de',
        name: 'Supplement Stack'
      },
      to: [{
        email: to
      }],
      subject: subject,
      html: html,
      text: text
    })
  });

  if (!response.ok) {
    throw new Error('Failed to send email');
  }

  return response.json();
}

// =================================
// HTML ROUTES
// =================================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dein intelligenter Supplement Manager - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Main content will be loaded here -->
        <div id="app">Loading...</div>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

app.get('/demo', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Demo - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Demo content will be loaded here -->
        <div id="demo-app">Loading Demo...</div>
        <script src="/static/demo-modal.js"></script>
    </body>
    </html>
  `)
})

app.get('/auth', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Anmeldung - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
        <div class="auth-container max-w-md w-full bg-white rounded-lg shadow-lg p-8 mx-4">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">🧬 Supplement Stack</h1>
                <p class="text-gray-600">Ihr intelligenter Supplement Manager</p>
            </div>

            <!-- Tab Navigation -->
            <div class="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button class="auth-tab flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors active" data-tab="login">
                    Anmelden
                </button>
                <button class="auth-tab flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors" data-tab="register">
                    Registrieren
                </button>
            </div>

            <!-- Login Tab -->
            <div id="loginTab" class="tab-content">
                <form id="loginForm" class="space-y-4">
                    <div>
                        <label for="loginEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                        <input type="email" id="loginEmail" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="loginPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                        <input type="password" id="loginPassword" name="password" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" id="loginBtn" 
                            class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium">
                        Anmelden
                    </button>
                </form>
                <div class="text-center mt-4">
                    <button class="auth-tab text-blue-600 hover:text-blue-800 text-sm" data-tab="forgot">
                        Passwort vergessen?
                    </button>
                </div>
                <div class="mt-6 p-4 bg-blue-50 rounded-md">
                    <h4 class="text-sm font-medium text-blue-800 mb-2">🔐 2-Schritt-Verifizierung</h4>
                    <p class="text-xs text-blue-700">Nach der Anmeldung erhalten Sie eine E-Mail zur Bestätigung. Dies schützt Ihr Konto gemäß DSGVO-Anforderungen.</p>
                </div>
            </div>

            <!-- Register Tab -->
            <div id="registerTab" class="tab-content hidden">
                <form id="registerForm" class="space-y-4">
                    <div>
                        <label for="registerEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                        <input type="email" id="registerEmail" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="registerPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                        <input type="password" id="registerPassword" name="password" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">Mindestens 8 Zeichen, mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen</p>
                    </div>
                    <div>
                        <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" id="registerBtn" 
                            class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors font-medium">
                        Registrieren
                    </button>
                </form>
                <div class="mt-6 p-4 bg-green-50 rounded-md">
                    <h4 class="text-sm font-medium text-green-800 mb-2">📧 E-Mail-Bestätigung erforderlich</h4>
                    <p class="text-xs text-green-700">Nach der Registrierung erhalten Sie eine E-Mail zur Bestätigung Ihrer Adresse. Dies ist für die DSGVO-Konformität erforderlich.</p>
                </div>
            </div>

            <!-- Forgot Password Tab -->
            <div id="forgotTab" class="tab-content hidden">
                <form id="forgotPasswordForm" class="space-y-4">
                    <div>
                        <label for="forgotEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                        <input type="email" id="forgotEmail" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" id="forgotBtn" 
                            class="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors font-medium">
                        Passwort zurücksetzen
                    </button>
                </form>
                <div class="text-center mt-4">
                    <button class="auth-tab text-blue-600 hover:text-blue-800 text-sm" data-tab="login">
                        Zurück zur Anmeldung
                    </button>
                </div>
            </div>

            <!-- Links -->
            <div class="mt-8 text-center">
                <a href="/" class="text-sm text-gray-600 hover:text-gray-800">
                    ← Zurück zur Startseite
                </a>
            </div>

            <!-- GDPR Notice -->
            <div class="mt-6 p-4 bg-gray-50 rounded-md">
                <p class="text-xs text-gray-600 text-center">
                    Mit der Nutzung stimmen Sie unseren 
                    <a href="/datenschutz" class="text-blue-600 hover:text-blue-800">Datenschutzbestimmungen</a> zu.
                    Alle Daten werden DSGVO-konform verarbeitet.
                </p>
            </div>
        </div>

        <script src="/static/auth.js"></script>
    </body>
    </html>
  `)
})

app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div id="dashboard-app">Loading Dashboard...</div>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// =================================
// AUTHENTICATION API ROUTES
// =================================

// User registration
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, confirmPassword } = await c.req.json();

    if (!email || !password || !confirmPassword) {
      return c.json({
        error: 'missing_fields',
        message: 'Alle Felder sind erforderlich'
      }, 400);
    }

    if (password !== confirmPassword) {
      return c.json({
        error: 'password_mismatch',
        message: 'Die Passwörter stimmen nicht überein'
      }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({
        error: 'invalid_email_format',
        message: 'Ungültiges E-Mail-Format'
      }, 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({
        error: 'password_too_weak',
        message: passwordValidation.message
      }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existingUser) {
      if (existingUser.email_verified) {
        return c.json({
          error: 'email_already_exists',
          message: 'Diese E-Mail-Adresse ist bereits registriert'
        }, 409);
      } else {
        // Delete unverified user
        await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(existingUser.id).run();
      }
    }

    // Hash password and generate verification token
    const passwordHash = await hashPassword(password);
    const verificationToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Create user
    const result = await c.env.DB.prepare(`
      INSERT INTO users (
        email, password_hash, email_verified, 
        email_verification_token, email_verification_expires_at,
        created_at, updated_at
      ) VALUES (?, ?, FALSE, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(email.toLowerCase(), passwordHash, verificationToken, expiresAt).run();

    // Send verification email
    const baseUrl = c.env.ENVIRONMENT === 'production' 
      ? 'https://supplementstack.de' 
      : `https://${c.req.header('host')}`;

    const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
    
    const emailHtml = `
      <h2>Willkommen bei Supplement Stack!</h2>
      <p>Bitte bestätigen Sie Ihre E-Mail-Adresse:</p>
      <a href="${verificationLink}" style="background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        E-Mail bestätigen
      </a>
      <p>Oder kopieren Sie diesen Link: ${verificationLink}</p>
    `;

    const emailText = `Willkommen bei Supplement Stack! Bestätigen Sie Ihre E-Mail: ${verificationLink}`;

    await sendEmail(
      c.env.MAILERSEND_API_KEY,
      email,
      'E-Mail-Adresse bestätigen - Supplement Stack',
      emailHtml,
      emailText
    );

    return c.json({
      message: 'Registrierung erfolgreich! Bitte überprüfen Sie Ihre E-Mails.',
      emailSent: true
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Email verification
app.get('/api/auth/verify-email', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({
        error: 'missing_token',
        message: 'Verifizierungs-Token ist erforderlich'
      }, 400);
    }

    // Find and verify user
    const user = await c.env.DB.prepare(`
      SELECT * FROM users 
      WHERE email_verification_token = ? 
      AND email_verification_expires_at > CURRENT_TIMESTAMP
      AND email_verified = FALSE
    `).bind(token).first();

    if (!user) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>Verifizierung fehlgeschlagen</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen">
            <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                <h1 class="text-2xl font-bold text-red-600 mb-4">❌ Verifizierung fehlgeschlagen</h1>
                <p class="text-gray-600 mb-6">Der Verifizierungs-Link ist ungültig oder abgelaufen.</p>
                <a href="/auth" class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                    Zur Anmeldung
                </a>
            </div>
        </body>
        </html>
      `);
    }

    // Mark email as verified
    await c.env.DB.prepare(`
      UPDATE users 
      SET email_verified = TRUE, 
          email_verification_token = NULL, 
          email_verification_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(user.id).run();

    // Generate JWT token
    const jwtToken = await sign({
      userId: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
    }, c.env.JWT_SECRET);

    // Set auth cookie
    c.header('Set-Cookie', `auth_token=${jwtToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);

    return c.html(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <title>E-Mail erfolgreich bestätigt</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
              <h1 class="text-2xl font-bold text-green-600 mb-4">✅ E-Mail bestätigt!</h1>
              <p class="text-gray-600 mb-6">Ihr Konto ist jetzt aktiviert. Willkommen bei Supplement Stack!</p>
              <div class="space-y-4">
                  <a href="/dashboard" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                      Zum Dashboard
                  </a>
                  <a href="/" class="block w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300">
                      Zur Startseite
                  </a>
              </div>
              <script>
                setTimeout(() => window.location.href = '/dashboard', 3000);
              </script>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Email verification error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// User login (2-step process)
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({
        error: 'missing_fields',
        message: 'E-Mail und Passwort sind erforderlich'
      }, 400);
    }

    // Get user
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!user || !await verifyPassword(password, user.password_hash)) {
      return c.json({
        error: 'invalid_credentials',
        message: 'Ungültige E-Mail-Adresse oder Passwort'
      }, 401);
    }

    if (!user.email_verified) {
      return c.json({
        error: 'email_not_verified',
        message: 'Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse'
      }, 403);
    }

    // Generate login verification token
    const loginToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    await c.env.DB.prepare(`
      INSERT INTO email_verification_tokens (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).bind(user.id, loginToken, expiresAt).run();

    // Send login verification email
    const baseUrl = c.env.ENVIRONMENT === 'production' 
      ? 'https://supplementstack.de' 
      : `https://${c.req.header('host')}`;

    const loginLink = `${baseUrl}/api/auth/verify-login?token=${loginToken}`;
    
    const emailHtml = `
      <h2>Anmeldung bestätigen</h2>
      <p>Jemand möchte sich mit Ihrem Supplement Stack Konto anmelden.</p>
      <p>Falls Sie es waren, klicken Sie hier:</p>
      <a href="${loginLink}" style="background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Anmeldung bestätigen
      </a>
      <p>Link gültig für 15 Minuten. Falls Sie es nicht waren, ignorieren Sie diese E-Mail.</p>
    `;

    const emailText = `Anmeldung bestätigen: ${loginLink}`;

    await sendEmail(
      c.env.MAILERSEND_API_KEY,
      user.email,
      'Anmeldung bestätigen - Supplement Stack',
      emailHtml,
      emailText
    );

    return c.json({
      message: 'Anmeldedaten korrekt. Bitte überprüfen Sie Ihre E-Mails und bestätigen Sie die Anmeldung.',
      emailSent: true,
      requiresVerification: true
    }, 200);

  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Verify login
app.get('/api/auth/verify-login', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({
        error: 'missing_token',
        message: 'Anmelde-Token ist erforderlich'
      }, 400);
    }

    // Get user by token
    const result = await c.env.DB.prepare(`
      SELECT u.* FROM users u
      INNER JOIN email_verification_tokens evt ON u.id = evt.user_id
      WHERE evt.token = ? 
      AND evt.expires_at > CURRENT_TIMESTAMP
      AND evt.used_at IS NULL
    `).bind(token).first();

    if (!result) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>Anmeldung fehlgeschlagen</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen">
            <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                <h1 class="text-2xl font-bold text-red-600 mb-4">❌ Anmeldung fehlgeschlagen</h1>
                <p class="text-gray-600 mb-6">Der Anmelde-Link ist ungültig oder abgelaufen.</p>
                <a href="/auth" class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                    Zur Anmeldung
                </a>
            </div>
        </body>
        </html>
      `);
    }

    // Mark token as used
    await c.env.DB.prepare(`
      UPDATE email_verification_tokens 
      SET used_at = CURRENT_TIMESTAMP 
      WHERE token = ?
    `).bind(token).run();

    // Generate JWT token
    const jwtToken = await sign({
      userId: result.id,
      email: result.email,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
    }, c.env.JWT_SECRET);

    // Set auth cookie
    c.header('Set-Cookie', `auth_token=${jwtToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);

    return c.html(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <title>Anmeldung erfolgreich</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
              <h1 class="text-2xl font-bold text-green-600 mb-4">✅ Anmeldung erfolgreich!</h1>
              <p class="text-gray-600 mb-6">Willkommen zurück bei Supplement Stack!</p>
              <a href="/dashboard" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                  Zum Dashboard
              </a>
              <script>
                setTimeout(() => window.location.href = '/dashboard', 2000);
              </script>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Login verification error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({
        error: 'missing_email',
        message: 'E-Mail-Adresse ist erforderlich'
      }, 400);
    }

    const successMessage = 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Passwort-Reset-E-Mail gesendet.';

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND email_verified = TRUE'
    ).bind(email.toLowerCase()).first();

    if (user) {
      const resetToken = generateSecureToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Delete existing reset tokens
      await c.env.DB.prepare(`
        DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL
      `).bind(user.id).run();

      // Create new reset token
      await c.env.DB.prepare(`
        INSERT INTO email_verification_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `).bind(user.id, resetToken, expiresAt).run();

      // Send reset email
      const baseUrl = c.env.ENVIRONMENT === 'production' 
        ? 'https://supplementstack.de' 
        : `https://${c.req.header('host')}`;

      const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
      
      const emailHtml = `
        <h2>Passwort zurücksetzen</h2>
        <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
        <a href="${resetLink}" style="background: #DC2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Passwort zurücksetzen
        </a>
        <p>Link gültig für 1 Stunde. Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
      `;

      const emailText = `Passwort zurücksetzen: ${resetLink}`;

      await sendEmail(
        c.env.MAILERSEND_API_KEY,
        user.email,
        'Passwort zurücksetzen - Supplement Stack',
        emailHtml,
        emailText
      );
    }

    return c.json({ message: successMessage }, 200);

  } catch (error) {
    console.error('Password reset request error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    auth: 'enabled'
  })
})

export default app