import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { User } from '../types';

type Bindings = {
  DB: D1Database;
}

export async function authMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const sessionId = getCookie(c, 'session_id');
  
  if (!sessionId) {
    return c.json({ success: false, error: 'Nicht authentifiziert' }, 401);
  }

  try {
    // Check if session exists and is valid
    const session = await c.env.DB.prepare(`
      SELECT s.*, u.* FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).bind(sessionId).first();

    if (!session) {
      return c.json({ success: false, error: 'Session ungültig oder abgelaufen' }, 401);
    }

    // Add user to context
    c.set('user', {
      id: session.user_id,
      email: session.email,
      name: session.name,
      age: session.age,
      gender: session.gender,
      weight: session.weight,
      diet_type: session.diet_type,
      personal_goals: session.personal_goals,
      guideline_source: session.guideline_source,
      is_admin: session.is_admin,
      google_id: session.google_id,
      created_at: session.created_at,
      updated_at: session.updated_at
    } as User);

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ success: false, error: 'Authentifizierungsfehler' }, 500);
  }
}

export async function adminMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const user = c.get('user') as User;
  
  if (!user || !user.is_admin) {
    return c.json({ success: false, error: 'Admin-Berechtigung erforderlich' }, 403);
  }

  await next();
}

export async function optionalAuthMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const sessionId = getCookie(c, 'session_id');
  
  if (sessionId) {
    try {
      const session = await c.env.DB.prepare(`
        SELECT s.*, u.* FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ? AND s.expires_at > datetime('now')
      `).bind(sessionId).first();

      if (session) {
        c.set('user', {
          id: session.user_id,
          email: session.email,
          name: session.name,
          age: session.age,
          gender: session.gender,
          weight: session.weight,
          diet_type: session.diet_type,
          personal_goals: session.personal_goals,
          guideline_source: session.guideline_source,
          is_admin: session.is_admin,
          google_id: session.google_id,
          created_at: session.created_at,
          updated_at: session.updated_at
        } as User);
      }
    } catch (error) {
      // Continue without authentication
      console.error('Optional auth error:', error);
    }
  }

  await next();
}