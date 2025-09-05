// Complete Authentication Routes with GDPR compliance and 2-step verification
import { Hono } from 'hono';
import AuthUtils from '../utils/auth';
import DatabaseService from '../utils/database';
import MailerSendService from '../utils/mailersend';
import { authMiddleware, rateLimitMiddleware, authCorsMiddleware, securityHeadersMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  MAILERSEND_API_KEY: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

const authRoutes = new Hono<{ Bindings: Bindings }>();

// Apply middleware
authRoutes.use('*', securityHeadersMiddleware);
authRoutes.use('*', authCorsMiddleware);
authRoutes.use('/register', rateLimitMiddleware(3, 30)); // 3 attempts per 30 minutes for registration
authRoutes.use('/login', rateLimitMiddleware(5, 15)); // 5 attempts per 15 minutes for login
authRoutes.use('/forgot-password', rateLimitMiddleware(3, 60)); // 3 attempts per hour for password reset

// =================================
// REGISTRATION WITH EMAIL VERIFICATION
// =================================

// Step 1: Register user (requires email verification)
authRoutes.post('/register', async (c) => {
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

    const authUtils = new AuthUtils(c.env.JWT_SECRET);
    const dbService = new DatabaseService(c.env.DB);
    const mailerService = new MailerSendService(c.env.MAILERSEND_API_KEY);

    // Validate email format
    if (!authUtils.validateEmail(email)) {
      return c.json({
        error: 'invalid_email_format',
        message: authUtils.getAuthErrorMessage('invalid_email_format')
      }, 400);
    }

    // Validate password strength
    const passwordValidation = authUtils.validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({
        error: 'password_too_weak',
        message: passwordValidation.message
      }, 400);
    }

    // Check if user already exists
    const existingUser = await dbService.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      if (existingUser.email_verified) {
        return c.json({
          error: 'email_already_exists',
          message: authUtils.getAuthErrorMessage('email_already_exists')
        }, 409);
      } else {
        // User exists but email not verified, allow re-registration
        // Delete the old unverified account
        await dbService.deleteUser(existingUser.id);
      }
    }

    // Hash password and generate verification token
    const passwordHash = await authUtils.hashPassword(password);
    const verificationToken = authUtils.generateSecureToken();

    // Create user
    const userId = await dbService.createUser(
      email.toLowerCase(),
      passwordHash,
      verificationToken
    );

    // Send verification email
    const baseUrl = c.env.ENVIRONMENT === 'production' 
      ? 'https://supplementstack.de' 
      : `https://${c.req.header('host')}`;

    await mailerService.sendEmailVerification(
      email,
      email.split('@')[0], // Use part before @ as name
      verificationToken,
      baseUrl
    );

    return c.json({
      message: 'Registrierung erfolgreich! Bitte überprüfen Sie Ihre E-Mails und bestätigen Sie Ihre E-Mail-Adresse.',
      userId: userId,
      emailSent: true
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'database_error') {
        return c.json({
          error: 'database_error',
          message: 'Datenbankfehler. Bitte versuchen Sie es später erneut.'
        }, 500);
      }
      if (error.message.includes('MailerSend')) {
        return c.json({
          error: 'email_send_failed',
          message: 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.'
        }, 500);
      }
    }

    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
    }, 500);
  }
});

// Step 2: Verify email address
authRoutes.get('/verify-email', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({
        error: 'missing_token',
        message: 'Verifizierungs-Token ist erforderlich'
      }, 400);
    }

    const dbService = new DatabaseService(c.env.DB);
    const user = await dbService.verifyEmailWithToken(token);

    if (!user) {
      return c.json({
        error: 'invalid_token',
        message: 'Ungültiger oder abgelaufener Verifizierungs-Token'
      }, 400);
    }

    // Generate JWT for the verified user
    const authUtils = new AuthUtils(c.env.JWT_SECRET);
    const jwtToken = await authUtils.generateJWT(user.id, user.email);

    // Set cookie and redirect to success page
    c.header('Set-Cookie', `auth_token=${jwtToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);
    
    // Return HTML success page
    return c.html(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>E-Mail-Verifizierung erfolgreich - Supplement Stack</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
              <div class="mb-6">
                  <div class="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                  </div>
                  <h1 class="text-2xl font-bold text-gray-900 mb-2">E-Mail erfolgreich bestätigt!</h1>
                  <p class="text-gray-600">Willkommen bei Supplement Stack. Ihr Konto ist jetzt aktiviert.</p>
              </div>
              <div class="space-y-4">
                  <a href="/dashboard" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                      Zum Dashboard
                  </a>
                  <a href="/" class="block w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors">
                      Zur Startseite
                  </a>
              </div>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Email verification error:', error);
    
    return c.html(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verifizierungsfehler - Supplement Stack</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
              <div class="mb-6">
                  <div class="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                      <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                  </div>
                  <h1 class="text-2xl font-bold text-gray-900 mb-2">Verifizierung fehlgeschlagen</h1>
                  <p class="text-gray-600">Der Verifizierungs-Link ist ungültig oder abgelaufen.</p>
              </div>
              <a href="/auth" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                  Zur Anmeldung
              </a>
          </div>
      </body>
      </html>
    `);
  }
});

