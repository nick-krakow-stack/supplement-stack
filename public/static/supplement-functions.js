// Supplement Stack - Gemeinsame Funktionen
// Core business logic, API calls, calculations, and utilities
// Für Demo und Production Modus

class SupplementFunctions {
  constructor() {
    this.isDemo = false
    this.isDashboard = false
    this.setupMode()
  }

  setupMode() {
    this.isDashboard = window.location.pathname === '/dashboard'
    this.isDemo = window.location.pathname.includes('/demo') || !this.isDashboard
  }

  // === MODE DETECTION ===
  
  detectDashboardMode() {
    return window.location.pathname === '/dashboard'
  }

  // === API FUNCTIONS ===
  
  async fetchWithCache(url, options = {}) {
    if (window.performanceCore) {
      return await window.performanceCore.fetchWithCache(url, options)
    } else {
      // Fallback ohne Cache
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return await response.json()
    }
  }

  async loadAvailableProducts(cacheTTL = 600000) {
    try {
      console.log('[Functions] Loading available products from database...')
      
      const products = await this.fetchWithCache('/api/available-products', {
        cacheTTL: cacheTTL
      })
      
      console.log('[Functions] Loaded', products?.length || 0, 'available products')
      return products || []
    } catch (error) {
      console.error('[Functions] Error loading available products:', error)
      return this.getMinimalProducts()
    }
  }

  async loadUserStacks() {
    if (!this.isDashboard) {
      throw new Error('User stacks only available in dashboard mode')
    }

    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('No authentication token found')
      }

      console.log('[Functions] Loading user stacks...')
      
      const stacks = await this.fetchWithCache('/api/protected/stacks', {
        headers: { 'Authorization': `Bearer ${authToken}` },
        bypassCache: true
      })
      
