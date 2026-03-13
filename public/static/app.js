// Supplement Stack - Main App (Navigation & Auth State)
// Loaded on every page with navigation

class SupplementApp {
  constructor() {
    this.token = localStorage.getItem('auth_token')
    this.user = null
    try { this.user = JSON.parse(localStorage.getItem('user')) } catch {}
    this.init()
  }

  async init() {
    this.updateNavigation()
    this.setupMobileMenu()
    this.highlightActiveNav()

    // Redirect logged-in users away from auth page
    if (this.token && window.location.pathname === '/auth') {
      window.location.href = '/dashboard'
      return
    }

    // Verify token is still valid
    if (this.token) {
      try {
        const res = await fetch('/api/auth/profile', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        })
        const result = await res.json()
        if (res.ok && result.success) {
          this.user = result.data
          localStorage.setItem('user', JSON.stringify(result.data))
        } else {
          this.logout(false)
        }
      } catch {
        // Network error - keep token, user might be offline
      }
      this.updateNavigation()
      this.highlightActiveNav()
    }
  }

  isAuthenticated() {
    return !!this.token
  }

  updateNavigation() {
    const navLinks = document.getElementById('nav-links')
    const mobileNavLinks = document.getElementById('mobile-nav-links')
    if (!navLinks) return

    const isAuth = this.isAuthenticated()
    const currentPath = window.location.pathname

    const links = isAuth ? `
      <a href="/dashboard" class="nav-link text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium rounded-md transition-colors" data-path="/dashboard">Dashboard</a>
      <a href="/demo" class="nav-link text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium rounded-md transition-colors" data-path="/demo">Demo</a>
      <span class="text-gray-500 text-sm px-2">${this.user?.email || ''}</span>
      <button id="nav-logout-btn" class="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors">Abmelden</button>
    ` : `
      <a href="/" class="nav-link text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium rounded-md transition-colors" data-path="/">Start</a>
      <a href="/demo" class="nav-link text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium rounded-md transition-colors" data-path="/demo">Demo</a>
      <a href="/auth" class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">Anmelden</a>
    `

    navLinks.innerHTML = links

    if (mobileNavLinks) {
      const mobileLinks = isAuth ? `
        <a href="/dashboard" class="nav-link block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md" data-path="/dashboard">Dashboard</a>
        <a href="/demo" class="nav-link block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md" data-path="/demo">Demo</a>
        <button id="mobile-logout-btn" class="block w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-md">Abmelden</button>
      ` : `
        <a href="/" class="nav-link block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md" data-path="/">Start</a>
        <a href="/demo" class="nav-link block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md" data-path="/demo">Demo</a>
        <a href="/auth" class="block px-3 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-md">Anmelden</a>
      `
      mobileNavLinks.innerHTML = mobileLinks
    }

    // Logout handlers
    document.getElementById('nav-logout-btn')?.addEventListener('click', () => this.logout())
    document.getElementById('mobile-logout-btn')?.addEventListener('click', () => this.logout())
  }

  highlightActiveNav() {
    const currentPath = window.location.pathname
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkPath = link.getAttribute('data-path')
      if (linkPath === currentPath) {
        link.classList.add('text-blue-600', 'font-semibold')
        link.classList.remove('text-gray-700')
      }
    })
  }

  setupMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn')
    const menu = document.getElementById('mobile-menu')
    if (btn && menu) {
      btn.addEventListener('click', () => menu.classList.toggle('hidden'))
    }
  }

  async logout(redirect = true) {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    this.token = null
    this.user = null
    if (redirect) window.location.href = '/auth'
  }

  // Static API helper - always sends auth header and handles unified response format
  static async api(url, options = {}) {
    const token = localStorage.getItem('auth_token')
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(url, { ...options, headers, credentials: 'include' })

    // Handle 401 - redirect to login
    if (res.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      window.location.href = '/auth'
      throw new Error('Nicht authentifiziert')
    }

    const data = await res.json()
    if (!res.ok || data.success === false) {
      throw new Error(data.message || data.error || 'Ein Fehler ist aufgetreten')
    }
    return data
  }
}

// Initialize on every page
document.addEventListener('DOMContentLoaded', () => {
  window.app = new SupplementApp()
})
