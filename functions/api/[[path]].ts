import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'

import admin, { interactionsApp, shopDomainsPublicApp } from './modules/admin'
import auth, { meApp } from './modules/auth'
import demo from './modules/demo'
import ingredients, { recommendationsApp } from './modules/ingredients'
import products, { r2App } from './modules/products'
import stacks, { stackWarningsApp } from './modules/stacks'
import userProducts from './modules/user-products'
import wishlist from './modules/wishlist'
import type { AppContext } from './lib/types'

const app = new Hono<AppContext>()

app.use('*', cors({ origin: ['https://supplementstack.pages.dev', 'http://localhost:5173'] }))

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
app.route('/api/wishlist', wishlist)
app.route('/api/interactions', interactionsApp)
app.route('/api/user-products', userProducts)
app.route('/api/demo', demo)

export const onRequest = handle(app)
