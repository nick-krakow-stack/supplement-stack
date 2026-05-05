import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'

import admin, { interactionsApp, shopDomainsPublicApp } from './modules/admin'
import auth, { meApp } from './modules/auth'
import demo from './modules/demo'
import family from './modules/family'
import ingredients, { recommendationsApp } from './modules/ingredients'
import knowledge from './modules/knowledge'
import products, { r2App } from './modules/products'
import stacks, { stackWarningsApp } from './modules/stacks'
import userProducts from './modules/user-products'
import type { AppContext } from './lib/types'

const app = new Hono<AppContext>()

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return null
    const allowed = [
      'https://supplementstack.de',
      'https://www.supplementstack.de',
      'https://supplementstack.pages.dev',
      'http://localhost:5173',
    ]
    if (allowed.includes(origin)) return origin
    // Pages preview subdomains: https://<hash>.supplementstack.pages.dev
    if (/^https:\/\/[a-z0-9-]+\.supplementstack\.pages\.dev$/.test(origin)) return origin
    return null
  },
}))

app.route('/api/auth', auth)
app.route('/api/me', meApp)
app.route('/api/ingredients', ingredients)
app.route('/api/recommendations', recommendationsApp)
app.route('/api/products', products)
app.route('/api/r2', r2App)
app.route('/api/admin', admin)
app.route('/api/shop-domains', shopDomainsPublicApp)
app.route('/api/stacks', stacks)
app.route('/api/stack-warnings', stackWarningsApp)
app.route('/api/interactions', interactionsApp)
app.route('/api/user-products', userProducts)
app.route('/api/demo', demo)
app.route('/api/family', family)
app.route('/api/knowledge', knowledge)

export const onRequest = handle(app)
