// ============================================
// Supplement Stack - Main Entry Point
// Clean modular architecture - Router Hub
// ============================================
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { securityHeaders } from './middleware/authMiddleware'
import { apiSuccess, apiError } from './utils/helpers'

// Route modules
import authRoutes from './routes/authRoutes'
import productRoutes from './routes/productRoutes'
import stackRoutes from './routes/stackRoutes'
import catalogRoutes from './routes/catalogRoutes'
import adminRoutes from './routes/adminRoutes'
import pageRoutes from './routes/pageRoutes'

const app = new Hono<AppEnv>()

// ========================
// GLOBAL MIDDLEWARE
// ========================

// Security headers on all responses
app.use('*', securityHeaders)

// CORS for API routes
app.use('/api/*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}))

// ========================
// API ROUTES (all under /api)
// ========================

// Auth: /api/auth/*
app.route('/api/auth', authRoutes)

// Products (protected): /api/protected/products/*
app.route('/api/protected/products', productRoutes)

// Stacks (protected): /api/protected/stacks/*
app.route('/api/protected/stacks', stackRoutes)

// Catalog (public): /api/nutrients, /api/available-products, /api/interactions
app.route('/api', catalogRoutes)

// Admin: /api/admin/*
app.route('/api/admin', adminRoutes)

// Health check (top-level convenience)
app.get('/api/health', async (c) => {
  try {
    const dbTest = await c.env.DB.prepare('SELECT 1 as test').first()
    return c.json(apiSuccess({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbTest ? 'connected' : 'disconnected',
      environment: c.env.ENVIRONMENT || 'unknown'
    }))
  } catch (error: any) {
    return c.json(apiError('unhealthy', error.message), 500)
  }
})

// ========================
// HTML PAGE ROUTES
// ========================
app.route('', pageRoutes)

export default app
