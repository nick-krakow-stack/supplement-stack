// Performance-Core - Optimierte Basis-Funktionalität für Supplement Stack
// Reduziert Ladezeiten durch intelligentes Caching und Lazy-Loading

class PerformanceCore {
  constructor() {
    this.cache = new Map()
    this.renderQueue = new Set()
    this.isRendering = false
    this.debounceTimers = new Map()
  }

  // Intelligentes Caching System
  setCache(key, data, ttl = 300000) { // 5 Minuten Standard-TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  getCache(key) {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  // Debounced Rendering - verhindert mehrfache Renders
  debounceRender(key, renderFn, delay = 100) {
    // Lösche vorherige Timer
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key))
    }

    // Setze neuen Timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key)
      renderFn()
    }, delay)

    this.debounceTimers.set(key, timer)
  }

  // Batch-Rendering für bessere Performance
  queueRender(renderKey, renderFn) {
    this.renderQueue.add({ key: renderKey, fn: renderFn })
    
    if (!this.isRendering) {
      this.processRenderQueue()
    }
  }

  async processRenderQueue() {
    this.isRendering = true
    
    // Batch processing
    const renders = Array.from(this.renderQueue)
    this.renderQueue.clear()

    for (const render of renders) {
      try {
        await render.fn()
      } catch (error) {
        console.error(`Render error for ${render.key}:`, error)
      }
    }

    this.isRendering = false
  }

  // Optimierte API-Calls mit Caching
  async fetchWithCache(url, options = {}) {
    const cacheKey = `api_${url}_${JSON.stringify(options)}`
    
    // Prüfe Cache zuerst
    const cached = this.getCache(cacheKey)
    if (cached && !options.bypassCache) {
      console.log(`[Performance] Cache hit for ${url}`)
      return cached
    }

    try {
      console.log(`[Performance] Fetching ${url}`)
      const response = await axios(url, options)
      
      // Nur erfolgreiche Responses cachen
      if (response.status >= 200 && response.status < 300) {
        this.setCache(cacheKey, response.data, options.cacheTTL || 300000)
      }
      
      return response.data
    } catch (error) {
      console.error(`[Performance] API Error for ${url}:`, error)
      throw error
    }
  }

  // Lazy Loading Helper
  observeElement(element, callback, options = {}) {
    if (!('IntersectionObserver' in window)) {
      // Fallback für ältere Browser
      callback()
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback()
          observer.unobserve(element)
        }
      })
    }, { threshold: 0.1, ...options })

    observer.observe(element)
  }

  // Memory Management
  cleanup() {
    // Clear cache
    this.cache.clear()
    
    // Clear timers
    this.debounceTimers.forEach(timer => clearTimeout(timer))
    this.debounceTimers.clear()
    
    // Clear render queue
    this.renderQueue.clear()
    
    console.log('[Performance] Cleanup completed')
  }
}

// Global Performance Instance
window.performanceCore = new PerformanceCore()

// Auto-cleanup bei Page-Unload
window.addEventListener('beforeunload', () => {
  if (window.performanceCore) {
    window.performanceCore.cleanup()
  }
})