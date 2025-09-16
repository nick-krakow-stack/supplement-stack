// Smart Loader - Intelligentes Lazy-Loading System
// Lädt nur die benötigten Module basierend auf der aktuellen Seite

class SmartLoader {
  constructor() {
    this.loadedModules = new Set()
    this.currentPage = this.detectCurrentPage()
    this.loadStartTime = performance.now()
    
    console.log(`[Smart Loader] Detected page: ${this.currentPage}`)
    this.init()
  }

  detectCurrentPage() {
    const path = window.location.pathname
    
    if (path === '/demo') return 'demo'
    if (path === '/dashboard') return 'dashboard'
    if (path === '/products') return 'products'
    if (path === '/stacks') return 'stacks'
    if (path === '/auth') return 'auth'
    if (path === '/admin') return 'admin'
    
    return 'home'
  }

  async init() {
    try {
      // Lade Performance Core zuerst (immer benötigt)
      await this.loadPerformanceCore()
      
      // Lade seitenspezifische Module
      await this.loadPageSpecificModules()
      
      // Initialisiere die geladenen Module
      await this.initializeModules()
      
      const totalTime = Math.round(performance.now() - this.loadStartTime)
      console.log(`[Smart Loader] Page loaded in ${totalTime}ms`)
      
    } catch (error) {
      console.error('[Smart Loader] Loading error:', error)
      this.showLoadError()
    }
  }

  async loadPerformanceCore() {
    if (this.loadedModules.has('performance-core')) return
    
    // Performance Core ist bereits geladen, nur initialisieren
    if (window.performanceCore) {
      this.loadedModules.add('performance-core')
      return
    }
    
    console.error('[Smart Loader] Performance Core not found')
  }

  async loadPageSpecificModules() {
    switch (this.currentPage) {
      case 'demo':
        await this.loadDemoModules()
        break
        
      case 'dashboard':
        await this.loadDashboardModules()  
        break
        
      case 'products':
        await this.loadProductModules()
        break
        
      case 'stacks':
        await this.loadStackModules()
        break
        
      case 'auth':
        await this.loadAuthModules()
        break
        
      default:
        await this.loadHomeModules()
        break
    }
  }

  async loadDemoModules() {
    console.log('[Smart Loader] Loading demo modules...')
    
    // Prüfe ob FastDemoApp schon verfügbar ist
    if (window.FastDemoApp) {
      this.loadedModules.add('demo-fast')
      return
    }
    
    // Fallback falls FastDemoApp nicht geladen
    console.log('[Smart Loader] FastDemoApp not found, using fallback')
  }

  async loadDashboardModules() {
    console.log('[Smart Loader] Loading dashboard modules...')
    
    // Lade Dashboard-spezifische Module nur wenn benötigt
    if (!this.loadedModules.has('dashboard-app')) {
      // Dashboard app lazy loading
      await this.loadScript('/static/dashboard-app.js')
      this.loadedModules.add('dashboard-app')
    }
  }

  async loadProductModules() {
    console.log('[Smart Loader] Loading product modules...')
    
    if (!this.loadedModules.has('products-app')) {
      await this.loadScript('/static/products-app.js')
      this.loadedModules.add('products-app')
    }
  }

  async loadStackModules() {
    console.log('[Smart Loader] Loading stack modules...')
    
    if (!this.loadedModules.has('stacks-app')) {
      await this.loadScript('/static/stacks-app.js')
      this.loadedModules.add('stacks-app')
    }
  }

  async loadAuthModules() {
    console.log('[Smart Loader] Loading auth modules...')
    
    if (!this.loadedModules.has('auth')) {
      await this.loadScript('/static/auth.js')
      this.loadedModules.add('auth')
    }
  }

  async loadHomeModules() {
    console.log('[Smart Loader] Loading home modules...')
    
    // Minimale Module für Homepage
    if (!this.loadedModules.has('app')) {
      await this.loadScript('/static/app.js')
      this.loadedModules.add('app')
    }
  }

  async loadScript(src) {
    return new Promise((resolve, reject) => {
      // Prüfe ob Script schon geladen
      const existingScript = document.querySelector(`script[src="${src}"]`)
      if (existingScript) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = src
      script.async = true
      
      script.onload = () => {
        console.log(`[Smart Loader] Loaded: ${src}`)
        resolve()
      }
      
      script.onerror = () => {
        console.error(`[Smart Loader] Failed to load: ${src}`)
        reject(new Error(`Failed to load ${src}`))
      }
      
      document.head.appendChild(script)
    })
  }

  async initializeModules() {
    console.log(`[Smart Loader] Initializing modules for ${this.currentPage}...`)
    
    switch (this.currentPage) {
      case 'demo':
        await this.initDemo()
        break
        
      case 'dashboard':
        await this.initDashboard()
        break
        
      case 'products':
        await this.initProducts()
        break
        
      case 'stacks':
        await this.initStacks()
        break
        
      case 'auth':
        await this.initAuth()
        break
        
      default:
        await this.initHome()
        break
    }
  }

  async initDemo() {
    if (window.FastDemoApp) {
      window.demoApp = new window.FastDemoApp()
      console.log('[Smart Loader] FastDemoApp initialized')
    } else if (window.SupplementDemoApp) {
      // Fallback zur alten Demo App
      window.demoApp = new window.SupplementDemoApp()
      console.log('[Smart Loader] Fallback to SupplementDemoApp')
    } else {
      console.error('[Smart Loader] No demo app available')
    }
  }

  async initDashboard() {
    if (window.DashboardApp) {
      window.dashboardApp = new window.DashboardApp()
      console.log('[Smart Loader] DashboardApp initialized')
    } else if (window.SupplementDemoApp) {
      // Fallback: Demo App als Dashboard
      window.demoApp = new window.SupplementDemoApp()
      console.log('[Smart Loader] Using demo app for dashboard')
    }
  }

  async initProducts() {
    if (window.ProductsApp) {
      window.productsApp = new window.ProductsApp()
      console.log('[Smart Loader] ProductsApp initialized')
    }
  }

  async initStacks() {
    if (window.StacksApp) {
      window.stacksApp = new window.StacksApp()
      console.log('[Smart Loader] StacksApp initialized')
    }
  }

  async initAuth() {
    // Auth wird über auth.js initialisiert
    console.log('[Smart Loader] Auth modules ready')
  }

  async initHome() {
    if (window.SupplementApp) {
      window.app = new window.SupplementApp()
      console.log('[Smart Loader] SupplementApp initialized')
    }
  }

  showLoadError() {
    const errorDiv = document.createElement('div')
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg z-50'
    errorDiv.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <span>Fehler beim Laden der Anwendung</span>
      </div>
    `
    document.body.appendChild(errorDiv)
    
    setTimeout(() => errorDiv.remove(), 5000)
  }

  // Cleanup when leaving page
  cleanup() {
    console.log('[Smart Loader] Cleaning up...')
    
    if (window.performanceCore) {
      window.performanceCore.cleanup()
    }
    
    // Clear module references
    this.loadedModules.clear()
  }
}

// Initialize Smart Loader
document.addEventListener('DOMContentLoaded', () => {
  window.smartLoader = new SmartLoader()
})

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.smartLoader) {
    window.smartLoader.cleanup()
  }
})