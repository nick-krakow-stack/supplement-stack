import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { apiRoutes } from './routes/api'
import { authRoutes } from './routes/auth'
import { pageRoutes } from './routes/pages'

// Cloudflare Bindings Type
type Bindings = {
  DB: D1Database;
}

// Hono App mit Cloudflare Bindings
const app = new Hono<{ Bindings: Bindings }>()

// CORS für API-Endpunkte
app.use('/api/*', cors())

// Statische Dateien aus public/
app.use('/static/*', serveStatic({ root: './public' }))

// API Routes
app.route('/api', apiRoutes)

// Auth Routes  
app.route('/auth', authRoutes)

// Page Routes
app.route('/', pageRoutes)

// Fallback für SPA
app.get('*', serveStatic({ path: './public/index.html' }))

export default app