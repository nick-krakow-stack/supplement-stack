// Performance Monitor - Überwacht und meldet Performance-Metriken
// Hilft bei der Identifikation von Performance-Problemen

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoad: 0,
      stackRender: [],
      apiCalls: [],
      memoryUsage: []
    }
    
    this.observers = new Set()
    this.startTime = performance.now()
    
    this.init()
  }

  init() {
    // Page Load Performance
    window.addEventListener('load', () => {
      this.metrics.pageLoad = performance.now() - this.startTime
      this.logMetric('Page Load', this.metrics.pageLoad)
    })

    // DOM Content Loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.logMetric('DOM Ready', performance.now() - this.startTime)
      })
    }

    // Memory Usage Tracking (wenn verfügbar)
    if ('memory' in performance) {
      this.trackMemoryUsage()
    }

    // Long Task Detection (wenn verfügbar)
    if ('PerformanceObserver' in window) {
      this.observeLongTasks()
    }

    // API Call Tracking
    this.interceptAxios()
  }

  trackMemoryUsage() {
    const checkMemory = () => {
      if (performance.memory) {
        const usage = {
          timestamp: Date.now(),
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
        }
        
        this.metrics.memoryUsage.push(usage)
        
        // Warnung bei hoher Memory-Nutzung
        if (usage.used > usage.limit * 0.8) {
          console.warn(`⚠️ High memory usage: ${usage.used}MB / ${usage.limit}MB`)
        }
      }
    }

    // Check every 30 seconds
    setInterval(checkMemory, 30000)
    checkMemory() // Initial check
  }

  observeLongTasks() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Long tasks > 50ms
            console.warn(`🐌 Long Task detected: ${Math.round(entry.duration)}ms`, entry)
          }
        }
      })
      
      observer.observe({ entryTypes: ['longtask'] })
      this.observers.add(observer)
    } catch (error) {
      console.log('Long task observation not supported')
    }
  }

  interceptAxios() {
    if (typeof axios === 'undefined') return

    // Request Interceptor
    axios.interceptors.request.use((config) => {
      config.metadata = { startTime: performance.now() }
      return config
    })

    // Response Interceptor
    axios.interceptors.response.use(
      (response) => {
        const duration = performance.now() - response.config.metadata.startTime
        
        this.logApiCall({
          url: response.config.url,
          method: response.config.method?.toUpperCase(),
          duration: Math.round(duration),
          status: response.status,
          success: true
        })

        // Warnung bei langsamen API-Calls
        if (duration > 1000) {
          console.warn(`🐌 Slow API Call: ${response.config.url} took ${Math.round(duration)}ms`)
        }

        return response
      },
      (error) => {
        if (error.config && error.config.metadata) {
          const duration = performance.now() - error.config.metadata.startTime
          
          this.logApiCall({
            url: error.config.url,
            method: error.config.method?.toUpperCase(),
            duration: Math.round(duration),
            status: error.response?.status || 0,
            success: false,
            error: error.message
          })
        }

        return Promise.reject(error)
      }
    )
  }

  logApiCall(apiCall) {
    this.metrics.apiCalls.push({
      ...apiCall,
      timestamp: Date.now()
    })

    console.log(`📡 API ${apiCall.method} ${apiCall.url}: ${apiCall.duration}ms`)
  }

  logStackRender(renderTime, stackId, productCount) {
    const render = {
      timestamp: Date.now(),
      duration: Math.round(renderTime),
      stackId,
      productCount
    }
    
    this.metrics.stackRender.push(render)
    
    console.log(`🎨 Stack Render: ${render.duration}ms (Stack: ${stackId}, Products: ${productCount})`)
    
    // Warnung bei langsamen Renders
    if (renderTime > 100) {
      console.warn(`🐌 Slow Render detected: ${render.duration}ms for ${productCount} products`)
    }
  }

  logMetric(name, value) {
    console.log(`📊 ${name}: ${Math.round(value)}ms`)
  }

  // Wrapper für gemessene Stack-Renders
  measureStackRender(renderFunction, stackId, productCount) {
    const startTime = performance.now()
    
    try {
      const result = renderFunction()
      const duration = performance.now() - startTime
      this.logStackRender(duration, stackId, productCount)
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`❌ Stack Render Error after ${Math.round(duration)}ms:`, error)
      throw error
    }
  }

  // Performance-Report generieren
  generateReport() {
    const report = {
      pageLoad: this.metrics.pageLoad,
      totalApiCalls: this.metrics.apiCalls.length,
      avgApiTime: this.metrics.apiCalls.length > 0 ? 
        Math.round(this.metrics.apiCalls.reduce((sum, call) => sum + call.duration, 0) / this.metrics.apiCalls.length) : 0,
      slowApiCalls: this.metrics.apiCalls.filter(call => call.duration > 1000).length,
      totalRenders: this.metrics.stackRender.length,
      avgRenderTime: this.metrics.stackRender.length > 0 ?
        Math.round(this.metrics.stackRender.reduce((sum, render) => sum + render.duration, 0) / this.metrics.stackRender.length) : 0,
      slowRenders: this.metrics.stackRender.filter(render => render.duration > 100).length,
      currentMemory: this.metrics.memoryUsage.length > 0 ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] : null
    }

    console.group('📊 Performance Report')
    console.log('Page Load:', report.pageLoad + 'ms')
    console.log('API Calls:', report.totalApiCalls, '(Avg:', report.avgApiTime + 'ms)')
    console.log('Slow API Calls:', report.slowApiCalls)
    console.log('Renders:', report.totalRenders, '(Avg:', report.avgRenderTime + 'ms)')
    console.log('Slow Renders:', report.slowRenders)
    if (report.currentMemory) {
      console.log('Memory:', report.currentMemory.used + 'MB /', report.currentMemory.limit + 'MB')
    }
    console.groupEnd()

    return report
  }

  // Cleanup
  cleanup() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect()
      } catch (error) {
        console.error('Error disconnecting observer:', error)
      }
    })
    
    this.observers.clear()
    this.metrics = { pageLoad: 0, stackRender: [], apiCalls: [], memoryUsage: [] }
  }
}

// Global Performance Monitor
if (typeof window !== 'undefined') {
  window.performanceMonitor = new PerformanceMonitor()
  
  // Console command for manual report generation
  window.perfReport = () => window.performanceMonitor.generateReport()
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.performanceMonitor) {
      window.performanceMonitor.cleanup()
    }
  })
}