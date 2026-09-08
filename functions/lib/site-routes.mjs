const APP_ROUTES = new Set([
  '/', '/login', '/register', '/profile', '/forgot-password', '/reset-password', '/verify-email',
  '/stacks', '/demo', '/creator', '/einnahmeplan', '/einnahmeplan-erstellen', '/my-products', '/wissen',
  '/impressum', '/datenschutz', '/nutzungsbedingungen', '/administrator',
  ...['dashboard', 'ingredients', 'products', 'interactions', 'dosing', 'health', 'knowledge',
    'translations', 'user-products', 'product-qa', 'link-reports', 'launch-checks', 'users',
    'shop-domains', 'management', 'research', 'legal', 'profile', 'rankings', 'sub-ingredients',
    'settings', 'creator-sharing'].map((route) => `/administrator/${route}`),
  '/administrator/products/new',
])

/** Exact SPA routes, not prefix-based permission for arbitrary invented pages. */
export function isCreatorProfileSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/.test(slug)
}

export function isCreatorProfilePath(pathname) {
  return pathname.startsWith('/creator/') && isCreatorProfileSlug(pathname.slice('/creator/'.length))
}

export function isKnownAppPath(pathname) {
  const path = pathname === '/' ? pathname : pathname.replace(/\/$/, '')
  return APP_ROUTES.has(path)
    || /^\/administrator\/(ingredients|products)\/[^/]+$/.test(path)
    || /^\/wissen\/[^/]+$/.test(path)
    || /^\/share\/[^/]+$/.test(path)
    || isCreatorProfilePath(path)
}

export function isBackendPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/') || pathname === '/robots.txt' || pathname === '/sitemap.xml'
}