      console.log('[Functions] Loaded', stacks?.length || 0, 'user stacks')
      return stacks || []
    } catch (error) {
      console.error('[Functions] Error loading user stacks:', error)
      throw error
    }
  }

  async createUserStack(stackData) {
    if (this.isDemo) {
      // Demo mode: Create locally only
      const newStack = {
        id: 'demo-' + Date.now(),
        name: stackData.name,
        description: stackData.description || '',
        products: [],
        created_at: new Date().toISOString()
      }
      return newStack
    } else {
      // Production mode: Create in database
      try {
        const authToken = localStorage.getItem('auth_token')
        if (!authToken) {
          throw new Error('No authentication token found')
        }

        const response = await fetch('/api/protected/stacks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(stackData)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        return result.stack || result
      } catch (error) {
        console.error('[Functions] Error creating user stack:', error)
        throw error
      }
    }
  }

  async updateUserStack(stackId, stackData) {
    if (this.isDemo) {
      // Demo mode: Update locally only
      return { id: stackId, ...stackData, updated_at: new Date().toISOString() }
    } else {
      // Production mode: Update in database
      try {
        const authToken = localStorage.getItem('auth_token')
        if (!authToken) {
          throw new Error('No authentication token found')
        }

        const response = await fetch(`/api/protected/stacks/${stackId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(stackData)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        console.error('[Functions] Error updating user stack:', error)
        throw error
      }
    }
  }

  async deleteUserStack(stackId) {
    if (this.isDemo) {
      // Demo mode: Delete locally only (handled by calling component)
      return { success: true }
    } else {
      // Production mode: Delete from database
      try {
        const authToken = localStorage.getItem('auth_token')
        if (!authToken) {
          throw new Error('No authentication token found')
        }

        const response = await fetch(`/api/protected/stacks/${stackId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        console.error('[Functions] Error deleting user stack:', error)
        throw error
      }
    }
  }

  // === DATA MANAGEMENT ===
  
  loadDemoStacksFromSession() {
    try {
      const sessionData = sessionStorage.getItem('supplement_demo_stacks')
      return sessionData ? JSON.parse(sessionData) : null
    } catch (error) {
      console.error('[Functions] Error loading demo stacks from session:', error)
      return null
    }
  }

  saveDemoStacksToSession(stacks) {
    try {
      sessionStorage.setItem('supplement_demo_stacks', JSON.stringify(stacks))
      console.log('[Functions] Saved', stacks.length, 'demo stacks to session')
    } catch (error) {
      console.error('[Functions] Error saving demo stacks to session:', error)
    }
  }

  createDemoStacksFromDB(availableProducts) {
    // Erstelle Demo-Stacks basierend auf echten Produkten aus der DB
    if (!availableProducts || availableProducts.length === 0) {
      return this.getDefaultStacks() // Fallback
    }

    // Filtere Produkte nach Kategorien für Demo-Stacks
    const vitamins = availableProducts.filter(p => 
      p.category === 'Vitamine' || p.name.toLowerCase().includes('vitamin')
    ).slice(0, 3)
    
    const minerals = availableProducts.filter(p => 
      p.category === 'Mineralstoffe' || p.name.toLowerCase().includes('magnesium') || p.name.toLowerCase().includes('zink')
    ).slice(0, 2)
    
    const others = availableProducts.filter(p => 
      p.category === 'Fettsäuren' || p.name.toLowerCase().includes('omega') || p.name.toLowerCase().includes('kreatin')
    ).slice(0, 2)

    return [
      {
        id: 'demo-basis',
        name: 'Basis Gesundheit',
        description: 'Grundlegende Nährstoffe für den täglichen Bedarf (aus DB)',
        products: vitamins.length > 0 ? vitamins : this.getDefaultStacks()[0].products
      },
      {
        id: 'demo-advanced', 
        name: 'Erweiterte Versorgung',
        description: 'Optimierte Mineralstoff- und Omega-3-Versorgung (aus DB)',
        products: [...minerals, ...others].length > 0 ? [...minerals, ...others] : this.getDefaultStacks()[1].products
      }
    ]
  }

  getDefaultStacks() {
    return [
      {
        id: 'demo-basis',
        name: 'Basis Gesundheit',
        description: 'Grundlegende Nährstoffe für den täglichen Bedarf',
        products: [
          { 
            id: 1, 
            name: 'Vitamin D3 4000 IU', 
            brand: 'Sunday Natural', 
            form: 'Kapsel',
            monthly_cost: 11.94,
            purchase_price: 19.90,
            quantity: 50,
            dosage_per_day: 1,
            recommended: true,
            product_image: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&h=400&fit=crop&crop=center'
          },
          { 
            id: 2, 
            name: 'B12 Methylcobalamin', 
            brand: 'InnoNature', 
            form: 'Tropfen',
            monthly_cost: 12.45,
            purchase_price: 24.90,
            quantity: 60,
            dosage_per_day: 1,
            recommended: false,
            product_image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=400&fit=crop&crop=center'
          },
          { 
            id: 3, 
            name: 'Vitamin C 1000mg', 
            brand: 'Pure Encapsulations', 
            form: 'Kapsel',
            monthly_cost: 18.90,
            purchase_price: 32.90,
            quantity: 60,
            dosage_per_day: 1,
            recommended: false,
            product_image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop&crop=center'
          }
        ]
      },
      {
        id: 'demo-sport',
        name: 'Sport & Energie', 
        description: 'Optimiert für aktive Menschen und Sportler',
        products: [
          { 
            id: 4, 
            name: 'Magnesiumcitrat 400mg', 
            brand: 'Qidosha', 
            form: 'Kapsel',
            monthly_cost: 15.50,
            purchase_price: 22.90,
            quantity: 30,
            dosage_per_day: 2,
            recommended: true,
            product_image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop&crop=center'
          },
          { 
            id: 5, 
            name: 'Kreatin Monohydrat', 
            brand: 'Olimp', 
            form: 'Kapsel',
            monthly_cost: 19.90,
            purchase_price: 29.90,
            quantity: 120,
            dosage_per_day: 4,
            recommended: false,
            product_image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop&crop=center'
          },
          { 
            id: 6, 
            name: 'Omega-3 EPA/DHA', 
            brand: 'Norsan', 
            form: 'Kapsel',
            monthly_cost: 24.90,
            purchase_price: 39.90,
            quantity: 60,
            dosage_per_day: 2,
            recommended: true,
            product_image: 'https://images.unsplash.com/photo-1559662780-33af019fd570?w=400&h=400&fit=crop&crop=center'
          }
        ]
      }
    ]
  }

  getMinimalProducts() {
    return [
      { id: 1, name: 'Vitamin D3 4000 IU', brand: 'Sunday Natural', category: 'Vitamine', monthly_cost: 11.94 },
      { id: 2, name: 'B12 Methylcobalamin', brand: 'InnoNature', category: 'Vitamine', monthly_cost: 12.45 },
      { id: 3, name: 'Vitamin C 1000mg', brand: 'Pure Encapsulations', category: 'Vitamine', monthly_cost: 18.90 },
      { id: 4, name: 'Magnesiumcitrat 400mg', brand: 'Qidosha', category: 'Mineralstoffe', monthly_cost: 15.50 },
      { id: 5, name: 'Kreatin Monohydrat', brand: 'Olimp', category: 'Sport', monthly_cost: 19.90 },
      { id: 6, name: 'Omega-3 EPA/DHA', brand: 'Norsan', category: 'Fettsäuren', monthly_cost: 24.90 }
    ]
  }

  // === CALCULATIONS ===
  
  calculateStackStats(products) {
    if (!products || products.length === 0) {
      return {
        totalProducts: 0,
        monthlyTotal: 0,
        dailyTotal: 0,
        averageProductCost: 0
      }
    }

    const monthlyTotal = products.reduce((sum, product) => {
      return sum + (product.monthly_cost || 11.94)
    }, 0)

    const dailyTotal = monthlyTotal / 30

    return {
      totalProducts: products.length,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      dailyTotal: Math.round(dailyTotal * 100) / 100,
      averageProductCost: Math.round((monthlyTotal / products.length) * 100) / 100
    }
  }

  calculateDosageRecommendations(nutrientName) {
    // Basis-Empfehlungen für häufige Nährstoffe
    const recommendations = {
      'vitamin d3': { dge: 800, study: 2000, unit: 'IE', max: 4000 },
      'vitamin d': { dge: 800, study: 2000, unit: 'IE', max: 4000 },
      'd3': { dge: 800, study: 2000, unit: 'IE', max: 4000 },
      'vitamin b12': { dge: 4, study: 250, unit: 'µg', max: 1000 },
      'b12': { dge: 4, study: 250, unit: 'µg', max: 1000 },
      'vitamin c': { dge: 100, study: 1000, unit: 'mg', max: 2000 },
      'magnesium': { dge: 400, study: 600, unit: 'mg', max: 800 },
      'omega-3': { dge: 250, study: 1000, unit: 'mg', max: 3000 },
      'omega3': { dge: 250, study: 1000, unit: 'mg', max: 3000 }
    }

    const key = nutrientName.toLowerCase().trim()
    return recommendations[key] || { dge: 100, study: 200, unit: 'mg', max: 1000 }
  }

  validateDosage(nutrientName, dosage) {
    const rec = this.calculateDosageRecommendations(nutrientName)
    
    if (dosage <= rec.dge) {
      return { 
        level: 'safe', 
        message: 'Innerhalb DGE-Empfehlung', 
        description: 'Diese Dosierung entspricht der DGE-Empfehlung.',
        color: 'yellow'
      }
    } else if (dosage <= rec.study) {
      return { 
        level: 'optimal', 
        message: 'Optimale Studien-Dosierung', 
        description: 'Diese Dosierung entspricht wissenschaftlichen Studien.',
        color: 'green'
      }
    } else if (dosage <= rec.max) {
      return { 
        level: 'high', 
        message: 'Hohe Dosierung', 
        description: 'Bitte Rücksprache mit Arzt oder Apotheker halten.',
        color: 'orange'
      }
    } else {
      return { 
        level: 'too_high', 
        message: 'Dosierung zu hoch', 
        description: 'Diese Dosierung überschreitet die empfohlene Höchstmenge.',
        color: 'red'
      }
    }
  }

  // === SEARCH FUNCTIONS ===
  
  searchNutrients(searchTerm) {
    const nutrients = [
      { id: 1, name: 'Vitamin D3', unit: 'IE', dge: 800, study: 2000, description: 'Wichtig für Knochen und Immunsystem' },
      { id: 2, name: 'Vitamin B12', unit: 'µg', dge: 4, study: 250, description: 'Essentiell für Nervensystem und Blutbildung' },
      { id: 3, name: 'Vitamin C', unit: 'mg', dge: 100, study: 1000, description: 'Antioxidans und Immununterstützung' },
      { id: 4, name: 'Magnesium', unit: 'mg', dge: 400, study: 600, description: 'Unterstützt Muskeln und Energiestoffwechsel' },
      { id: 5, name: 'Omega-3', unit: 'mg', dge: 250, study: 1000, description: 'Wichtig für Herz und Gehirn' },
      { id: 6, name: 'Zink', unit: 'mg', dge: 10, study: 15, description: 'Immunsystem und Wundheilung' },
      { id: 7, name: 'Eisen', unit: 'mg', dge: 14, study: 18, description: 'Sauerstofftransport und Blutbildung' },
      { id: 8, name: 'Folsäure', unit: 'µg', dge: 400, study: 800, description: 'Wichtig für Zellteilung und DNA-Synthese' }
    ]
    
    const term = searchTerm.toLowerCase().trim()
    
    return nutrients.filter(n => 
      n.name.toLowerCase().includes(term) ||
      term.includes('d3') && n.name.includes('D3') ||
      term.includes('b12') && n.name.includes('B12') ||
      term.includes('omega') && n.name.includes('Omega')
    )
  }

  searchProducts(availableProducts, nutrientName) {
    if (!availableProducts || availableProducts.length === 0) {
      return { recommended: [], others: [] }
    }

    const term = nutrientName.toLowerCase()
    
    // Filter products by nutrient name
    const matchingProducts = availableProducts.filter(product => {
      const productName = product.name.toLowerCase()
      return productName.includes(term) ||
        term.includes('d3') && productName.includes('vitamin d') ||
        term.includes('b12') && productName.includes('b12') ||
        term.includes('vitamin c') && productName.includes('vitamin c') ||
        term.includes('magnesium') && productName.includes('magnesium') ||
        term.includes('omega') && productName.includes('omega')
    })

    // Separate recommended and other products
    const recommended = matchingProducts.filter(p => p.recommended).slice(0, 3)
    const others = matchingProducts.filter(p => !p.recommended).slice(0, 5)

    return { recommended, others }
  }

  // === PERMISSIONS ===
  
  checkPermission(action) {
    if (this.isDemo) {
      // Demo permissions - read-only for most actions
      const allowedActions = [
        'view_stacks',
        'view_products', 
        'create_stack_local',
        'delete_stack_local',
        'add_product_local',
        'delete_product_local'
      ]
      return allowedActions.includes(action)
    } else {
      // Production permissions - full access
      return true
    }
  }

  requireFullVersion(feature) {
    if (this.isDemo) {
      window.supplementUI?.showQuickNotification(`${feature} ist nur in der Vollversion verfügbar`, 'info')
      // Optional: Redirect to auth/register
      setTimeout(() => {
        if (confirm('Zur kostenlosen Registrierung wechseln?')) {
          window.location.href = '/auth'
        }
      }, 2000)
      return false
    }
    return true
  }
}

// Global verfügbar machen
window.SupplementFunctions = SupplementFunctions
window.supplementFunctions = new SupplementFunctions()