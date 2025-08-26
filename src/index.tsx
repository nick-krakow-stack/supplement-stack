import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'
import type { CloudflareBindings } from './types'

// Import route handlers
import authRoutes from './routes/auth'
import wirkstoffRoutes from './routes/wirkstoffe'
import produktRoutes from './routes/produkte'
import stackRoutes from './routes/stacks'
import adminRoutes from './routes/admin'
import demoRoutes from './routes/demo'

const app = new Hono<{ Bindings: CloudflareBindings }>()

// Middleware
app.use(renderer)
app.use('/api/*', cors())

// Static files
app.use('/static/*', serveStatic({ root: './public' }))

// API Routes
app.route('/api/auth', authRoutes)
app.route('/api/wirkstoffe', wirkstoffRoutes)
app.route('/api/produkte', produktRoutes)
app.route('/api/stacks', stackRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/demo', demoRoutes)

// Main App Route
app.get('/', (c) => {
  return c.render(
    <div>
      <div id="app">
        <div className="min-h-screen bg-gray-50">
          {/* Loading wird durch Frontend JS ersetzt */}
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Supplement Stack wird geladen...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

// Catch all route for SPA
app.get('*', (c) => {
  return c.render(
    <div>
      <div id="app">
        <div className="min-h-screen bg-gray-50">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Supplement Stack wird geladen...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default app
