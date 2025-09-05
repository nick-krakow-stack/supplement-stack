// Authentication middleware for protecting routes
import { Context, Next } from 'hono';
import AuthUtils from '../utils/auth';
import DatabaseService from '../utils/database';

// Extend Hono context to include user information
declare module 'hono' {
  interface ContextVariableMap {
    user: {
      id: number;
      email: string;
      email_verified: boolean;
    };
  }
}

// Authentication middleware
export const authMiddleware = async (c: Context, next: Next) => {
  try {
    // Get JWT token from Authorization header or cookie
    const authHeader = c.req.header('Authorization');
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Fallback to cookie
      token = c.req.cookie('auth_token');
    }

    if (!token) {
      return c.json({ 
        error: 'unauthorized', 
        message: 'Authentifizierung erforderlich' 
      }, 401);
    }

    // Verify JWT token
    const authUtils = new AuthUtils(c.env.JWT_SECRET);
    const payload = await authUtils.verifyJWT(token);

    if (!payload) {
      return c.json({ 
        error: 'invalid_token', 
        message: 'Ungültiger oder abgelaufener Token' 
      }, 401);
    }

    // Get user from database to verify still exists and is active
    const dbService = new DatabaseService(c.env.DB);
    const user = await dbService.getUserById(payload.userId);

    if (!user) {
      return c.json({ 
        error: 'user_not_found', 
        message: 'Benutzer nicht gefunden' 
      }, 401);
    }

    // Check if email is verified
    if (!user.email_verified) {
      return c.json({ 
        error: 'email_not_verified', 
        message: 'Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse' 
      }, 403);
    }

    // Set user in context for use in protected routes
    c.set('user', {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified
    });

    await next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return c.json({ 
      error: 'internal_server_error', 
      message: 'Ein interner Fehler ist aufgetreten' 
    }, 500);
  }
};

// Optional authentication middleware (doesn't require auth, but sets user if available)
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  try {
    // Get JWT token from Authorization header or cookie
    const authHeader = c.req.header('Authorization');
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = c.req.cookie('auth_token');
    }

    if (token) {
      // Verify JWT token
      const authUtils = new AuthUtils(c.env.JWT_SECRET);
      const payload = await authUtils.verifyJWT(token);

      if (payload) {
        // Get user from database
        const dbService = new DatabaseService(c.env.DB);
        const user = await dbService.getUserById(payload.userId);

        if (user && user.email_verified) {
          c.set('user', {
            id: user.id,
            email: user.email,
            email_verified: user.email_verified
          });
        }
      }
    }

    await next();
  } catch (error) {
    // Don't fail the request if optional auth fails
    console.error('Optional auth middleware error:', error);
    await next();
  }
};

// Email verified middleware - requires email verification
export const emailVerifiedMiddleware = async (c: Context, next: Next) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ 
      error: 'unauthorized', 
      message: 'Authentifizierung erforderlich' 
    }, 401);
  }

  if (!user.email_verified) {
    return c.json({ 
      error: 'email_not_verified', 
      message: 'Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse' 
    }, 403);
  }

  await next();
};

// Rate limiting middleware
export const rateLimitMiddleware = (maxAttempts: number = 5, windowMinutes: number = 15) => {
  const attempts = new Map<string, { count: number; lastAttempt: number }>();
  const windowMs = windowMinutes * 60 * 1000;

  return async (c: Context, next: Next) => {
    const clientIP = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Forwarded-For') || 
                     c.req.header('X-Real-IP') || 
                     'unknown';

    const now = Date.now();
    const record = attempts.get(clientIP);

    // Check if client is rate limited
    if (record) {
      // Reset if window has passed
      if (now - record.lastAttempt > windowMs) {
        attempts.delete(clientIP);
      } else if (record.count >= maxAttempts) {
        const remainingTime = Math.ceil((windowMs - (now - record.lastAttempt)) / (60 * 1000));
        return c.json({
          error: 'rate_limit_exceeded',
          message: `Zu viele Versuche. Bitte warten Sie ${remainingTime} Minuten.`,
          retryAfter: remainingTime
        }, 429);
      }
    }

    // Store original json method to intercept error responses
    const originalJson = c.json.bind(c);
    
    // Override json method to track failed attempts
    c.json = (data: any, status?: number) => {
      // Track failed attempts for auth-related errors
      if (status === 401 || status === 400 || (status === 422 && data.error)) {
        const current = attempts.get(clientIP);
        if (!current || now - current.lastAttempt > windowMs) {
          attempts.set(clientIP, { count: 1, lastAttempt: now });
        } else {
          current.count++;
          current.lastAttempt = now;
          attempts.set(clientIP, current);
        }
      }

      return originalJson(data, status);
    };

    await next();
  };
};

// CORS middleware for authentication routes
export const authCorsMiddleware = async (c: Context, next: Next) => {
  // Set CORS headers for authentication
  c.header('Access-Control-Allow-Origin', '*'); // In production, set to specific domain
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  await next();
};

// Security headers middleware
export const securityHeadersMiddleware = async (c: Context, next: Next) => {
  await next();

  // Add security headers
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Don't cache sensitive authentication responses
  if (c.req.path.includes('/auth/')) {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
  }
};

export default {
  authMiddleware,
  optionalAuthMiddleware,
  emailVerifiedMiddleware,
  rateLimitMiddleware,
  authCorsMiddleware,
  securityHeadersMiddleware
};