import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database;
}

export const authRoutes = new Hono<{ Bindings: Bindings }>()

// Simple auth for demo purposes (production würde JWT oder Sessions verwenden)
authRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    
    if (!email || !password) {
      return c.json({
        success: false,
        error: 'Email and password are required'
      }, 400)
    }
    
    // Demo user - in production würde man Hash vergleichen
    if (email === 'admin@supplement-stack.com' && password === 'admin123') {
      // Set simple session cookie
      setCookie(c, 'auth', 'authenticated', {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 24 * 60 * 60 // 24 hours
      })
      
      return c.json({
        success: true,
        message: 'Login successful',
        user: {
          id: 1,
          email: 'admin@supplement-stack.com',
          name: 'Admin User'
        }
      })
    }
    
    return c.json({
      success: false,
      error: 'Invalid credentials'
    }, 401)
  } catch (error) {
    console.error('Login error:', error)
    return c.json({
      success: false,
      error: 'Login failed'
    }, 500)
  }
})

authRoutes.post('/logout', async (c) => {
  setCookie(c, 'auth', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 0
  })
  
  return c.json({
    success: true,
    message: 'Logout successful'
  })
})

authRoutes.get('/me', async (c) => {
  const authCookie = getCookie(c, 'auth')
  
  if (authCookie === 'authenticated') {
    return c.json({
      success: true,
      user: {
        id: 1,
        email: 'admin@supplement-stack.com',
        name: 'Admin User'
      }
    })
  }
  
  return c.json({
    success: false,
    error: 'Not authenticated'
  }, 401)
})