// =================================
// 2-STEP LOGIN PROCESS
// =================================

// Step 1: Login with email/password (sends verification email)
authRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({
        error: 'missing_fields',
        message: 'E-Mail und Passwort sind erforderlich'
      }, 400);
    }

    const authUtils = new AuthUtils(c.env.JWT_SECRET);
    const dbService = new DatabaseService(c.env.DB);
    const mailerService = new MailerSendService(c.env.MAILERSEND_API_KEY);

    // Get user by email
    const user = await dbService.getUserByEmail(email.toLowerCase());

    if (!user || !await authUtils.verifyPassword(password, user.password_hash)) {
      return c.json({
        error: 'invalid_credentials',
        message: authUtils.getAuthErrorMessage('invalid_credentials')
      }, 401);
    }

    if (!user.email_verified) {
      return c.json({
        error: 'email_not_verified',
        message: authUtils.getAuthErrorMessage('email_not_verified')
      }, 403);
    }

    // Generate login verification token
    const loginToken = authUtils.generateSecureToken();
    await dbService.createEmailVerificationToken(user.id, loginToken, 15); // 15 minutes

    // Send login verification email
    const baseUrl = c.env.ENVIRONMENT === 'production' 
      ? 'https://supplementstack.de' 
      : `https://${c.req.header('host')}`;

    await mailerService.sendLoginVerification(
      user.email,
      user.email.split('@')[0],
      loginToken,
      baseUrl
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

// Step 2: Verify login (complete 2-step authentication)
authRoutes.get('/verify-login', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({
        error: 'missing_token',
        message: 'Anmelde-Token ist erforderlich'
      }, 400);
    }

    const dbService = new DatabaseService(c.env.DB);
    const user = await dbService.verifyLoginToken(token);

    if (!user) {
      return c.json({
        error: 'invalid_token',
        message: 'Ungültiger oder abgelaufener Anmelde-Token'
      }, 400);
    }

    // Generate JWT for successful login
    const authUtils = new AuthUtils(c.env.JWT_SECRET);
    const jwtToken = await authUtils.generateJWT(user.id, user.email);

    // Set cookie and redirect to dashboard
    c.header('Set-Cookie', `auth_token=${jwtToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);
    
    return c.html(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Anmeldung erfolgreich - Supplement Stack</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
              <div class="mb-6">
                  <div class="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                  </div>
                  <h1 class="text-2xl font-bold text-gray-900 mb-2">Anmeldung erfolgreich!</h1>
                  <p class="text-gray-600">Willkommen zurück bei Supplement Stack.</p>
              </div>
              <div class="space-y-4">
                  <a href="/dashboard" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                      Zum Dashboard
                  </a>
              </div>
              <script>
                // Auto-redirect after 3 seconds
                setTimeout(() => {
                  window.location.href = '/dashboard';
                }, 3000);
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

// =================================
// PASSWORD RESET
// =================================

// Step 1: Request password reset
authRoutes.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({
        error: 'missing_email',
        message: 'E-Mail-Adresse ist erforderlich'
      }, 400);
    }

    const authUtils = new AuthUtils(c.env.JWT_SECRET);
    const dbService = new DatabaseService(c.env.DB);
    const mailerService = new MailerSendService(c.env.MAILERSEND_API_KEY);

    // Always return success to prevent email enumeration
    const successMessage = 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Passwort-Reset-E-Mail gesendet.';

    const user = await dbService.getUserByEmail(email.toLowerCase());
    if (user && user.email_verified) {
      // Generate reset token
      const resetToken = authUtils.generateSecureToken();
      await dbService.createPasswordResetToken(user.id, resetToken);

      // Send reset email
      const baseUrl = c.env.ENVIRONMENT === 'production' 
        ? 'https://supplementstack.de' 
        : `https://${c.req.header('host')}`;

      await mailerService.sendPasswordReset(
        user.email,
        user.email.split('@')[0],
        resetToken,
        baseUrl
      );
    }

    return c.json({
      message: successMessage
    }, 200);

  } catch (error) {
    console.error('Password reset request error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Step 2: Reset password with token
authRoutes.post('/reset-password', async (c) => {
  try {
    const { token, password, confirmPassword } = await c.req.json();

    if (!token || !password || !confirmPassword) {
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

    const authUtils = new AuthUtils(c.env.JWT_SECRET);
    const dbService = new DatabaseService(c.env.DB);

    // Validate password strength
    const passwordValidation = authUtils.validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({
        error: 'password_too_weak',
        message: passwordValidation.message
      }, 400);
    }

    // Hash new password and reset
    const passwordHash = await authUtils.hashPassword(password);
    const user = await dbService.resetPasswordWithToken(token, passwordHash);

    if (!user) {
      return c.json({
        error: 'invalid_token',
        message: 'Ungültiger oder abgelaufener Reset-Token'
      }, 400);
    }

    return c.json({
      message: 'Passwort erfolgreich geändert. Sie können sich jetzt anmelden.'
    }, 200);

  } catch (error) {
    console.error('Password reset error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// =================================
// AUTHENTICATED USER ROUTES
// =================================

// Logout
authRoutes.post('/logout', authMiddleware, async (c) => {
  // Clear auth cookie
  c.header('Set-Cookie', 'auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  
  return c.json({
    message: 'Erfolgreich abgemeldet'
  }, 200);
});

// Get current user profile
authRoutes.get('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const dbService = new DatabaseService(c.env.DB);
    
    const userProfile = await dbService.getUserById(user.id);
    
    if (!userProfile) {
      return c.json({
        error: 'user_not_found',
        message: 'Benutzer nicht gefunden'
      }, 404);
    }

    // Remove sensitive data
    const { password_hash, email_verification_token, ...safeProfile } = userProfile;

    return c.json({
      user: safeProfile
    }, 200);

  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Update user profile
authRoutes.put('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const updates = await c.req.json();
    
    const dbService = new DatabaseService(c.env.DB);
    const updatedUser = await dbService.updateUserProfile(user.id, updates);

    if (!updatedUser) {
      return c.json({
        error: 'update_failed',
        message: 'Profil konnte nicht aktualisiert werden'
      }, 400);
    }

    // Remove sensitive data
    const { password_hash, email_verification_token, ...safeProfile } = updatedUser;

    return c.json({
      message: 'Profil erfolgreich aktualisiert',
      user: safeProfile
    }, 200);

  } catch (error) {
    console.error('Update profile error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Delete account (GDPR compliance)
authRoutes.delete('/account', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { password } = await c.req.json();

    if (!password) {
      return c.json({
        error: 'missing_password',
        message: 'Passwort zur Bestätigung erforderlich'
      }, 400);
    }

    const authUtils = new AuthUtils(c.env.JWT_SECRET);
    const dbService = new DatabaseService(c.env.DB);

    // Verify password before deletion
    const userRecord = await dbService.getUserById(user.id);
    if (!userRecord || !await authUtils.verifyPassword(password, userRecord.password_hash)) {
      return c.json({
        error: 'invalid_password',
        message: 'Ungültiges Passwort'
      }, 401);
    }

    // Delete user account
    const deleted = await dbService.deleteUser(user.id);
    
    if (!deleted) {
      return c.json({
        error: 'deletion_failed',
        message: 'Konto konnte nicht gelöscht werden'
      }, 500);
    }

    // Clear auth cookie
    c.header('Set-Cookie', 'auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');

    return c.json({
      message: 'Konto erfolgreich gelöscht'
    }, 200);

  } catch (error) {
    console.error('Account deletion error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Export user data (GDPR compliance)
authRoutes.get('/export-data', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const dbService = new DatabaseService(c.env.DB);

    const userData = await dbService.getUserDataForExport(user.id);

    if (!userData) {
      return c.json({
        error: 'export_failed',
        message: 'Datenexport fehlgeschlagen'
      }, 500);
    }

    return c.json({
      message: 'Datenexport erfolgreich',
      data: userData,
      exportDate: new Date().toISOString()
    }, 200);

  } catch (error) {
    console.error('Data export error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

export { authRoutes };