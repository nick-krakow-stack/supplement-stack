// Authentication utilities for JWT, password hashing, and token generation
import { sign, verify } from 'hono/jwt';

// JWT Token interface
export interface JWTPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

// Verification token interface
export interface VerificationToken {
  userId: number;
  email: string;
  type: 'email_verification' | 'login_verification' | 'password_reset';
  expiresAt: Date;
}

export class AuthUtils {
  private jwtSecret: string;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  // Generate JWT token for authenticated user
  async generateJWT(userId: number, email: string, expiresIn: number = 24 * 60 * 60): Promise<string> {
    const payload: JWTPayload = {
      userId,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresIn // 24 hours default
    };

    return await sign(payload, this.jwtSecret);
  }

  // Verify JWT token
  async verifyJWT(token: string): Promise<JWTPayload | null> {
    try {
      const payload = await verify(token, this.jwtSecret) as JWTPayload;
      return payload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  // Generate secure random token for email verification, login verification, or password reset
  generateSecureToken(): string {
    // Generate 32 byte (256-bit) random token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Hash password using SHA-256 with salt
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = this.generateSecureToken().substring(0, 16); // Use first 16 chars as salt
    const saltedPassword = password + salt;
    
    const data = encoder.encode(saltedPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Return salt + hash (salt is first 16 chars, hash is rest)
    return salt + hashHex;
  }

  // Verify password against hash
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const encoder = new TextEncoder();
      const salt = hash.substring(0, 16); // Extract salt from stored hash
      const storedHash = hash.substring(16); // Extract hash part
      
      const saltedPassword = password + salt;
      const data = encoder.encode(saltedPassword);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return computedHash === storedHash;
    } catch (error) {
      console.error('Password verification failed:', error);
      return false;
    }
  }

  // Validate email format
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength (GDPR security requirements)
  validatePassword(password: string): { valid: boolean; message?: string } {
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
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
      return { valid: false, message: 'Passwort muss mindestens ein Sonderzeichen enthalten' };
    }
    
    return { valid: true };
  }

  // Generate token expiry time
  generateTokenExpiry(minutes: number): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  // Check if token is expired
  isTokenExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  // Sanitize user input
  sanitizeInput(input: string): string {
    return input.trim().toLowerCase();
  }

  // Generate user-friendly error messages in German
  getAuthErrorMessage(error: string): string {
    const errorMessages: { [key: string]: string } = {
      'invalid_credentials': 'Ungültige E-Mail-Adresse oder Passwort',
      'user_not_found': 'Benutzer nicht gefunden',
      'email_already_exists': 'Diese E-Mail-Adresse ist bereits registriert',
      'invalid_token': 'Ungültiger oder abgelaufener Token',
      'token_expired': 'Der Token ist abgelaufen. Bitte fordern Sie einen neuen an.',
      'email_not_verified': 'Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse',
      'user_not_active': 'Ihr Konto ist deaktiviert. Kontaktieren Sie den Support.',
      'rate_limit_exceeded': 'Zu viele Versuche. Bitte warten Sie 15 Minuten.',
      'invalid_email_format': 'Ungültiges E-Mail-Format',
      'password_too_weak': 'Das Passwort entspricht nicht den Sicherheitsanforderungen',
      'internal_server_error': 'Ein interner Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
      'email_send_failed': 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
      'database_error': 'Datenbankfehler. Bitte versuchen Sie es später erneut.'
    };

    return errorMessages[error] || 'Ein unbekannter Fehler ist aufgetreten';
  }
}

// Rate limiting for authentication attempts
export class RateLimiter {
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 5, windowMinutes: number = 15) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMinutes * 60 * 1000;
  }

  // Check if IP/email is rate limited
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      return false;
    }

    // Reset if window has passed
    if (now - record.lastAttempt > this.windowMs) {
      this.attempts.delete(identifier);
      return false;
    }

    return record.count >= this.maxAttempts;
  }

  // Record a failed attempt
  recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record || now - record.lastAttempt > this.windowMs) {
      this.attempts.set(identifier, { count: 1, lastAttempt: now });
    } else {
      record.count++;
      record.lastAttempt = now;
      this.attempts.set(identifier, record);
    }
  }

  // Reset attempts for identifier
  resetAttempts(identifier: string): void {
    this.attempts.delete(identifier);
  }

  // Get remaining time in minutes
  getRemainingTime(identifier: string): number {
    const record = this.attempts.get(identifier);
    if (!record) return 0;

    const elapsed = Date.now() - record.lastAttempt;
    const remaining = Math.max(0, this.windowMs - elapsed);
    return Math.ceil(remaining / (60 * 1000));
  }
}

export default AuthUtils;