// Database utilities for user management and authentication
export interface User {
  id: number;
  email: string;
  password_hash: string;
  google_id?: string;
  age?: number;
  gender?: 'männlich' | 'weiblich' | 'divers';
  weight?: number;
  diet_type?: 'omnivore' | 'vegetarisch' | 'vegan';
  personal_goals?: string;
  guideline_source?: 'DGE' | 'studien' | 'influencer';
  email_verified: boolean;
  email_verification_token?: string;
  email_verification_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailVerificationToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  used_at?: string;
  created_at: string;
}

export class DatabaseService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Create new user
  async createUser(email: string, passwordHash: string, verificationToken: string): Promise<number> {
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      const result = await this.db.prepare(`
        INSERT INTO users (
          email, 
          password_hash, 
          email_verified, 
          email_verification_token, 
          email_verification_expires_at,
          created_at,
          updated_at
        ) VALUES (?, ?, FALSE, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(email, passwordHash, verificationToken, expiresAt).run();

      if (!result.meta.last_row_id) {
        throw new Error('Failed to create user');
      }

      return result.meta.last_row_id as number;
    } catch (error) {
      console.error('Database error creating user:', error);
      throw new Error('database_error');
    }
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.db.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).bind(email).first();

      return result as User | null;
    } catch (error) {
      console.error('Database error getting user by email:', error);
      throw new Error('database_error');
    }
  }

  // Get user by ID
  async getUserById(userId: number): Promise<User | null> {
    try {
      const result = await this.db.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(userId).first();

      return result as User | null;
    } catch (error) {
      console.error('Database error getting user by ID:', error);
      throw new Error('database_error');
    }
  }

  // Verify email with token
  async verifyEmailWithToken(token: string): Promise<User | null> {
    try {
      // First, check if token exists and is valid
      const user = await this.db.prepare(`
        SELECT * FROM users 
        WHERE email_verification_token = ? 
        AND email_verification_expires_at > CURRENT_TIMESTAMP
        AND email_verified = FALSE
      `).bind(token).first() as User | null;

      if (!user) {
        return null;
      }

      // Mark email as verified and clear token
      await this.db.prepare(`
        UPDATE users 
        SET email_verified = TRUE, 
            email_verification_token = NULL, 
            email_verification_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(user.id).run();

      return await this.getUserById(user.id);
    } catch (error) {
      console.error('Database error verifying email:', error);
      throw new Error('database_error');
    }
  }

  // Create email verification token
  async createEmailVerificationToken(userId: number, token: string, expiresInMinutes: number = 15): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

      await this.db.prepare(`
        INSERT INTO email_verification_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `).bind(userId, token, expiresAt).run();
    } catch (error) {
      console.error('Database error creating verification token:', error);
      throw new Error('database_error');
    }
  }

  // Verify login token (for 2-step authentication)
  async verifyLoginToken(token: string): Promise<User | null> {
    try {
      // Get user associated with this token
      const result = await this.db.prepare(`
        SELECT u.* FROM users u
        INNER JOIN email_verification_tokens evt ON u.id = evt.user_id
        WHERE evt.token = ? 
        AND evt.expires_at > CURRENT_TIMESTAMP
        AND evt.used_at IS NULL
      `).bind(token).first() as User | null;

      if (!result) {
        return null;
      }

      // Mark token as used
      await this.db.prepare(`
        UPDATE email_verification_tokens 
        SET used_at = CURRENT_TIMESTAMP 
        WHERE token = ?
      `).bind(token).run();

      return result;
    } catch (error) {
      console.error('Database error verifying login token:', error);
      throw new Error('database_error');
    }
  }

  // Create password reset token
  async createPasswordResetToken(userId: number, token: string): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Delete any existing password reset tokens for this user
      await this.db.prepare(`
        DELETE FROM email_verification_tokens 
        WHERE user_id = ? AND used_at IS NULL
      `).bind(userId).run();

      // Create new token
      await this.db.prepare(`
        INSERT INTO email_verification_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `).bind(userId, token, expiresAt).run();
    } catch (error) {
      console.error('Database error creating password reset token:', error);
      throw new Error('database_error');
    }
  }

  // Reset password with token
  async resetPasswordWithToken(token: string, newPasswordHash: string): Promise<User | null> {
    try {
      // Verify token is valid
      const result = await this.db.prepare(`
        SELECT u.* FROM users u
        INNER JOIN email_verification_tokens evt ON u.id = evt.user_id
        WHERE evt.token = ? 
        AND evt.expires_at > CURRENT_TIMESTAMP
        AND evt.used_at IS NULL
      `).bind(token).first() as User | null;

      if (!result) {
        return null;
      }

      // Update password and mark token as used
      await this.db.prepare(`
        UPDATE users 
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(newPasswordHash, result.id).run();

      await this.db.prepare(`
        UPDATE email_verification_tokens 
        SET used_at = CURRENT_TIMESTAMP 
        WHERE token = ?
      `).bind(token).run();

      return await this.getUserById(result.id);
    } catch (error) {
      console.error('Database error resetting password:', error);
      throw new Error('database_error');
    }
  }

  // Update user profile
  async updateUserProfile(userId: number, updates: Partial<User>): Promise<User | null> {
    try {
      const allowedFields = ['age', 'gender', 'weight', 'diet_type', 'personal_goals', 'guideline_source'];
      const updateFields: string[] = [];
      const values: any[] = [];

      // Build dynamic update query
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key as keyof User] !== undefined) {
          updateFields.push(`${key} = ?`);
          values.push(updates[key as keyof User]);
        }
      });

      if (updateFields.length === 0) {
        return await this.getUserById(userId);
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);

      await this.db.prepare(`
        UPDATE users SET ${updateFields.join(', ')} WHERE id = ?
      `).bind(...values).run();

      return await this.getUserById(userId);
    } catch (error) {
      console.error('Database error updating user profile:', error);
      throw new Error('database_error');
    }
  }

  // Delete user account (GDPR right to deletion)
  async deleteUser(userId: number): Promise<boolean> {
    try {
      // Delete user and all related data (CASCADE should handle this)
      const result = await this.db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
      return result.changes > 0;
    } catch (error) {
      console.error('Database error deleting user:', error);
      throw new Error('database_error');
    }
  }

  // Get user data for GDPR export
  async getUserDataForExport(userId: number): Promise<any> {
    try {
      // Get all user data for GDPR compliance
      const user = await this.getUserById(userId);
      if (!user) return null;

      // Get related data
      const products = await this.db.prepare('SELECT * FROM products WHERE user_id = ?').bind(userId).all();
      const stacks = await this.db.prepare('SELECT * FROM stacks WHERE user_id = ?').bind(userId).all();
      const notes = await this.db.prepare('SELECT * FROM user_notes WHERE user_id = ?').bind(userId).all();
      const wishlist = await this.db.prepare('SELECT * FROM wishlist WHERE user_id = ?').bind(userId).all();

      return {
        user: {
          ...user,
          password_hash: '[REDACTED]' // Don't include password hash in export
        },
        products: products.results,
        stacks: stacks.results,
        notes: notes.results,
        wishlist: wishlist.results
      };
    } catch (error) {
      console.error('Database error exporting user data:', error);
      throw new Error('database_error');
    }
  }

  // Clean up expired tokens (maintenance task)
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await this.db.prepare(`
        DELETE FROM email_verification_tokens 
        WHERE expires_at < CURRENT_TIMESTAMP
      `).run();

      // Also clean up unverified users older than 24 hours
      await this.db.prepare(`
        DELETE FROM users 
        WHERE email_verified = FALSE 
        AND created_at < datetime('now', '-24 hours')
      `).run();

      return result.changes;
    } catch (error) {
      console.error('Database error cleaning up tokens:', error);
      return 0;
    }
  }
}

export default DatabaseService;