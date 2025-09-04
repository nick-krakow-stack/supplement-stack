// Supplement Stack - Frontend JavaScript
// Handles user interactions, API calls, and dynamic content

class SupplementApp {
  constructor() {
    this.token = localStorage.getItem('auth_token')
    this.currentUser = null
    
    // Debug token loading
    alert(`🔍 DEBUG: Token beim Laden - ${this.token ? 'GEFUNDEN' : 'NICHT GEFUNDEN'} - Länge: ${this.token?.length || 0}`)
    
    this.init()
  }

  init() {
    this.setupAxiosDefaults()
    this.setupEventListeners()
    this.initWishlist()  // Wunschliste initialisieren
    this.checkAuthStatus()
  }

  setupAxiosDefaults() {
    // Set default headers for API requests
    if (this.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
    }
    
    // Add response interceptor for token expiration
    axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          this.logout()
        }
        return Promise.reject(error)
      }
    )
  }

  async checkAuthStatus() {
    const currentPath = window.location.pathname
    
    // Allow access to public pages without token
    if (currentPath === '/' || currentPath === '/auth' || currentPath === '/demo') {
      this.updateNavigation(false, false) // Not logged in
      return
    }
    
    if (!this.token) {
      this.updateNavigation(false, false) // Not logged in
      this.redirectToLogin()
      return
    }

    try {
      // Verify token is still valid and get user info
      const response = await axios.get('/api/protected/profile')
      if (response.data && response.data.success) {
        this.currentUser = response.data.data
        // Check if user is admin (you can adjust this logic based on your user model)
        const isAdmin = this.currentUser.email === 'admin@example.com' || this.currentUser.is_admin
        this.updateNavigation(true, isAdmin)
        this.loadPageContent()
      }
    } catch (error) {
      if (error.response?.status === 401) {
        this.logout()
      } else {
        // Fallback: assume logged in but not admin if profile endpoint doesn't exist
        this.updateNavigation(true, false)
        this.loadPageContent()
      }
    }
  }

  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form')
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e))
    }

    // Register form
    const registerForm = document.getElementById('register-form')
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleRegister(e))
    }

    // Toggle between login and register
    const showRegister = document.getElementById('show-register')
    const showLogin = document.getElementById('show-login')
    
    if (showRegister) {
      showRegister.addEventListener('click', (e) => {
        e.preventDefault()
        document.getElementById('login-form').classList.add('hidden')
        document.getElementById('register-form').classList.remove('hidden')
      })
    }

    if (showLogin) {
      showLogin.addEventListener('click', (e) => {
        e.preventDefault()
        document.getElementById('register-form').classList.add('hidden')
        document.getElementById('login-form').classList.remove('hidden')
      })
    }

    // Forgot password button
    const forgotPasswordBtn = document.getElementById('forgot-password-btn')
    if (forgotPasswordBtn) {
      forgotPasswordBtn.addEventListener('click', (e) => {
        e.preventDefault()
        this.showForgotPasswordModal()
      })
    }

    // Logout button - both ID-based and onclick handlers
    const logoutBtn = document.getElementById('logout-btn')
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout())
    }
    
    // Make logout function globally available for onclick handlers
    window.logout = () => this.logout()

    // Demo link
    const demoLink = document.getElementById('demo-link')
    if (demoLink) {
      demoLink.addEventListener('click', (e) => {
        e.preventDefault()
        this.openDemo()
      })
    }

    // Page-specific event listeners
    this.setupPageSpecificEvents()
  }

  setupPageSpecificEvents() {
    const currentPath = window.location.pathname

    switch (currentPath) {
      case '/dashboard':
        this.setupDashboardEvents()
        break
      case '/products':
        this.setupProductsEvents()
        break
      case '/stacks':
        this.setupStacksEvents()
        break
      case '/admin':
        this.setupAdminEvents()
        break
    }
  }

  async handleLogin(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    this.showLoading('Anmeldung läuft...')
    
    try {
      const response = await axios.post('/api/auth/login', {
        email: formData.get('email'),
        password: formData.get('password')
      })

      if (response.data.token) {
        this.token = response.data.token
        localStorage.setItem('auth_token', this.token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        
        this.currentUser = response.data.user
        
        // Debug: Verify token is stored
        const storedToken = localStorage.getItem('auth_token')
        alert(`🔍 DEBUG: Token gespeichert? ${storedToken ? 'JA' : 'NEIN'} - Länge: ${storedToken?.length || 0}`)
        
        // Small delay to ensure token is stored before redirect
        setTimeout(() => {
          this.redirectToDashboard()
        }, 100)
      }
    } catch (error) {
      const errorData = error.response?.data
      if (errorData?.requiresVerification) {
        // Show email verification required message
        this.showEmailVerificationRequired(errorData.email)
      } else {
        this.showError(errorData?.error || 'Anmeldung fehlgeschlagen')
      }
    } finally {
      this.hideLoading()
    }
  }

  async handleRegister(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    this.showLoading('Registrierung läuft...')
    
    try {
      const response = await axios.post('/api/auth/register', {
        email: formData.get('email'),
        password: formData.get('password'),
        age: formData.get('age') ? parseInt(formData.get('age')) : null,
        weight: formData.get('weight') ? parseFloat(formData.get('weight')) : null,
        diet_type: formData.get('diet_type')
      })

      if (response.data.requiresVerification) {
        // New 2FA flow - show email verification message
        this.showEmailVerificationSuccess(response.data.email, response.data.message)
      } else if (response.data.token) {
        // Legacy flow (shouldn't happen with new system)
        this.token = response.data.token
        localStorage.setItem('auth_token', this.token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        
        this.currentUser = response.data.user
        this.showSuccess('Registrierung erfolgreich!')
        this.redirectToDashboard()
      }
    } catch (error) {
      this.showError(error.response?.data?.error || 'Registrierung fehlgeschlagen')
    } finally {
      this.hideLoading()
    }
  }

  logout() {
    this.token = null
    this.currentUser = null
    localStorage.removeItem('auth_token')
    delete axios.defaults.headers.common['Authorization']
    
    // Smart redirect after logout
    this.handleLogoutRedirect()
  }

  handleLogoutRedirect() {
    const currentPath = window.location.pathname
    
    // If user was in admin/dashboard/protected areas, go to home
    const protectedPaths = ['/dashboard', '/products', '/stacks', '/admin']
    const isInProtectedArea = protectedPaths.some(path => currentPath.startsWith(path))
    
    if (isInProtectedArea) {
      window.location.href = '/'
    } else {
      // If already on public page, just reload to update UI
      window.location.reload()
    }
  }

  redirectToLogin() {
    const currentPath = window.location.pathname
    const publicPaths = ['/', '/auth', '/demo']
    
    if (!publicPaths.includes(currentPath)) {
      window.location.href = '/auth'
    }
  }

  redirectToDashboard() {
    window.location.href = '/dashboard'
  }

  openDemo() {
    const demoUrl = window.location.origin + '/demo'
    const demoWindow = window.open(demoUrl, 'demo', 'width=1200,height=800,scrollbars=yes,resizable=yes')
    
    if (demoWindow) {
      demoWindow.focus()
    } else {
      this.showError('Pop-up blockiert. Bitte erlauben Sie Pop-ups für diese Seite.')
    }
  }

  // Dashboard functionality
  setupDashboardEvents() {
    this.loadDashboardData()
  }

  async loadDashboardData() {
    try {
      this.showLoading('Lade Dashboard...')
      alert('🔄 DEBUG: Starting dashboard load...')
      
      // Check authentication first
      const currentToken = this.token || localStorage.getItem('auth_token')
      if (!currentToken) {
        alert(`❌ DEBUG: Benutzer nicht angemeldet - Token fehlt\nthis.token: ${this.token}\nlocalStorage: ${localStorage.getItem('auth_token')}`)
        this.showError('Benutzer nicht angemeldet')
        return
      }
      
      // Update token if needed
      if (!this.token && currentToken) {
        this.token = currentToken
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        alert('🔄 DEBUG: Token aus localStorage wiederhergestellt')
      }
      
      alert(`✅ DEBUG: Token vorhanden - Länge: ${currentToken.length}`)
      
      // Make API calls with detailed error handling
      let productsResponse, stacksResponse, wishlistResponse
      
      try {
        alert('🔄 DEBUG: Rufe API-Endpoints auf...')
        const responses = await Promise.all([
          axios.get('/api/protected/products').catch(e => ({ error: 'products', details: e })),
          axios.get('/api/protected/stacks').catch(e => ({ error: 'stacks', details: e })),
          axios.get('/api/protected/wishlist').catch(e => ({ error: 'wishlist', details: e }))
        ])
        
        productsResponse = responses[0]
        stacksResponse = responses[1]
        wishlistResponse = responses[2]
        
        // Check for API errors
        if (productsResponse.error) {
          alert(`❌ DEBUG: Products API Fehler - ${productsResponse.details.response?.status} ${productsResponse.details.response?.statusText}`)
          throw new Error(`Products API failed: ${productsResponse.details.message}`)
        }
        if (stacksResponse.error) {
          alert(`❌ DEBUG: Stacks API Fehler - ${stacksResponse.details.response?.status} ${stacksResponse.details.response?.statusText}`)
          throw new Error(`Stacks API failed: ${stacksResponse.details.message}`)
        }
        if (wishlistResponse.error) {
          alert(`❌ DEBUG: Wishlist API Fehler - ${wishlistResponse.details.response?.status} ${wishlistResponse.details.response?.statusText}`)
          throw new Error(`Wishlist API failed: ${wishlistResponse.details.message}`)
        }
        
        alert('✅ DEBUG: Alle API-Aufrufe erfolgreich')
        
      } catch (apiError) {
        alert(`❌ DEBUG: API-Aufrufe fehlgeschlagen: ${apiError.message}`)
        throw apiError
      }

      // Debug response data
      alert(`🔍 DEBUG: Products Response: ${JSON.stringify(productsResponse.data).substring(0, 100)}...`)
      alert(`🔍 DEBUG: Stacks Response: ${JSON.stringify(stacksResponse.data).substring(0, 100)}...`)
      alert(`🔍 DEBUG: Wishlist Response: ${JSON.stringify(wishlistResponse.data).substring(0, 100)}...`)

      // Find DOM elements
      const productsCount = document.getElementById('products-count')
      const stacksCount = document.getElementById('stacks-count')
      const wishlistCount = document.getElementById('wishlist-count')
      
      if (!productsCount || !stacksCount || !wishlistCount) {
        alert('❌ DEBUG: Dashboard DOM-Elemente nicht gefunden - falsche Seite?')
        throw new Error('Dashboard DOM elements not found')
      }
      alert('✅ DEBUG: Dashboard DOM-Elemente gefunden')
      
      // Process data with type safety
      let products, stacks, wishlist
      
      try {
        // Products processing
        products = Array.isArray(productsResponse.data) ? productsResponse.data : []
        alert(`✅ DEBUG: Products verarbeitet - ${products.length} Einträge`)
        
        // Stacks processing with detailed checking
        if (stacksResponse.data && typeof stacksResponse.data === 'object') {
          if (stacksResponse.data.success && Array.isArray(stacksResponse.data.data)) {
            stacks = stacksResponse.data.data
            alert(`✅ DEBUG: Stacks (Format: {success, data}) verarbeitet - ${stacks.length} Einträge`)
          } else if (Array.isArray(stacksResponse.data)) {
            stacks = stacksResponse.data
            alert(`✅ DEBUG: Stacks (Array Format) verarbeitet - ${stacks.length} Einträge`)
          } else {
            stacks = []
            alert('⚠️ DEBUG: Stacks - unerwartetes Format, verwende leeres Array')
          }
        } else {
          stacks = []
          alert('⚠️ DEBUG: Stacks - keine Daten, verwende leeres Array')
        }
        
        // Wishlist processing
        wishlist = Array.isArray(wishlistResponse.data) ? wishlistResponse.data : []
        alert(`✅ DEBUG: Wishlist verarbeitet - ${wishlist.length} Einträge`)
        
      } catch (processingError) {
        alert(`❌ DEBUG: Datenverarbeitung fehlgeschlagen: ${processingError.message}`)
        throw processingError
      }
      
      // Update counters
      try {
        productsCount.textContent = products.length
        stacksCount.textContent = stacks.length
        wishlistCount.textContent = wishlist.length
        alert('✅ DEBUG: Counter aktualisiert')
      } catch (counterError) {
        alert(`❌ DEBUG: Counter-Update fehlgeschlagen: ${counterError.message}`)
        throw counterError
      }

      // Calculate monthly costs
      try {
        if (!Array.isArray(stacks)) {
          alert(`❌ DEBUG: Stacks ist kein Array für Kostenberechnung: ${typeof stacks}`)
          throw new Error('Stacks ist kein Array für Kostenberechnung')
        }
        
        const monthlyCost = this.calculateMonthlyCosts(stacks)
        const monthlyCostElement = document.getElementById('monthly-cost')
        if (monthlyCostElement) {
          monthlyCostElement.textContent = `€${monthlyCost.toFixed(2)}`
          alert(`✅ DEBUG: Monatliche Kosten berechnet: €${monthlyCost.toFixed(2)}`)
        }
      } catch (costError) {
        alert(`❌ DEBUG: Kostenberechnung fehlgeschlagen: ${costError.message}`)
        throw costError
      }

      // Display recent stacks
      try {
        this.displayRecentStacks(stacks)
        alert('✅ DEBUG: Recent Stacks angezeigt')
      } catch (displayError) {
        alert(`❌ DEBUG: Stack-Anzeige fehlgeschlagen: ${displayError.message}`)
        throw displayError
      }
      
      alert('🎉 DEBUG: Dashboard erfolgreich geladen!')

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      alert(`💥 DEBUG: FINALER FEHLER: ${error.message || error}`)
      this.showError(`Fehler beim Laden der Dashboard-Daten: ${error.message || 'Unbekannter Fehler'}`)
    } finally {
      this.hideLoading()
    }
  }

  calculateMonthlyCosts(stacks) {
    if (!Array.isArray(stacks)) {
      console.error('calculateMonthlyCosts: stacks is not an array:', typeof stacks, stacks)
      alert(`❌ DEBUG: calculateMonthlyCosts - stacks ist kein Array: ${typeof stacks}`)
      return 0
    }
    
    try {
      const total = stacks.reduce((total, stack) => {
        const cost = (stack && typeof stack === 'object') ? (stack.monthly_cost || 0) : 0
        return total + cost
      }, 0)
      console.log('Monthly costs calculated:', total)
      return total
    } catch (error) {
      console.error('Error calculating monthly costs:', error)
      alert(`❌ DEBUG: calculateMonthlyCosts Fehler: ${error.message}`)
      return 0
    }
  }

  displayRecentStacks(stacks) {
    const container = document.getElementById('recent-stacks')
    if (!container) {
      alert('❌ DEBUG: recent-stacks Container nicht gefunden')
      return
    }

    if (!Array.isArray(stacks)) {
      alert(`❌ DEBUG: displayRecentStacks - stacks ist kein Array: ${typeof stacks}`)
      console.error('displayRecentStacks: stacks is not an array:', stacks)
      container.innerHTML = '<p class="text-red-500 text-center py-4">Fehler: Stacks-Daten haben falsches Format</p>'
      return
    }

    if (stacks.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-4">Noch keine Stacks erstellt</p>'
      alert('✅ DEBUG: Leere Stacks-Liste angezeigt')
      return
    }

    try {
      container.innerHTML = stacks.slice(0, 3).map(stack => {
        if (!stack || typeof stack !== 'object') {
          console.warn('Invalid stack object:', stack)
          return '<div class="text-red-500">Ungültiger Stack</div>'
        }
        
        return `
          <div class="border-b border-gray-200 last:border-b-0 pb-4 last:pb-0 mb-4 last:mb-0">
            <h3 class="font-medium text-gray-900">${this.escapeHtml(stack.name || 'Unbenannter Stack')}</h3>
            <p class="text-sm text-gray-500 mt-1">${this.escapeHtml(stack.description || 'Keine Beschreibung')}</p>
            <div class="flex justify-between items-center mt-2">
              <span class="text-xs text-gray-400">${stack.product_count || 0} Produkte</span>
              <a href="/stacks?id=${stack.id}" class="text-blue-600 hover:text-blue-500 text-sm">Bearbeiten</a>
            </div>
          </div>
        `
      }).join('')
      
      alert(`✅ DEBUG: ${stacks.length} Stacks erfolgreich angezeigt`)
      
    } catch (error) {
      alert(`❌ DEBUG: displayRecentStacks Fehler: ${error.message}`)
      console.error('Error displaying recent stacks:', error)
      container.innerHTML = '<p class="text-red-500 text-center py-4">Fehler beim Anzeigen der Stacks</p>'
    }
  }

  // Products functionality
  setupProductsEvents() {
    const addProductBtn = document.getElementById('add-product-btn')
    if (addProductBtn) {
      addProductBtn.addEventListener('click', () => this.showAddProductModal())
    }

    const searchInput = document.getElementById('search-products')
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterProducts())
    }

    this.loadProducts()
  }

  async loadProducts() {
    try {
      this.showLoading('Lade Produkte...')
      const response = await axios.get('/api/protected/products')
      this.products = response.data  // Produkte speichern für Wunschliste
      this.displayProducts(response.data)
      
      // Wunschlisten-Visuals nach dem Laden aktualisieren
      setTimeout(() => this.updateWishlistVisuals(), 500)
    } catch (error) {
      console.error('Error loading products:', error)
      this.showError('Fehler beim Laden der Produkte')
    } finally {
      this.hideLoading()
    }
  }

  displayProducts(products) {
    const container = document.getElementById('products-grid')
    if (!container) return

    if (products.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-pills text-4xl text-gray-300 mb-4"></i>
          <h3 class="text-lg font-medium text-gray-500 mb-2">Noch keine Produkte hinzugefügt</h3>
          <p class="text-gray-400 mb-6">Fügen Sie Ihr erstes Supplement hinzu, um zu beginnen</p>
          <button onclick="app.showAddProductModal()" class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors">
            <i class="fas fa-plus mr-2"></i>Erstes Produkt hinzufügen
          </button>
        </div>
      `
      return
    }

    container.innerHTML = products.map(product => {
      // Kostenberechnung für eine Portion täglich (Standard-Dosierung)
      const costPerServing = product.price_per_package / product.servings_per_package
      const costPerMonth = costPerServing * 30 // 30 Tage bei 1x täglich
      const daysSupply = product.servings_per_package // Bei 1x täglich
      
      // Parse benefits JSON if available
      let benefits = []
      try {
        benefits = product.benefits ? JSON.parse(product.benefits) : []
      } catch (e) {
        benefits = []
      }
      
      return `
      <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        <!-- Produktbild -->
        <div class="h-48 bg-gray-100 overflow-hidden relative">
          ${product.image_url ? `
            <img src="${product.image_url}" alt="${this.escapeHtml(product.name)}" 
                 class="w-full h-full object-cover" onerror="this.style.display='none'">
          ` : `
            <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
              <i class="fas fa-pills text-4xl text-blue-300"></i>
            </div>
          `}
          
          <!-- Kategorie-Badge -->
          ${product.category ? `
            <div class="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
              ${this.escapeHtml(product.category)}
            </div>
          ` : ''}
          
          <!-- Selection Checkbox -->
          <div class="absolute top-2 right-2">
            <input type="checkbox" id="product-${product.id}" 
                   onchange="app.toggleProductSelection(${product.id})" 
                   class="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500">
          </div>
        </div>
        
        <div class="p-4">
          <!-- Header mit Actions -->
          <div class="flex justify-between items-start mb-3">
            <h3 class="text-lg font-semibold text-gray-900 line-clamp-2 flex-1 mr-2">
              ${this.escapeHtml(product.name)}
            </h3>
            <div class="flex space-x-1">
              <button onclick="app.showProductDetails(${product.id})" 
                      class="text-blue-600 hover:text-blue-500 p-1 rounded hover:bg-blue-50" 
                      title="Details anzeigen">
                <i class="fas fa-info-circle"></i>
              </button>
              <button onclick="app.editProduct(${product.id})" 
                      class="text-gray-600 hover:text-gray-500 p-1 rounded hover:bg-gray-50" 
                      title="Bearbeiten">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="app.deleteProduct(${product.id})" 
                      class="text-red-600 hover:text-red-500 p-1 rounded hover:bg-red-50" 
                      title="Löschen">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <!-- Brand und Form -->
          <p class="text-gray-600 text-sm mb-3">${this.escapeHtml(product.brand)} • ${this.escapeHtml(product.form)}</p>
          
          <!-- Beschreibung -->
          ${product.description ? `
            <p class="text-gray-700 text-sm mb-3 line-clamp-2">${this.escapeHtml(product.description)}</p>
          ` : ''}
          
          <!-- Benefits -->
          ${benefits.length > 0 ? `
            <div class="mb-3">
              <div class="text-xs font-medium text-gray-500 mb-2">WOFÜR IST ES GUT:</div>
              <div class="space-y-1">
                ${benefits.slice(0, 2).map(benefit => `
                  <div class="flex items-start text-xs text-gray-600">
                    <i class="fas fa-check text-green-500 mr-2 mt-0.5 flex-shrink-0"></i>
                    <span>${this.escapeHtml(benefit)}</span>
                  </div>
                `).join('')}
                ${benefits.length > 2 ? `
                  <div class="text-xs text-blue-600 cursor-pointer" onclick="app.showProductDetails(${product.id})">
                    +${benefits.length - 2} weitere Vorteile
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          <!-- Nährstoffe -->
          <div class="space-y-1 mb-4 max-h-16 overflow-y-auto">
            ${(product.nutrients || []).map(nutrient => `
              <div class="flex justify-between text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                <span>${this.escapeHtml(nutrient.name)}</span>
                <span class="font-medium">${nutrient.amount} ${nutrient.unit}</span>
              </div>
            `).join('')}
          </div>
          
          <!-- Dosierung -->
          ${product.dosage_recommendation ? `
            <div class="text-xs text-gray-500 mb-3">
              <i class="fas fa-clock mr-1"></i>
              ${this.escapeHtml(product.dosage_recommendation)}
            </div>
          ` : ''}
          
          <!-- Kostenbereich -->
          <div class="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-3 mb-4">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-gray-600">Kaufpreis:</span>
                <div class="font-semibold text-gray-900">€${product.price_per_package.toFixed(2)}</div>
              </div>
              <div>
                <span class="text-gray-600">Pro Monat:</span>
                <div class="font-semibold text-green-600 text-lg">€${costPerMonth.toFixed(2)}</div>
              </div>
            </div>
            <div class="text-xs text-gray-500 mt-2 flex justify-between">
              <span>${product.servings_per_package} Portionen</span>
              <span>Hält ${daysSupply} Tage</span>
            </div>
          </div>
          
          <!-- Aktionen -->
          <div class="flex justify-between items-center">
            <div class="flex space-x-2">
              <button onclick="app.toggleWishlist(${product.id})" 
                      class="text-red-600 hover:text-red-500 p-2 rounded hover:bg-red-50 touch-target" 
                      title="Zur Wunschliste">
                <i class="fas fa-heart"></i>
              </button>
              <button onclick="app.addToStack(${product.id})" 
                      class="text-green-600 hover:text-green-500 p-2 rounded hover:bg-green-50 touch-target" 
                      title="Zu Stack hinzufügen">
                <i class="fas fa-plus-circle"></i>
              </button>
            </div>
            
            <div class="flex space-x-2">
              <button onclick="app.showProductDetails(${product.id})" 
                      class="bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 transition-colors">
                Details
              </button>
              <a href="${product.shop_url}" target="_blank" 
                 class="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
                <i class="fas fa-shopping-cart mr-1"></i>Kaufen
              </a>
            </div>
          </div>
        </div>
      </div>
    `}).join('')
  }

  // Stacks functionality
  setupStacksEvents() {
    const addStackBtn = document.getElementById('add-stack-btn')
    if (addStackBtn) {
      addStackBtn.addEventListener('click', () => this.showAddStackModal())
    }

    this.loadStacks()
  }

  async loadStacks() {
    try {
      this.showLoading('Lade Stacks...')
      const response = await axios.get('/api/protected/stacks')
      this.displayStacks(response.data)
    } catch (error) {
      console.error('Error loading stacks:', error)
      this.showError('Fehler beim Laden der Stacks')
    } finally {
      this.hideLoading()
    }
  }

  displayStacks(stacks) {
    const container = document.getElementById('stacks-grid')
    if (!container) return

    // Show/hide filters based on number of stacks
    const filtersContainer = document.getElementById('stack-filters')
    if (filtersContainer) {
      if (stacks.length > 3) {
        filtersContainer.classList.remove('hidden')
      } else {
        filtersContainer.classList.add('hidden')
      }
    }

    if (stacks.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 sm:py-16">
          <i class="fas fa-layer-group text-4xl text-gray-300 mb-4"></i>
          <h3 class="text-lg font-medium text-gray-500 mb-2">Noch keine Stacks erstellt</h3>
          <p class="text-gray-400 mb-6 px-4">Erstellen Sie Ihren ersten Stack aus Ihren Produkten</p>
          <button onclick="app.showAddStackModal()" class="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors">
            <i class="fas fa-plus mr-2"></i>Ersten Stack erstellen
          </button>
        </div>
      `
      return
    }

    container.innerHTML = stacks.map(stack => `
      <div class="bg-white rounded-lg shadow-md">
        <!-- Mobile-optimierte Stack-Karte -->
        <div class="p-4 sm:p-6">
          <!-- Header mit Aktionen -->
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
            <div class="flex-1 mb-3 sm:mb-0">
              <h3 class="text-lg sm:text-xl font-semibold text-gray-900 mb-1">${this.escapeHtml(stack.name)}</h3>
              <p class="text-gray-600 text-sm sm:text-base">${this.escapeHtml(stack.description || 'Keine Beschreibung')}</p>
            </div>
            
            <!-- Aktionen für Mobile und Desktop -->
            <div class="flex justify-end space-x-2 sm:ml-4">
              <button onclick="app.editStack(${stack.id})" 
                      class="p-2 text-blue-600 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Bearbeiten">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="app.viewStack(${stack.id})" 
                      class="p-2 text-green-600 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                      title="Details anzeigen">
                <i class="fas fa-eye"></i>
              </button>
              <button onclick="app.deleteStack(${stack.id})" 
                      class="p-2 text-red-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Löschen">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <!-- Produkte Preview -->
          <div class="mb-4">
            <div class="text-sm text-gray-500 mb-2">${(stack.products || []).length} Produkt${(stack.products || []).length !== 1 ? 'e' : ''}:</div>
            <div class="space-y-1">
              ${(stack.products || []).slice(0, 2).map(product => `
                <div class="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded">
                  <span class="font-medium">${this.escapeHtml(product.product_name)}</span>
                  <span class="text-gray-600">${product.dosage_per_day}x täglich</span>
                </div>
              `).join('')}
              ${stack.products && stack.products.length > 2 ? `
                <div class="text-sm text-gray-500 px-3 py-1">
                  +${stack.products.length - 2} weitere Produkt${stack.products.length - 2 !== 1 ? 'e' : ''}
                </div>
              ` : ''}
            </div>
          </div>
          
          <!-- Kosten-Footer -->
          <div class="border-t border-gray-200 pt-4">
            <div class="grid grid-cols-2 gap-4 mb-3">
              <div class="text-center sm:text-left">
                <div class="text-xs text-gray-500 mb-1">Kaufpreis gesamt</div>
                <div class="font-semibold text-gray-900">€${(stack.total_purchase_cost || 0).toFixed(2)}</div>
              </div>
              <div class="text-center sm:text-left">
                <div class="text-xs text-gray-500 mb-1">Monatliche Kosten</div>
                <div class="font-semibold text-green-600 text-lg">€${(stack.monthly_cost || 0).toFixed(2)}</div>
              </div>
            </div>
            
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs text-gray-400">
              <div class="mb-2 sm:mb-0">
                ⏱ Hält ca. ${Math.round(stack.avg_days_supply || 0)} Tage
              </div>
              <div class="text-right">
                Erstellt: ${new Date(stack.created_at).toLocaleDateString('de-DE')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('')
  }

  // Modal functions for adding products and stacks
  showAddProductModal() {
    this.showModal('Neues Produkt hinzufügen', this.getAddProductForm(), this.handleAddProduct.bind(this))
  }

  showAddStackModal() {
    this.showModal('Neuen Stack erstellen', this.getAddStackForm(), this.handleAddStack.bind(this))
  }

  getAddProductForm() {
    return `
      <form id="add-product-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="form-label">Produktname *</label>
            <input type="text" name="name" required class="form-input">
          </div>
          <div>
            <label class="form-label">Marke *</label>
            <input type="text" name="brand" required class="form-input">
          </div>
        </div>
        
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="form-label">Darreichungsform *</label>
            <select name="form" required class="form-select">
              <option value="">Auswählen</option>
              <option value="Kapsel">Kapsel</option>
              <option value="Tablette">Tablette</option>
              <option value="Tropfen">Tropfen</option>
              <option value="Pulver">Pulver</option>
              <option value="Öl">Öl</option>
            </select>
          </div>
          <div>
            <label class="form-label">Preis pro Packung (€) *</label>
            <input type="number" name="price" step="0.01" required class="form-input">
          </div>
          <div>
            <label class="form-label">Portionen pro Packung *</label>
            <input type="number" name="servings" required class="form-input">
          </div>
        </div>
        
        <div>
          <label class="form-label">Shop-URL *</label>
          <input type="url" name="shop_url" required class="form-input">
        </div>
        
        <div>
          <label class="form-label">Bild-URL (optional)</label>
          <input type="url" name="image_url" class="form-input">
        </div>
        
        <div id="nutrients-section">
          <label class="form-label">Wirkstoffe</label>
          <div id="nutrients-list"></div>
          <button type="button" onclick="app.addNutrientField()" class="mt-2 text-blue-600 hover:text-blue-500">
            <i class="fas fa-plus mr-1"></i>Wirkstoff hinzufügen
          </button>
        </div>
      </form>
    `
  }

  getAddStackForm() {
    return `
      <form id="add-stack-form" class="space-y-4">
        <div>
          <label class="form-label">Stack-Name *</label>
          <input type="text" name="name" required class="form-input">
        </div>
        
        <div>
          <label class="form-label">Beschreibung</label>
          <textarea name="description" rows="3" class="form-input"></textarea>
        </div>
        
        <div id="stack-products-section">
          <label class="form-label">Produkte auswählen</label>
          <div id="stack-products-list"></div>
          <button type="button" onclick="app.loadProductsForStack()" class="mt-2 text-blue-600 hover:text-blue-500">
            <i class="fas fa-plus mr-1"></i>Produkt hinzufügen
          </button>
        </div>
      </form>
    `
  }

  async handleAddProduct(formData) {
    try {
      this.showLoading('Produkt wird gespeichert...')
      
      const productData = {
        name: formData.get('name'),
        brand: formData.get('brand'),
        form: formData.get('form'),
        price_per_package: parseFloat(formData.get('price')),
        servings_per_package: parseInt(formData.get('servings')),
        shop_url: formData.get('shop_url'),
        image_url: formData.get('image_url') || null,
        nutrients: [] // Will be populated from form
      }

      const response = await axios.post('/api/protected/products', productData)
      this.showSuccess('Produkt erfolgreich hinzugefügt!')
      this.hideModal()
      this.loadProducts()
      
    } catch (error) {
      this.showError(error.response?.data?.error || 'Fehler beim Speichern des Produkts')
    } finally {
      this.hideLoading()
    }
  }

  async handleAddStack(formData) {
    try {
      this.showLoading('Stack wird erstellt...')
      
      const stackData = {
        name: formData.get('name'),
        description: formData.get('description') || null,
        products: [] // Will be populated from selected products
      }

      const response = await axios.post('/api/protected/stacks', stackData)
      this.showSuccess('Stack erfolgreich erstellt!')
      this.hideModal()
      this.loadStacks()
      
    } catch (error) {
      this.showError(error.response?.data?.error || 'Fehler beim Erstellen des Stacks')
    } finally {
      this.hideLoading()
    }
  }

  // Admin functionality
  setupAdminEvents() {
    const adminTabs = document.querySelectorAll('.admin-tab')
    adminTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        adminTabs.forEach(t => t.classList.remove('active', 'border-blue-500', 'text-blue-600'))
        adminTabs.forEach(t => t.classList.add('border-transparent', 'text-gray-500'))
        
        e.target.classList.add('active', 'border-blue-500', 'text-blue-600')
        e.target.classList.remove('border-transparent', 'text-gray-500')
        
        this.loadAdminTab(e.target.dataset.tab)
      })
    })

    this.loadAdminTab('nutrients')
  }

  async loadAdminTab(tabName) {
    const content = document.getElementById('admin-content')
    if (!content) return

    content.innerHTML = '<div class="text-center py-4 text-gray-500">Lade Daten...</div>'

    try {
      switch (tabName) {
        case 'nutrients':
          await this.loadNutrientsAdmin()
          break
        case 'duplicates':
          await this.loadDuplicatesAdmin()
          break
        case 'affiliates':
          await this.loadAffiliatesAdmin()
          break
        case 'statistics':
          await this.loadStatisticsAdmin()
          break
      }
    } catch (error) {
      console.error(`Error loading admin tab ${tabName}:`, error)
      content.innerHTML = '<div class="text-center py-4 text-red-500">Fehler beim Laden der Daten</div>'
    }
  }

  async loadNutrientsAdmin() {
    const response = await axios.get('/api/protected/admin/nutrients')
    const nutrients = response.data
    
    const content = document.getElementById('admin-content')
    content.innerHTML = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold">Nährstoffe verwalten</h3>
          <button onclick="app.showAddNutrientModal()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            <i class="fas fa-plus mr-2"></i>Nährstoff hinzufügen
          </button>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Einheit</th>
                <th>DGE Empfehlung</th>
                <th>Studien Empfehlung</th>
                <th>Warnschwelle</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              ${nutrients.map(nutrient => `
                <tr>
                  <td class="font-medium">${this.escapeHtml(nutrient.name)}</td>
                  <td>${this.escapeHtml(nutrient.standard_unit)}</td>
                  <td>${nutrient.dge_recommended || '-'}</td>
                  <td>${nutrient.study_recommended || '-'}</td>
                  <td>${nutrient.warning_threshold || '-'}</td>
                  <td>
                    <button onclick="app.editNutrient(${nutrient.id})" class="text-blue-600 hover:text-blue-500 mr-2">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="app.deleteNutrient(${nutrient.id})" class="text-red-600 hover:text-red-500">
                      <i class="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  // Utility functions
  showModal(title, content, submitHandler, showButtons = true) {
    const modalHtml = `
      <div class="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" id="modal-overlay">
        <div class="modal-container bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div class="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
            <h3 class="text-lg font-semibold text-gray-900">${title}</h3>
            <button onclick="app.hideModal()" class="text-gray-400 hover:text-gray-600 p-1">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="modal-content p-4">
            ${content}
          </div>
          ${showButtons ? `
          <div class="sticky bottom-0 bg-white border-t p-4 flex justify-end space-x-3">
            <button onclick="app.hideModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">
              Abbrechen
            </button>
            <button onclick="app.submitModal()" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
              Speichern
            </button>
          </div>
          ` : ''}
        </div>
      </div>
    `
    
    document.body.insertAdjacentHTML('beforeend', modalHtml)
    this.currentModalSubmitHandler = submitHandler
  }

  hideModal() {
    const modal = document.getElementById('modal-overlay')
    if (modal) {
      modal.remove()
    }
    this.currentModalSubmitHandler = null
  }

  submitModal() {
    if (this.currentModalSubmitHandler) {
      const form = document.querySelector('#modal-overlay form')
      if (form) {
        const formData = new FormData(form)
        this.currentModalSubmitHandler(formData)
      }
    }
  }

  showLoading(message = 'Lädt...') {
    // Simple loading implementation
    console.log('Loading:', message)
  }

  hideLoading() {
    console.log('Loading finished')
  }

  showError(message) {
    alert(`Fehler: ${message}`)
  }

  showSuccess(message) {
    alert(`Erfolg: ${message}`)
  }

  showInfo(message) {
    alert(`Info: ${message}`)
  }

  // New email verification success modal
  showEmailVerificationSuccess(email, message) {
    const modalHtml = `
      <div class="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div class="mb-6">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">🚀 Willkommen!</h2>
          <p class="text-gray-600 mb-4">
            ${message}
          </p>
        </div>
        
        <div class="space-y-4">
          <div class="bg-gradient-to-r from-blue-50 to-emerald-50 p-4 rounded-lg border border-blue-200">
            <div class="flex items-center space-x-2 text-blue-700 font-medium mb-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>2-Faktor-Authentifizierung</span>
            </div>
            <p class="text-sm text-gray-600">
              Wir haben eine Bestätigungs-E-Mail an <strong>${email}</strong> gesendet.<br>
              Bitte öffne die E-Mail und klicke auf den Bestätigungslink.
            </p>
          </div>
          
          <div class="flex flex-col space-y-2">
            <button 
              onclick="window.appInstance.resendVerificationEmail('${email}')" 
              class="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-gray-600 hover:to-gray-700 transition-all">
              📧 E-Mail erneut senden
            </button>
            
            <button 
              onclick="window.appInstance.hideEmailVerificationModal()" 
              class="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all">
              OK, verstanden
            </button>
          </div>
          
          <p class="text-xs text-gray-500 mt-4">
            ⚡ Nach der Bestätigung wirst du automatisch angemeldet!
          </p>
        </div>
      </div>
    `
    
    // Create modal backdrop
    const modalBackdrop = document.createElement('div')
    modalBackdrop.id = 'email-verification-modal'
    modalBackdrop.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
    modalBackdrop.innerHTML = modalHtml
    
    document.body.appendChild(modalBackdrop)
    
    // Close on backdrop click
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        this.hideEmailVerificationModal()
      }
    })
  }

  hideEmailVerificationModal() {
    const modal = document.getElementById('email-verification-modal')
    if (modal) {
      modal.remove()
    }
  }

  async resendVerificationEmail(email) {
    try {
      this.showLoading()
      
      const response = await axios.post('/api/auth/resend-verification', {
        email: email
      })
      
      this.showSuccess(response.data.message)
      
    } catch (error) {
      this.showError(error.response?.data?.error || 'Fehler beim Senden der E-Mail')
    } finally {
      this.hideLoading()
    }
  }

  showEmailVerificationRequired(email) {
    const message = `Deine E-Mail-Adresse ist noch nicht bestätigt. Bitte überprüfe dein Postfach und klicke auf den Bestätigungslink.`
    this.showEmailVerificationSuccess(email, message)
  }

  // Password reset functionality
  async forgotPassword(email) {
    try {
      this.showLoading('Passwort-Reset wird gesendet...')
      
      const response = await axios.post('/api/auth/forgot-password', {
        email: email
      })
      
      this.showSuccess(response.data.message)
      
    } catch (error) {
      this.showError(error.response?.data?.error || 'Fehler beim Senden der Passwort-Zurücksetzung')
    } finally {
      this.hideLoading()
    }
  }

  async resetPassword(token, newPassword) {
    try {
      this.showLoading('Passwort wird zurückgesetzt...')
      
      const response = await axios.post('/api/auth/reset-password', {
        token: token,
        password: newPassword
      })
      
      this.showSuccess(response.data.message + ' Du kannst dich jetzt mit dem neuen Passwort anmelden.')
      
      // Redirect to login after successful reset
      setTimeout(() => {
        window.location.href = '/auth'
      }, 2000)
      
    } catch (error) {
      this.showError(error.response?.data?.error || 'Fehler beim Zurücksetzen des Passworts')
    } finally {
      this.hideLoading()
    }
  }

  showForgotPasswordModal() {
    const modalHtml = `
      <div class="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div class="mb-6 text-center">
          <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.414-6.414A6 6 0 0119 9z"></path>
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">🔑 Passwort vergessen?</h2>
          <p class="text-gray-600 mb-6">
            Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen.
          </p>
        </div>
        
        <form id="forgot-password-form" class="space-y-4">
          <div>
            <label class="form-label">E-Mail-Adresse</label>
            <input type="email" name="email" required class="form-input" placeholder="deine@email.de">
          </div>
          
          <div class="flex flex-col space-y-2">
            <button 
              type="submit"
              class="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 transition-all">
              🔑 Reset-Link senden
            </button>
            
            <button 
              type="button"
              onclick="window.appInstance.hideForgotPasswordModal()" 
              class="bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all">
              Abbrechen
            </button>
          </div>
          
          <p class="text-xs text-gray-500 mt-4 text-center">
            🛡️ Der Link ist 1 Stunde gültig und kann nur einmal verwendet werden.
          </p>
        </form>
      </div>
    `
    
    // Create modal backdrop
    const modalBackdrop = document.createElement('div')
    modalBackdrop.id = 'forgot-password-modal'
    modalBackdrop.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
    modalBackdrop.innerHTML = modalHtml
    
    document.body.appendChild(modalBackdrop)
    
    // Handle form submission
    const form = document.getElementById('forgot-password-form')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const formData = new FormData(e.target)
      await this.forgotPassword(formData.get('email'))
      this.hideForgotPasswordModal()
    })
    
    // Close on backdrop click
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        this.hideForgotPasswordModal()
      }
    })
  }

  hideForgotPasswordModal() {
    const modal = document.getElementById('forgot-password-modal')
    if (modal) {
      modal.remove()
    }
  }

  escapeHtml(text) {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  updateNavigation(isLoggedIn, isAdmin) {
    const navMenu = document.getElementById('nav-menu')
    const navActions = document.getElementById('nav-actions')
    const mobileNavMenu = document.getElementById('mobile-nav-menu')
    const mobileNavActions = document.getElementById('mobile-nav-actions')
    const currentPath = window.location.pathname
    
    if (!navMenu || !navActions) return
    
    if (isLoggedIn) {
      // Desktop authenticated navigation
      navMenu.innerHTML = `
        <a href="/dashboard" class="nav-item px-3 py-2 rounded-md text-sm lg:text-base ${currentPath === '/dashboard' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}">
          <i class="fas fa-tachometer-alt mr-1 lg:mr-2"></i>
          <span class="hidden lg:inline">Dashboard</span>
        </a>
        <a href="/products" class="nav-item px-3 py-2 rounded-md text-sm lg:text-base ${currentPath === '/products' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}">
          <i class="fas fa-pills mr-1 lg:mr-2"></i>
          <span class="hidden lg:inline">Produkte</span>
        </a>
        <a href="/stacks" class="nav-item px-3 py-2 rounded-md text-sm lg:text-base ${currentPath === '/stacks' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}">
          <i class="fas fa-layer-group mr-1 lg:mr-2"></i>
          <span class="hidden lg:inline">Stacks</span>
        </a>
        ${isAdmin ? `
        <a href="/admin" class="nav-item px-3 py-2 rounded-md text-sm lg:text-base ${currentPath === '/admin' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}">
          <i class="fas fa-cog mr-1 lg:mr-2"></i>
          <span class="hidden lg:inline">Admin</span>
        </a>
        ` : ''}
      `
      
      navActions.innerHTML = `
        <button onclick="app.logout()" class="text-gray-700 hover:text-gray-900 px-2 py-1">
          <i class="fas fa-sign-out-alt mr-1"></i>
          <span class="hidden lg:inline">Abmelden</span>
        </button>
      `
      
      // Mobile authenticated navigation
      if (mobileNavMenu && mobileNavActions) {
        mobileNavMenu.innerHTML = `
          <a href="/dashboard" class="block px-4 py-3 text-gray-700 hover:bg-gray-50 ${currentPath === '/dashboard' ? 'bg-blue-50 text-blue-600' : ''}">
            <i class="fas fa-tachometer-alt mr-3"></i>Dashboard
          </a>
          <a href="/products" class="block px-4 py-3 text-gray-700 hover:bg-gray-50 ${currentPath === '/products' ? 'bg-blue-50 text-blue-600' : ''}">
            <i class="fas fa-pills mr-3"></i>Produkte
          </a>
          <a href="/stacks" class="block px-4 py-3 text-gray-700 hover:bg-gray-50 ${currentPath === '/stacks' ? 'bg-blue-50 text-blue-600' : ''}">
            <i class="fas fa-layer-group mr-3"></i>Stacks
          </a>
          ${isAdmin ? `
          <a href="/admin" class="block px-4 py-3 text-gray-700 hover:bg-gray-50 ${currentPath === '/admin' ? 'bg-blue-50 text-blue-600' : ''}">
            <i class="fas fa-cog mr-3"></i>Admin
          </a>
          ` : ''}
        `
        
        mobileNavActions.innerHTML = `
          <button onclick="app.logout()" class="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50">
            <i class="fas fa-sign-out-alt mr-3"></i>Abmelden
          </button>
        `
      }
    } else {
      // Public navigation
      navMenu.innerHTML = `
        <a href="#features" class="text-gray-700 hover:text-blue-600 transition-colors px-3 py-2">Features</a>
        <button onclick="app.openDemo()" class="text-gray-700 hover:text-blue-600 transition-colors px-3 py-2">Demo</button>
      `
      
      navActions.innerHTML = `
        <a href="/auth" class="bg-blue-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base">
          Anmelden
        </a>
      `
      
      // Mobile public navigation
      if (mobileNavMenu && mobileNavActions) {
        mobileNavMenu.innerHTML = `
          <a href="#features" class="block px-4 py-3 text-gray-700 hover:bg-gray-50">Features</a>
          <button onclick="app.openDemo()" class="block w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50">Demo</button>
        `
        
        mobileNavActions.innerHTML = `
          <a href="/auth" class="block bg-blue-600 text-white px-4 py-3 text-center rounded-md hover:bg-blue-700 transition-colors">
            Anmelden
          </a>
        `
      }
    }
    
    // Show navigation
    navMenu.classList.remove('hidden')
    navMenu.classList.add('md:flex', 'space-x-2', 'lg:space-x-4')
    navActions.classList.remove('hidden')
    navActions.classList.add('md:flex')
    
    // Setup mobile menu toggle
    this.setupMobileMenu()
  }
  
  setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn')
    const mobileMenu = document.getElementById('mobile-menu')
    
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.onclick = () => {
        const isHidden = mobileMenu.classList.contains('hidden')
        if (isHidden) {
          mobileMenu.classList.remove('hidden')
          mobileMenuBtn.innerHTML = '<i class="fas fa-times text-xl"></i>'
        } else {
          mobileMenu.classList.add('hidden')
          mobileMenuBtn.innerHTML = '<i class="fas fa-bars text-xl"></i>'
        }
      }
    }
  }

  loadPageContent() {
    const path = window.location.pathname
    
    switch (path) {
      case '/dashboard':
        this.loadDashboardData()
        break
      case '/products':
        this.loadProducts()
        break
      case '/stacks':
        this.loadStacks()
        break
    }
  }

  // Stack-Funktionen
  async editStack(id) {
    try {
      this.showLoading('Lade Stack-Daten...')
      const response = await axios.get(`/api/protected/stacks/${id}`)
      
      if (response.data && response.data.success) {
        const stack = response.data.data
        this.showStackEditModal(stack)
      }
    } catch (error) {
      console.error('Error loading stack:', error)
      this.showError('Fehler beim Laden des Stacks')
    } finally {
      this.hideLoading()
    }
  }

  async deleteStack(id) {
    if (!confirm('Möchten Sie diesen Stack wirklich löschen?')) {
      return
    }

    try {
      this.showLoading('Lösche Stack...')
      const response = await axios.delete(`/api/protected/stacks/${id}`)
      
      if (response.data && response.data.success) {
        this.showSuccess('Stack erfolgreich gelöscht')
        this.loadStacks()
      }
    } catch (error) {
      console.error('Error deleting stack:', error)
      this.showError('Fehler beim Löschen des Stacks')
    } finally {
      this.hideLoading()
    }
  }

  async viewStack(id) {
    try {
      this.showLoading('Lade Stack-Details...')
      const response = await axios.get(`/api/protected/stacks/${id}`)
      
      if (response.data && response.data.success) {
        const stack = response.data.data
        this.showStackDetailsModal(stack)
      }
    } catch (error) {
      console.error('Error loading stack details:', error)
      this.showError('Fehler beim Laden der Stack-Details')
    } finally {
      this.hideLoading()
    }
  }

  showStackEditModal(stack) {
    const modalContent = `
      <form id="edit-stack-form" class="space-y-4">
        <input type="hidden" name="stack_id" value="${stack.id}">
        
        <div>
          <label class="form-label">Stack-Name *</label>
          <input type="text" name="name" value="${this.escapeHtml(stack.name)}" required 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
        </div>
        
        <div>
          <label class="form-label">Beschreibung</label>
          <textarea name="description" rows="3" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">${this.escapeHtml(stack.description || '')}</textarea>
        </div>
        
        <div>
          <label class="form-label">Produkte im Stack</label>
          <div id="stack-products" class="space-y-2 max-h-60 overflow-y-auto">
            ${(stack.products || []).map(product => `
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex-1">
                  <div class="font-medium">${this.escapeHtml(product.name)}</div>
                  <div class="text-sm text-gray-600">${this.escapeHtml(product.brand)} - ${this.escapeHtml(product.form)}</div>
                </div>
                <div class="flex items-center space-x-2">
                  <input type="number" name="dosage_${product.product_id}" value="${product.dosage_per_day}" 
                         min="0.1" step="0.1" class="w-16 px-2 py-1 border border-gray-300 rounded text-sm">
                  <span class="text-sm text-gray-500">x täglich</span>
                  <button type="button" onclick="this.parentElement.parentElement.parentElement.remove()" 
                          class="text-red-600 hover:text-red-500 p-1">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
          <button type="button" onclick="app.showAddProductToStackModal(${stack.id})" 
                  class="mt-2 text-blue-600 hover:text-blue-500 text-sm">
            <i class="fas fa-plus mr-1"></i>Produkt hinzufügen
          </button>
        </div>
      </form>
    `
    
    this.showModal(`Stack bearbeiten: ${stack.name}`, modalContent, this.handleEditStack.bind(this))
  }

  showStackDetailsModal(stack) {
    const modalContent = `
      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">${this.escapeHtml(stack.name)}</h3>
          <p class="text-gray-600">${this.escapeHtml(stack.description || 'Keine Beschreibung')}</p>
        </div>
        
        <div>
          <h4 class="font-medium text-gray-900 mb-3">Produkte (${(stack.products || []).length})</h4>
          <div class="space-y-3 max-h-80 overflow-y-auto">
            ${(stack.products || []).map(product => `
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex-1">
                  <div class="font-medium">${this.escapeHtml(product.name)}</div>
                  <div class="text-sm text-gray-600">${this.escapeHtml(product.brand)} - ${this.escapeHtml(product.form)}</div>
                  <div class="text-xs text-gray-500 mt-1">
                    €${product.price_per_package} • ${product.servings_per_package} Portionen
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-medium">${product.dosage_per_day}x täglich</div>
                  <div class="text-sm text-green-600">€${((product.price_per_package / product.servings_per_package) * product.dosage_per_day * 30).toFixed(2)}/Monat</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="border-t pt-4">
          <div class="grid grid-cols-2 gap-4 text-center">
            <div>
              <div class="text-sm text-gray-500 mb-1">Gesamter Kaufpreis</div>
              <div class="text-lg font-semibold text-gray-900">€${(stack.total_purchase_cost || 0).toFixed(2)}</div>
            </div>
            <div>
              <div class="text-sm text-gray-500 mb-1">Monatliche Kosten</div>
              <div class="text-lg font-semibold text-green-600">€${(stack.monthly_cost || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <button onclick="app.hideModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">
          Schließen
        </button>
        <button onclick="app.editStack(${stack.id}); app.hideModal()" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Bearbeiten
        </button>
      </div>
    `
    
    this.showModal(`Stack-Details: ${stack.name}`, modalContent, null, false)
  }

  async handleEditStack(formData) {
    try {
      this.showLoading('Speichere Änderungen...')
      
      const stackId = formData.get('stack_id')
      const stackData = {
        name: formData.get('name'),
        description: formData.get('description') || null
      }

      const response = await axios.put(`/api/protected/stacks/${stackId}`, stackData)
      
      if (response.data && response.data.success) {
        this.showSuccess('Stack erfolgreich aktualisiert!')
        this.hideModal()
        this.loadStacks()
        
        // Reload dashboard if we're on it
        if (window.location.pathname === '/dashboard') {
          this.loadDashboardData()
        }
      }
    } catch (error) {
      console.error('Error updating stack:', error)
      this.showError(error.response?.data?.error || 'Fehler beim Aktualisieren des Stacks')
    } finally {
      this.hideLoading()
    }
  }

  // Produktfunktionen
  selectedProducts = new Set() // Für Produkt-Auswahl
  
  async showProductDetails(id) {
    try {
      this.showLoading('Lade Produktdetails...')
      const response = await axios.get(`/api/protected/products/${id}`)
      
      if (response.data && response.data.success) {
        const product = response.data.data
        this.displayProductDetailsModal(product)
      }
    } catch (error) {
      console.error('Error loading product details:', error)
      this.showError('Fehler beim Laden der Produktdetails')
    } finally {
      this.hideLoading()
    }
  }
  
  displayProductDetailsModal(product) {
    let benefits = []
    let warnings = []
    
    try {
      benefits = product.benefits ? JSON.parse(product.benefits) : []
      warnings = product.warnings ? product.warnings.split('\n').filter(w => w.trim()) : []
    } catch (e) {
      benefits = []
      warnings = []
    }
    
    const modalContent = `
      <div class="space-y-6">
        <!-- Header mit Bild -->
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="w-full sm:w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
            ${product.image_url ? `
              <img src="${product.image_url}" alt="${this.escapeHtml(product.name)}" 
                   class="w-full h-full object-cover">
            ` : `
              <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                <i class="fas fa-pills text-2xl text-blue-300"></i>
              </div>
            `}
          </div>
          
          <div class="flex-1">
            <h2 class="text-xl font-bold text-gray-900 mb-2">${this.escapeHtml(product.name)}</h2>
            <p class="text-gray-600 mb-2">${this.escapeHtml(product.brand)} • ${this.escapeHtml(product.form)}</p>
            ${product.category ? `
              <span class="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                ${this.escapeHtml(product.category)}
              </span>
            ` : ''}
          </div>
        </div>
        
        <!-- Beschreibung -->
        ${product.description ? `
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Beschreibung</h3>
            <p class="text-gray-700">${this.escapeHtml(product.description)}</p>
          </div>
        ` : ''}
        
        <!-- Wofür ist es gut -->
        ${benefits.length > 0 ? `
          <div>
            <h3 class="font-semibold text-gray-900 mb-3">Wofür ist es gut?</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${benefits.map(benefit => `
                <div class="flex items-start text-sm">
                  <i class="fas fa-check-circle text-green-500 mr-2 mt-0.5 flex-shrink-0"></i>
                  <span class="text-gray-700">${this.escapeHtml(benefit)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Nährstoffe -->
        <div>
          <h3 class="font-semibold text-gray-900 mb-3">Inhaltsstoffe</h3>
          <div class="space-y-2">
            ${(product.nutrients || []).map(nutrient => `
              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <span class="font-medium text-gray-900">${this.escapeHtml(nutrient.name)}</span>
                </div>
                <div class="text-right">
                  <div class="font-semibold text-gray-900">${nutrient.amount} ${nutrient.unit}</div>
                  ${nutrient.dge_recommended ? `
                    <div class="text-xs text-gray-500">DGE: ${nutrient.dge_recommended} ${nutrient.unit}</div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Dosierung -->
        ${product.dosage_recommendation ? `
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Dosierungsempfehlung</h3>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <i class="fas fa-info-circle text-blue-600 mr-2"></i>
              <span class="text-blue-800">${this.escapeHtml(product.dosage_recommendation)}</span>
            </div>
          </div>
        ` : ''}
        
        <!-- Warnhinweise -->
        ${warnings.length > 0 ? `
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Wichtige Hinweise</h3>
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              ${warnings.map(warning => `
                <div class="flex items-start text-sm text-yellow-800 mb-1">
                  <i class="fas fa-exclamation-triangle text-yellow-600 mr-2 mt-0.5 flex-shrink-0"></i>
                  <span>${this.escapeHtml(warning)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Kosten und Verfügbarkeit -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 class="font-semibold text-green-800 mb-2">Preisinformationen</h4>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span class="text-green-700">Kaufpreis:</span>
                <span class="font-semibold">€${product.price_per_package.toFixed(2)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-green-700">Pro Portion:</span>
                <span class="font-semibold">€${(product.price_per_package / product.servings_per_package).toFixed(3)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-green-700">Pro Monat:</span>
                <span class="font-semibold">€${(product.price_per_package / product.servings_per_package * 30).toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 class="font-semibold text-blue-800 mb-2">Packungsinhalt</h4>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span class="text-blue-700">Portionen:</span>
                <span class="font-semibold">${product.servings_per_package}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-blue-700">Haltbarkeit:</span>
                <span class="font-semibold">${product.servings_per_package} Tage*</span>
              </div>
              <div class="text-xs text-blue-600 mt-2">*bei 1x täglicher Einnahme</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Footer mit Aktionen -->
      <div class="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-gray-200">
        <button onclick="app.hideModal()" 
                class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">
          Schließen
        </button>
        <button onclick="app.addToStack(${product.id}); app.hideModal()" 
                class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
          <i class="fas fa-plus mr-2"></i>Zu Stack hinzufügen
        </button>
        <button onclick="app.editProduct(${product.id}); app.hideModal()" 
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          <i class="fas fa-edit mr-2"></i>Bearbeiten
        </button>
        <a href="${product.shop_url}" target="_blank" 
           class="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-center">
          <i class="fas fa-shopping-cart mr-2"></i>Jetzt kaufen
        </a>
      </div>
    `
    
    this.showModal(`${product.name} - Details`, modalContent, null, false)
  }

  toggleProductSelection(id) {
    if (this.selectedProducts.has(id)) {
      this.selectedProducts.delete(id)
    } else {
      this.selectedProducts.add(id)
    }
    this.updateSelectedProductsUI()
  }
  
  updateSelectedProductsUI() {
    const count = this.selectedProducts.size
    // Aktualisiere UI für ausgewählte Produkte
    console.log(`${count} Produkte ausgewählt:`, Array.from(this.selectedProducts))
  }

  async editProduct(id) {
    try {
      this.showLoading('Lade Produktdaten...')
      const response = await axios.get(`/api/protected/products/${id}`)
      
      if (response.data && response.data.success) {
        const product = response.data.data
        this.showProductEditModal(product)
      }
    } catch (error) {
      console.error('Error loading product:', error)
      this.showError('Fehler beim Laden der Produktdaten')
    } finally {
      this.hideLoading()
    }
  }

  showProductEditModal(product) {
    let benefits = []
    try {
      benefits = product.benefits ? JSON.parse(product.benefits) : []
    } catch (e) {
      benefits = []
    }
    
    const modalContent = `
      <form id="edit-product-form" class="space-y-4">
        <input type="hidden" name="product_id" value="${product.id}">
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="form-label">Produktname *</label>
            <input type="text" name="name" value="${this.escapeHtml(product.name)}" required class="form-input">
          </div>
          <div>
            <label class="form-label">Marke *</label>
            <input type="text" name="brand" value="${this.escapeHtml(product.brand)}" required class="form-input">
          </div>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="form-label">Form *</label>
            <select name="form" required class="form-input">
              <option value="">Auswählen</option>
              <option value="Kapsel" ${product.form === 'Kapsel' ? 'selected' : ''}>Kapsel</option>
              <option value="Tablette" ${product.form === 'Tablette' ? 'selected' : ''}>Tablette</option>
              <option value="Tropfen" ${product.form === 'Tropfen' ? 'selected' : ''}>Tropfen</option>
              <option value="Pulver" ${product.form === 'Pulver' ? 'selected' : ''}>Pulver</option>
              <option value="Öl" ${product.form === 'Öl' ? 'selected' : ''}>Öl</option>
            </select>
          </div>
          <div>
            <label class="form-label">Preis (€) *</label>
            <input type="number" name="price" step="0.01" value="${product.price_per_package}" required class="form-input">
          </div>
          <div>
            <label class="form-label">Portionen *</label>
            <input type="number" name="servings" value="${product.servings_per_package}" required class="form-input">
          </div>
        </div>
        
        <div>
          <label class="form-label">Beschreibung</label>
          <textarea name="description" rows="2" class="form-input">${this.escapeHtml(product.description || '')}</textarea>
        </div>
        
        <div>
          <label class="form-label">Kategorie</label>
          <select name="category" class="form-input">
            <option value="">Auswählen</option>
            <option value="Vitamin" ${product.category === 'Vitamin' ? 'selected' : ''}>Vitamin</option>
            <option value="Mineral" ${product.category === 'Mineral' ? 'selected' : ''}>Mineral</option>
            <option value="Fettsäure" ${product.category === 'Fettsäure' ? 'selected' : ''}>Fettsäure</option>
            <option value="Aminosäure" ${product.category === 'Aminosäure' ? 'selected' : ''}>Aminosäure</option>
            <option value="Antioxidans" ${product.category === 'Antioxidans' ? 'selected' : ''}>Antioxidans</option>
          </select>
        </div>
        
        <div>
          <label class="form-label">Shop-URL *</label>
          <input type="url" name="shop_url" value="${product.shop_url}" required class="form-input">
        </div>
        
        <div>
          <label class="form-label">Bild-URL</label>
          <input type="url" name="image_url" value="${product.image_url || ''}" class="form-input">
        </div>
        
        <div>
          <label class="form-label">Dosierungsempfehlung</label>
          <input type="text" name="dosage_recommendation" value="${this.escapeHtml(product.dosage_recommendation || '')}" class="form-input">
        </div>
      </form>
    `
    
    this.showModal(`Produkt bearbeiten: ${product.name}`, modalContent, this.handleEditProduct.bind(this))
  }

  async handleEditProduct(formData) {
    try {
      this.showLoading('Speichere Änderungen...')
      
      const productId = formData.get('product_id')
      const productData = {
        name: formData.get('name'),
        brand: formData.get('brand'),
        form: formData.get('form'),
        price_per_package: parseFloat(formData.get('price')),
        servings_per_package: parseInt(formData.get('servings')),
        shop_url: formData.get('shop_url'),
        image_url: formData.get('image_url') || null,
        description: formData.get('description') || null,
        category: formData.get('category') || null,
        dosage_recommendation: formData.get('dosage_recommendation') || null
      }

      const response = await axios.put(`/api/protected/products/${productId}`, productData)
      
      if (response.data && response.data.success) {
        this.showSuccess('Produkt erfolgreich aktualisiert!')
        this.hideModal()
        this.loadProducts()
      }
    } catch (error) {
      console.error('Error updating product:', error)
      this.showError(error.response?.data?.error || 'Fehler beim Aktualisieren des Produkts')
    } finally {
      this.hideLoading()
    }
  }

  async deleteProduct(id) {
    if (!confirm('Möchten Sie dieses Produkt wirklich löschen?')) {
      return
    }

    try {
      this.showLoading('Lösche Produkt...')
      const response = await axios.delete(`/api/protected/products/${id}`)
      
      if (response.data && response.data.success) {
        this.showSuccess('Produkt erfolgreich gelöscht')
        this.loadProducts()
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      this.showError('Fehler beim Löschen des Produkts')
    } finally {
      this.hideLoading()
    }
  }

  // ============== WUNSCHLISTEN-FUNKTIONALITÄT ==============
  
  initWishlist() {
    // Wunschliste aus localStorage laden
    const saved = localStorage.getItem('supplement_wishlist')
    this.wishlist = saved ? JSON.parse(saved) : []
    this.updateWishlistCounter()
  }
  
  saveWishlist() {
    // Wunschliste in localStorage speichern
    localStorage.setItem('supplement_wishlist', JSON.stringify(this.wishlist))
    this.updateWishlistCounter()
  }
  
  isInWishlist(productId) {
    return this.wishlist.some(item => item.id === productId)
  }
  
  toggleWishlist(productId) {
    console.log('[Wishlist] Toggle for product:', productId)
    
    if (this.isInWishlist(productId)) {
      // Von Wunschliste entfernen
      this.wishlist = this.wishlist.filter(item => item.id !== productId)
      this.showSuccess('❌ Von Wunschliste entfernt')
      
      // Heart-Button visuell aktualisieren
      const heartButton = document.querySelector(`button[onclick="app.toggleWishlist(${productId})"] i`)
      if (heartButton) {
        heartButton.className = 'fas fa-heart'
        heartButton.parentElement.className = heartButton.parentElement.className.replace('text-red-600', 'text-gray-400')
      }
    } else {
      // Zur Wunschliste hinzufügen - hole Produktdaten
      const product = this.findProductById(productId)
      if (product) {
        const wishlistItem = {
          id: product.id,
          name: product.name,
          brand: product.brand || 'Unbekannt',
          price: product.purchase_price || 0,
          monthly_cost: product.monthly_cost || 0,
          form: product.form || 'Kapsel',
          added_date: new Date().toISOString(),
          category: product.category || 'Supplement'
        }
        
        this.wishlist.push(wishlistItem)
        this.showSuccess('❤️ Zur Wunschliste hinzugefügt')
        
        // Heart-Button visuell aktualisieren
        const heartButton = document.querySelector(`button[onclick="app.toggleWishlist(${productId})"] i`)
        if (heartButton) {
          heartButton.className = 'fas fa-heart text-red-600'
          heartButton.parentElement.className = heartButton.parentElement.className.replace('text-gray-400', 'text-red-600')
        }
      } else {
        this.showError('Produkt nicht gefunden')
        return
      }
    }
    
    this.saveWishlist()
    this.updateWishlistVisuals()
  }
  
  findProductById(productId) {
    // Suche Produkt in verschiedenen Quellen
    if (this.products && this.products.length > 0) {
      const found = this.products.find(p => p.id === productId)
      if (found) return found
    }
    
    // Fallback: Demo-Produkte
    const demoProducts = [
      { id: 1, name: 'Vitamin D3 4000 IU', brand: 'Sunday Natural', purchase_price: 19.90, monthly_cost: 11.94, form: 'Kapsel', category: 'Vitamine' },
      { id: 2, name: 'B12 Methylcobalamin', brand: 'InnoNature', purchase_price: 24.90, monthly_cost: 12.45, form: 'Tropfen', category: 'Vitamine' },
      { id: 3, name: 'Magnesium Glycinat', brand: 'Biomenta', purchase_price: 16.90, monthly_cost: 16.90, form: 'Kapsel', category: 'Mineralien' }
    ]
    
    return demoProducts.find(p => p.id === productId)
  }
  
  updateWishlistCounter() {
    const counter = document.getElementById('wishlist-count')
    if (counter) {
      counter.textContent = this.wishlist.length
    }
    
    // Demo Counter auch updaten
    const demoCounter = document.getElementById('demo-wishlist-count')
    if (demoCounter) {
      demoCounter.textContent = this.wishlist.length
    }
  }
  
  updateWishlistVisuals() {
    // Alle Heart-Buttons basierend auf Wunschlisten-Status aktualisieren
    document.querySelectorAll('[onclick*="toggleWishlist"]').forEach(button => {
      const onclick = button.getAttribute('onclick')
      const productId = parseInt(onclick.match(/toggleWishlist\((\d+)\)/)?.[1])
      
      if (productId) {
        const heartIcon = button.querySelector('i')
        if (this.isInWishlist(productId)) {
          heartIcon.className = 'fas fa-heart'
          button.className = button.className.replace('text-gray-400', 'text-red-600')
          button.title = 'Von Wunschliste entfernen'
        } else {
          heartIcon.className = 'fas fa-heart'
          button.className = button.className.replace('text-red-600', 'text-gray-400')
          button.title = 'Zur Wunschliste hinzufügen'
        }
      }
    })
  }
  
  showWishlistModal() {
    if (this.wishlist.length === 0) {
      this.showInfo('Ihre Wunschliste ist noch leer. Fügen Sie Produkte über das ❤️ Symbol hinzu!')
      return
    }
    
    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 48rem; max-height: 90vh; overflow-y: auto;">
        <div class="p-6">
          <!-- Header -->
          <div class="flex justify-between items-start mb-6">
            <div>
              <h2 class="text-2xl font-bold text-slate-800 flex items-center">
                <i class="fas fa-heart text-red-500 mr-3"></i>
                Meine Wunschliste
              </h2>
              <p class="text-slate-600 mt-1">${this.wishlist.length} ${this.wishlist.length === 1 ? 'Produkt' : 'Produkte'} gemerkt</p>
            </div>
            <button class="close-modal p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          
          <!-- Wunschlisten-Produkte -->
          <div class="space-y-4">
            ${this.wishlist.map(item => `
              <div class="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-4 border border-slate-200 hover:shadow-md transition-all duration-300">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-4 flex-1">
                    <!-- Produkt Icon -->
                    <div class="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center">
                      <i class="fas fa-pills text-emerald-600"></i>
                    </div>
                    
                    <!-- Produkt Info -->
                    <div class="flex-1 min-w-0">
                      <h3 class="font-bold text-slate-800 text-sm truncate">${item.name}</h3>
                      <p class="text-xs text-slate-600 mb-1">${item.brand} • ${item.form}</p>
                      <div class="flex items-center space-x-3 text-xs">
                        <span class="text-slate-600">€${item.price?.toFixed(2) || '0.00'} einmalig</span>
                        <span class="text-emerald-600 font-semibold">€${item.monthly_cost?.toFixed(2) || '0.00'}/Monat</span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Aktionen -->
                  <div class="flex items-center space-x-2 ml-4">
                    <button onclick="app.addToStackFromWishlist(${item.id})" 
                            class="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105">
                      <i class="fas fa-plus mr-1"></i>Stack
                    </button>
                    <button onclick="app.removeFromWishlist(${item.id})" 
                            class="text-red-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors" 
                            title="Von Wunschliste entfernen">
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <!-- Footer -->
          <div class="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center">
            <div class="text-sm text-slate-600">
              Gespeichert seit: ${new Date(this.wishlist[0]?.added_date || Date.now()).toLocaleDateString('de-DE')}
            </div>
            <div class="flex space-x-3">
              <button onclick="app.clearWishlist()" class="text-orange-600 hover:text-orange-700 px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors text-sm font-semibold">
                <i class="fas fa-trash mr-2"></i>Alle löschen
              </button>
              <button class="close-modal bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-2 rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all duration-300 text-sm font-semibold">
                Schließen
              </button>
            </div>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Modal schließen
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove())
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })
  }
  
  addToStackFromWishlist(productId) {
    // Hier könnte später die echte Stack-Funktionalität implementiert werden
    this.showSuccess(`Produkt wird zu Ihrem Stack hinzugefügt (Demo)`)
  }
  
  removeFromWishlist(productId) {
    this.wishlist = this.wishlist.filter(item => item.id !== productId)
    this.saveWishlist()
    this.updateWishlistVisuals()
    this.showSuccess('Von Wunschliste entfernt')
    
    // Modal neu laden falls offen
    const existingModal = document.querySelector('.modal-overlay')
    if (existingModal) {
      existingModal.remove()
      this.showWishlistModal()
    }
  }
  
  clearWishlist() {
    if (confirm('Möchten Sie wirklich alle Produkte von der Wunschliste entfernen?')) {
      this.wishlist = []
      this.saveWishlist()
      this.updateWishlistVisuals()
      this.showSuccess('Wunschliste geleert')
      
      // Modal schließen
      const existingModal = document.querySelector('.modal-overlay')
      if (existingModal) {
        existingModal.remove()
      }
    }
  }
  
  addToStack(id) { 
    this.showError('Zu Stack hinzufügen - wird implementiert') 
  }
  
  addNutrientField() { 
    this.showError('Nährstoff-Feld hinzufügen - wird implementiert') 
  }
  
  loadProductsForStack() { 
    this.showError('Produkte für Stack laden - wird implementiert') 
  }
  
  showAddProductToStackModal(stackId) { 
    this.showError('Produkt zu Stack hinzufügen - wird implementiert') 
  }
}

// Landing page specific functionality
document.addEventListener('DOMContentLoaded', () => {
  // Initialize app
  window.app = new SupplementApp()
  window.appInstance = window.app // Reference for modal callbacks

  // Handle demo button on landing page
  const demoBtn = document.getElementById('demo-btn')
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      const featuresSection = document.querySelector('#features')
      if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth' })
      }
    })
  }

  // Smooth scrolling for anchor links
  const anchorLinks = document.querySelectorAll('a[href^="#"]')
  anchorLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const targetId = link.getAttribute('href').substring(1)
      const targetElement = document.getElementById(targetId)
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' })
      }
    })
  })

  // Ensure all feature cards are visible
  const featureCards = document.querySelectorAll('#features .text-center.p-6')
  featureCards.forEach(card => {
    card.style.opacity = '1'
    card.style.transform = 'translateY(0)'
    card.style.visibility = 'visible'
  })
})