// Supplement Stack - Frontend Application
class SupplementStack {
  constructor() {
    this.apiBase = '/api'
    this.currentUser = null
    this.currentStack = null
    this.modal = {
      isOpen: false,
      step: 1,
      wirkstoff: null,
      produkt: null,
      stackId: null
    }
    this.isDemoMode = false
    this.demoSessionKey = null
    this.selectedProducts = new Set()

    this.init()
  }

  async init() {
    // Check for existing session
    const token = localStorage.getItem('auth_token')
    if (token) {
      await this.validateToken(token)
    }

    // Check for demo mode
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('demo') === 'true' || window.location.pathname === '/demo') {
      this.isDemoMode = true
      await this.initDemoMode()
    }

    this.renderApp()
    this.setupEventListeners()

    // Auto-cleanup demo sessions (run every hour)
    if (!this.isDemoMode) {
      setInterval(() => this.cleanupDemoSessions(), 3600000)
    }
  }

  async validateToken(token) {
    try {
      const response = await this.apiCall('/auth/validate', 'POST', { token })
      if (response.success) {
        this.currentUser = response.data.user
        await this.loadUserStacks()
      } else {
        localStorage.removeItem('auth_token')
      }
    } catch (error) {
      console.error('Token validation failed:', error)
      localStorage.removeItem('auth_token')
    }
  }

  async initDemoMode() {
    try {
      let sessionKey = localStorage.getItem('demo_session_key')
      const response = await this.apiCall('/demo/session', 'POST', null, sessionKey ? `?key=${sessionKey}` : '')
      
      if (response.success) {
        this.demoSessionKey = response.data.session_key
        localStorage.setItem('demo_session_key', this.demoSessionKey)
        
        if (response.data.stack_id) {
          await this.loadStack(response.data.stack_id)
        }
      }
    } catch (error) {
      console.error('Demo mode init failed:', error)
    }
  }

  async apiCall(endpoint, method = 'GET', data = null, queryParams = '') {
    const url = `${this.apiBase}${endpoint}${queryParams}`
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const token = localStorage.getItem('auth_token')
    if (token) {
      options.headers.Authorization = `Bearer ${token}`
    }

    if (data) {
      options.body = JSON.stringify(data)
    }

    const response = await fetch(url, options)
    return await response.json()
  }

  renderApp() {
    const app = document.getElementById('app')
    
    if (this.isDemoMode) {
      app.innerHTML = this.renderDemoApp()
    } else if (this.currentUser) {
      app.innerHTML = this.renderMainApp()
    } else {
      app.innerHTML = this.renderAuthPage()
    }
  }

  renderDemoApp() {
    return `
      <div class="min-h-screen bg-gray-50">
        <!-- Demo Banner -->
        <div class="demo-banner py-3 px-4">
          <div class="max-w-6xl mx-auto flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <i class="fas fa-flask text-lg"></i>
              <span class="font-medium">Demo-Modus</span>
              <span class="text-blue-100 text-sm">
                Öffentliche Demo – Daten werden regelmäßig zurückgesetzt
              </span>
            </div>
            <div class="flex items-center space-x-4">
              <button onclick="app.resetDemo()" class="text-white hover:text-blue-100 text-sm">
                <i class="fas fa-redo mr-1"></i> Zurücksetzen
              </button>
              <a href="/" class="text-white hover:text-blue-100 text-sm">
                <i class="fas fa-user mr-1"></i> Anmelden
              </a>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="max-w-6xl mx-auto px-4 py-8">
          ${this.renderHeader()}
          ${this.renderWirkstoffSearch()}
          ${this.renderStackContent()}
        </div>

        ${this.renderStackFooter()}
        ${this.renderModal()}
      </div>
    `
  }

  renderMainApp() {
    return `
      <div class="min-h-screen bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
          <div class="max-w-6xl mx-auto px-4">
            <div class="flex justify-between items-center py-4">
              <div class="flex items-center space-x-4">
                <h1 class="text-xl font-bold text-supplement-700">
                  <i class="fas fa-pills mr-2"></i>
                  Supplement Stack
                </h1>
              </div>
              <div class="flex items-center space-x-4">
                <span class="text-sm text-gray-600">
                  <i class="fas fa-user-circle mr-1"></i>
                  ${this.currentUser.name || this.currentUser.email}
                </span>
                <button onclick="app.logout()" class="text-sm text-gray-500 hover:text-red-600">
                  <i class="fas fa-sign-out-alt mr-1"></i> Abmelden
                </button>
              </div>
            </div>
          </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-6xl mx-auto px-4 py-8">
          ${this.renderHeader()}
          ${this.renderWirkstoffSearch()}
          ${this.renderStackContent()}
        </div>

        ${this.renderStackFooter()}
        ${this.renderModal()}
      </div>
    `
  }

  renderAuthPage() {
    return `
      <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
          <div class="text-center">
            <i class="fas fa-pills text-4xl text-supplement-600 mb-4"></i>
            <h1 class="text-3xl font-bold text-gray-900">Supplement Stack</h1>
            <p class="mt-2 text-sm text-gray-600">
              Intelligente Nahrungsergänzung verwalten
            </p>
          </div>
        </div>

        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <!-- Auth Tabs -->
            <div class="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
              <button id="login-tab" onclick="app.switchAuthTab('login')" 
                class="flex-1 py-2 px-4 rounded-md text-sm font-medium text-white bg-supplement-600">
                Anmelden
              </button>
              <button id="register-tab" onclick="app.switchAuthTab('register')" 
                class="flex-1 py-2 px-4 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700">
                Registrieren
              </button>
            </div>

            <!-- Login Form -->
            <form id="login-form" onsubmit="app.handleLogin(event)">
              <div class="space-y-6">
                <div>
                  <label class="form-label">E-Mail-Adresse</label>
                  <input type="email" name="email" required class="form-input">
                </div>
                <div>
                  <label class="form-label">Passwort</label>
                  <input type="password" name="password" required class="form-input">
                </div>
                <button type="submit" class="btn-primary w-full">
                  <span class="login-btn-text">Anmelden</span>
                  <span class="login-btn-spinner hidden spinner"></span>
                </button>
              </div>
            </form>

            <!-- Register Form -->
            <form id="register-form" onsubmit="app.handleRegister(event)" class="hidden">
              <div class="space-y-6">
                <div>
                  <label class="form-label">E-Mail-Adresse</label>
                  <input type="email" name="email" required class="form-input">
                </div>
                <div>
                  <label class="form-label">Passwort (min. 6 Zeichen)</label>
                  <input type="password" name="password" required minlength="6" class="form-input">
                </div>
                <div>
                  <label class="form-label">Name (optional)</label>
                  <input type="text" name="name" class="form-input">
                </div>
                <button type="submit" class="btn-primary w-full">
                  <span class="register-btn-text">Registrieren</span>
                  <span class="register-btn-spinner hidden spinner"></span>
                </button>
              </div>
            </form>

            <!-- Demo Link -->
            <div class="mt-6 text-center">
              <a href="/?demo=true" class="text-sm text-supplement-600 hover:text-supplement-500">
                <i class="fas fa-flask mr-1"></i>
                Demo ausprobieren (ohne Anmeldung)
              </a>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderHeader() {
    if (!this.currentStack) return ''

    return `
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">
              ${this.currentStack.name}
            </h2>
            ${this.currentStack.beschreibung ? `
              <p class="text-gray-600 mt-1">${this.currentStack.beschreibung}</p>
            ` : ''}
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-supplement-600">
              ${this.currentStack.gesamtpreis_monat.toFixed(2)}€
            </div>
            <div class="text-sm text-gray-600">pro Monat</div>
          </div>
        </div>

        ${this.renderInteractionWarnings()}
      </div>
    `
  }

  renderWirkstoffSearch() {
    return `
      <div class="mb-8">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-medium text-gray-900">
              <i class="fas fa-pills mr-2 text-supplement-600"></i>
              Supplement verwalten
            </h3>
            <button 
              onclick="app.openAddSupplementModal()"
              class="inline-flex items-center px-4 py-2 bg-supplement-600 text-white text-sm font-medium rounded-lg hover:bg-supplement-700 focus:outline-none focus:ring-2 focus:ring-supplement-500 focus:ring-offset-2 transition-colors"
            >
              <i class="fas fa-plus mr-2"></i>
              Hinzufügen
            </button>
          </div>

          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="flex">
              <i class="fas fa-info-circle text-blue-500 mt-1 mr-3"></i>
              <div class="text-sm text-gray-600">
                <strong>Tipp:</strong> Klicken Sie auf "Hinzufügen" um neue Supplemente zu Ihrem Stack hinzuzufügen. 
                Suche nach Wirkstoffen wie "Magnesium", "B12" oder "Omega-3" oder nach spezifischen Produkten.
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderStackContent() {
    if (!this.currentStack || !this.currentStack.produkte.length) {
      return `
        <div class="text-center py-12">
          <i class="fas fa-pills text-4xl text-gray-300 mb-4"></i>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Noch keine Produkte im Stack</h3>
          <p class="text-gray-600">
            Suche nach Wirkstoffen und füge Produkte zu deinem Stack hinzu.
          </p>
        </div>
      `
    }

    const kategorien = this.groupProductsByCategory(this.currentStack.produkte)
    
    return `
      <div class="space-y-8">
        ${Object.entries(kategorien).map(([kategorie, produkte]) => `
          <div class="stack-category">
            <h3 class="stack-category-title">
              <i class="fas fa-${this.getCategoryIcon(kategorie)} mr-2"></i>
              ${kategorie} (${produkte.length})
            </h3>
            <div class="product-grid">
              ${produkte.map(item => this.renderProductCard(item)).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  renderProductCard(stackItem) {
    const { stack_produkt: sp, produkt: p } = stackItem
    
    return `
      <div class="supplement-card p-6">
        <!-- Product Header -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900 text-lg">${p.name}</h4>
            ${p.marke ? `<p class="text-sm text-gray-600">${p.marke}</p>` : ''}
          </div>
          <div class="ml-4">
            <input type="checkbox" 
              ${this.selectedProducts.has(p.id) ? 'checked' : ''}
              onchange="app.toggleProductSelection(${p.id})"
              class="w-4 h-4 text-supplement-600 rounded">
          </div>
        </div>

        <!-- Product Image -->
        ${p.bild_url ? `
          <div class="mb-4">
            <img src="${p.bild_url}" alt="${p.name}" 
              class="w-full h-32 object-cover rounded-md bg-gray-100">
          </div>
        ` : ''}

        <!-- Wirkstoffe -->
        <div class="mb-4">
          <div class="text-sm text-gray-600 mb-1">Wirkstoffe:</div>
          <div class="space-y-1">
            ${p.wirkstoffe_info ? p.wirkstoffe_info.split(' | ').map(wirkstoff => `
              <div class="text-sm font-medium text-gray-800">${wirkstoff.trim()}</div>
            `).join('') : ''}
          </div>
        </div>

        <!-- Dosierung & Einnahme -->
        <div class="mb-4 flex items-center justify-between">
          <div>
            <span class="text-sm text-gray-600">Dosierung:</span>
            <span class="font-medium">${sp.dosierung}x täglich</span>
          </div>
          ${sp.einnahmezeit ? `
            <span class="badge-tageszeit">${sp.einnahmezeit}</span>
          ` : ''}
        </div>

        <!-- Preis -->
        <div class="mb-4">
          <div class="price-per-month">${p.preis_pro_monat.toFixed(2)}€/Monat</div>
          <div class="text-sm text-gray-600">
            Einzelpreis: ${p.preis.toFixed(2)}€ (${p.einheit_anzahl} Stück)
          </div>
        </div>

        <!-- Notiz -->
        ${sp.notiz ? `
          <div class="mb-4 p-3 bg-blue-50 rounded-md">
            <i class="fas fa-sticky-note text-blue-600 mr-1"></i>
            <span class="text-sm text-blue-800">${sp.notiz}</span>
          </div>
        ` : ''}

        <!-- Actions -->
        <div class="flex space-x-2">
          <button onclick="app.editStackProduct(${sp.stack_id}, ${sp.produkt_id})" 
            class="btn-secondary text-sm flex-1">
            <i class="fas fa-edit mr-1"></i> Bearbeiten
          </button>
          ${p.shop_link || p.affiliate_link ? `
            <a href="${p.affiliate_link || p.shop_link}" target="_blank" 
              class="btn-primary text-sm flex-1 text-center">
              <i class="fas fa-shopping-cart mr-1"></i> Kaufen
            </a>
          ` : ''}
          <button onclick="app.removeFromStack(${sp.stack_id}, ${sp.produkt_id})" 
            class="btn-danger text-sm">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `
  }

  renderStackFooter() {
    if (!this.currentStack || !this.currentStack.produkte.length) return ''

    const selectedCount = this.selectedProducts.size
    const totalProducts = this.currentStack.produkte.length

    return `
      <div class="stack-footer">
        <div class="max-w-6xl mx-auto flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <label class="flex items-center">
              <input type="checkbox" 
                ${selectedCount === totalProducts ? 'checked' : ''}
                onchange="app.toggleAllProducts()"
                class="mr-2 w-4 h-4 text-supplement-600 rounded">
              <span class="text-sm">
                ${selectedCount > 0 ? `${selectedCount} von ${totalProducts} ausgewählt` : 'Alle auswählen'}
              </span>
            </label>
            
            ${selectedCount > 0 ? `
              <button onclick="app.clearSelection()" class="text-sm text-gray-500 hover:text-red-600">
                Auswahl aufheben
              </button>
            ` : ''}
          </div>

          <div class="flex items-center space-x-6">
            <div class="text-right">
              <div class="text-lg font-bold text-supplement-600">
                ${this.currentStack.gesamtpreis_monat.toFixed(2)}€
              </div>
              <div class="text-xs text-gray-600">Gesamt pro Monat</div>
            </div>
            
            ${selectedCount > 0 ? `
              <button onclick="app.orderSelected()" class="btn-primary">
                <i class="fas fa-shopping-cart mr-2"></i>
                ${selectedCount} Artikel bestellen
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `
  }

  renderModal() {
    if (!this.modal.isOpen) return ''

    return `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="app.closeSupplementModal()">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
          ${this.renderAddSupplementModal()}
        </div>
      </div>
    `
  }

  renderAddSupplementModal() {
    return `
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900">Supplement hinzufügen</h2>
          <button onclick="app.closeSupplementModal()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <!-- Tab Navigation -->
        <div class="flex mb-6">
          <button 
            onclick="app.switchModalMode('produkt')"
            class="px-4 py-2 rounded-l-lg text-sm font-medium border ${this.modal.mode === 'produkt' ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 text-gray-700 border-gray-300'}"
          >
            Produkt suchen
          </button>
          <button 
            onclick="app.switchModalMode('wirkstoff')"
            class="px-4 py-2 rounded-r-lg text-sm font-medium border-t border-r border-b ${this.modal.mode === 'wirkstoff' ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 text-gray-700 border-gray-300'}"
          >
            Wirkstoff suchen
          </button>
        </div>

        <!-- Search Input -->
        <div class="mb-4">
          <input
            type="text"
            id="modal-search"
            placeholder="${this.modal.mode === 'wirkstoff' ? 'Wirkstoff eingeben...' : 'Suchbegriff eingeben...'}"
            value="${this.modal.searchQuery}"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            oninput="app.handleModalSearchInput(this.value)"
          >
        </div>

        ${this.renderModalSearchResults()}
        ${this.renderModalForm()}

        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <button 
            onclick="app.closeSupplementModal()"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Abbrechen
          </button>
          <button 
            onclick="app.addSupplementToStack()"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            ${!this.modal.selectedProdukt ? 'disabled' : ''}
          >
            Supplement hinzufügen
          </button>
        </div>
      </div>
    `
  }

  renderModalSearchResults() {
    if (this.modal.mode === 'wirkstoff' && this.modal.selectedWirkstoff && this.modal.wirkstoffProducts) {
      return `
        <div class="mb-4 p-4 bg-blue-50 rounded-lg">
          <h3 class="font-medium text-blue-900 mb-3">Produkte mit diesem Wirkstoff:</h3>
          <div class="space-y-2">
            ${this.modal.wirkstoffProducts.map(produkt => `
              <div 
                class="flex items-center justify-between p-3 bg-white rounded border cursor-pointer hover:bg-gray-50 ${this.modal.selectedProdukt?.id === produkt.id ? 'ring-2 ring-green-500' : ''}"
                onclick="app.selectWirkstoffProdukt(${JSON.stringify(produkt).replace(/"/g, '&quot;')})"
              >
                <div>
                  <div class="font-medium">${produkt.name}</div>
                  <div class="text-sm text-gray-600">${produkt.preis?.toFixed(2) || '0.00'}€ (${(produkt.preis_pro_monat || produkt.preis * 30 / (produkt.einheit_anzahl || 1))?.toFixed(2) || '0.00'}€/Monat)</div>
                  <div class="text-xs text-gray-500">${produkt.hauptwirkstoff_menge}${produkt.hauptwirkstoff_einheit} pro ${produkt.einheit_text}</div>
                </div>
                <span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Hauptwirkstoff</span>
              </div>
            `).join('')}
          </div>
        </div>
      `
    }

    if (!this.modal.searchResults.length && this.modal.searchQuery.length >= 2) {
      return `
        <div class="text-gray-500 text-center py-4">
          Keine Ergebnisse für "${this.modal.searchQuery}"
        </div>
      `
    }

    if (this.modal.searchResults.length > 0) {
      return `
        <div class="mb-4 space-y-2">
          ${this.modal.searchResults.map(item => {
            const isWirkstoff = this.modal.mode === 'wirkstoff'
            return `
              <div 
                class="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${(isWirkstoff && this.modal.selectedWirkstoff?.id === item.id) || (!isWirkstoff && this.modal.selectedProdukt?.id === item.id) ? 'ring-2 ring-blue-500' : ''}"
                onclick="app.selectModalItem(${JSON.stringify(item).replace(/"/g, '&quot;')})"
              >
                <div>
                  <div class="font-medium">${item.name}</div>
                  ${item.beschreibung ? `<div class="text-sm text-gray-600">${item.beschreibung}</div>` : ''}
                  ${!isWirkstoff && item.preis ? `<div class="text-sm text-green-600">${item.preis?.toFixed(2) || '0.00'}€ (${(item.preis_pro_monat || (item.preis * 30 / (item.einheit_anzahl || 1)))?.toFixed(2) || '0.00'}€/Monat)</div>` : ''}
                </div>
                ${isWirkstoff ? `<div class="text-sm text-blue-600">Vitamine - Empfehlung: ${item.empfehlung || '4000 IE'}</div>` : ''}
              </div>
            `
          }).join('')}
        </div>
      `
    }

    return ''
  }

  renderModalForm() {
    return `
      <form class="space-y-4">
        <!-- Kategorie -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Kategorie</label>
          <select 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            onchange="app.updateModalField('selectedCategory', this.value)"
          >
            <option value="Basisausstattung" ${this.modal.selectedCategory === 'Basisausstattung' ? 'selected' : ''}>Basisausstattung</option>
            <option value="Energie & Leistung" ${this.modal.selectedCategory === 'Energie & Leistung' ? 'selected' : ''}>Energie & Leistung</option>
            <option value="Entgiftung" ${this.modal.selectedCategory === 'Entgiftung' ? 'selected' : ''}>Entgiftung</option>
            <option value="Immunsystem" ${this.modal.selectedCategory === 'Immunsystem' ? 'selected' : ''}>Immunsystem</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <!-- Dosierung -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Gewünschte Dosierung</label>
            <input
              type="text"
              placeholder="z.B. 1000"
              value="${this.modal.dosierung}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              oninput="app.updateModalField('dosierung', this.value)"
            >
          </div>

          <!-- Einheit -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Einheit</label>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onchange="app.updateModalField('selectedUnit', this.value)"
            >
              <option value="mg" ${this.modal.selectedUnit === 'mg' ? 'selected' : ''}>mg</option>
              <option value="μg" ${this.modal.selectedUnit === 'μg' ? 'selected' : ''}>μg</option>
              <option value="g" ${this.modal.selectedUnit === 'g' ? 'selected' : ''}>g</option>
              <option value="ml" ${this.modal.selectedUnit === 'ml' ? 'selected' : ''}>ml</option>
              <option value="IE" ${this.modal.selectedUnit === 'IE' ? 'selected' : ''}>IE</option>
              <option value="Tropfen" ${this.modal.selectedUnit === 'Tropfen' ? 'selected' : ''}>Tropfen</option>
              <option value="Kapseln" ${this.modal.selectedUnit === 'Kapseln' ? 'selected' : ''}>Kapseln</option>
              <option value="Tabletten" ${this.modal.selectedUnit === 'Tabletten' ? 'selected' : ''}>Tabletten</option>
            </select>
          </div>
        </div>

        <!-- Notizen -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Notizen (optional)</label>
          <textarea
            placeholder="Persönliche Notizen zu diesem Supplement..."
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            oninput="app.updateModalField('notizen', this.value)"
          >${this.modal.notizen}</textarea>
        </div>
      </form>
    `
  }

  handleModalSearchInput(value) {
    this.modal.searchQuery = value
    if (value.length >= 2) {
      this.performModalSearch(value)
    } else {
      this.modal.searchResults = []
      this.renderApp()
    }
  }



  renderInteractionWarnings() {
    if (!this.currentStack?.interaktionen?.length) return ''

    return `
      <div class="mt-4 space-y-3">
        ${this.currentStack.interaktionen.map(interaction => `
          <div class="interaction-${interaction.typ === 'warnung' ? 'warning' : interaction.typ}">
            <div class="flex items-start">
              <i class="fas fa-${this.getInteractionIcon(interaction.typ)} mt-0.5 mr-3"></i>
              <div class="flex-1">
                <div class="font-medium text-sm">
                  ${interaction.wirkstoff_a_name} + ${interaction.wirkstoff_b_name}
                </div>
                <div class="text-sm mt-1">${interaction.kommentar}</div>
              </div>
              <span class="badge-${interaction.schwere === 'hoch' ? 'warnung' : 'tageszeit'} ml-3">
                ${interaction.schwere}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  // Helper functions
  groupProductsByCategory(produkte) {
    const kategorien = {}
    
    produkte.forEach(item => {
      const kategorie = item.stack_produkt.einnahmezeit || 'Allgemein'
      if (!kategorien[kategorie]) {
        kategorien[kategorie] = []
      }
      kategorien[kategorie].push(item)
    })

    return kategorien
  }

  getCategoryIcon(kategorie) {
    const icons = {
      'Morgens nüchtern': 'sun',
      'Zum Frühstück': 'coffee',
      'Mittags': 'clock',
      'Abends': 'moon',
      'Vor dem Schlafen': 'bed',
      'Allgemein': 'pills'
    }
    return icons[kategorie] || 'pills'
  }

  getInteractionIcon(typ) {
    const icons = {
      'warnung': 'exclamation-triangle',
      'vorsicht': 'exclamation-circle', 
      'positiv': 'check-circle',
      'neutral': 'info-circle'
    }
    return icons[typ] || 'info-circle'
  }

  renderScoreStars(score) {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      if (i <= score) {
        stars.push('<i class="fas fa-star text-yellow-400"></i>')
      } else {
        stars.push('<i class="far fa-star text-gray-300"></i>')
      }
    }
    return stars.join('')
  }

  // Event handlers
  setupEventListeners() {
    // Wirkstoff-Suche
    const searchInput = document.getElementById('wirkstoff-search')
    if (searchInput) {
      searchInput.addEventListener('input', _.debounce(this.handleWirkstoffSearch.bind(this), 300))
      searchInput.addEventListener('focus', this.handleSearchFocus.bind(this))
      searchInput.addEventListener('blur', this.handleSearchBlur.bind(this))
    }

    // Esc key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.isOpen) {
        this.closeModal()
      }
    })
  }

  async handleWirkstoffSearch(event) {
    const query = event.target.value.trim()
    const resultsContainer = document.getElementById('autocomplete-results')
    
    if (query.length < 2) {
      resultsContainer.classList.add('hidden')
      return
    }

    try {
      const response = await this.apiCall(`/wirkstoffe/search?q=${encodeURIComponent(query)}&limit=8`)
      
      if (response.success && response.data.length > 0) {
        resultsContainer.innerHTML = response.data.map(wirkstoff => `
          <div class="autocomplete-item" onclick="app.selectWirkstoff(${wirkstoff.id})">
            <div class="font-medium">${wirkstoff.name}</div>
            ${wirkstoff.beschreibung ? `
              <div class="text-sm text-gray-600 truncate">${wirkstoff.beschreibung}</div>
            ` : ''}
          </div>
        `).join('')
        
        resultsContainer.classList.remove('hidden')
      } else {
        resultsContainer.innerHTML = `
          <div class="autocomplete-item text-gray-500">
            <i class="fas fa-search mr-2"></i>
            Keine Wirkstoffe gefunden für "${query}"
          </div>
        `
        resultsContainer.classList.remove('hidden')
      }
    } catch (error) {
      console.error('Search error:', error)
      resultsContainer.classList.add('hidden')
    }
  }

  handleSearchFocus() {
    // Show recent searches or popular ingredients
  }

  handleSearchBlur() {
    // Hide autocomplete after a short delay
    setTimeout(() => {
      const resultsContainer = document.getElementById('autocomplete-results')
      if (resultsContainer) {
        resultsContainer.classList.add('hidden')
      }
    }, 200)
  }

  async selectWirkstoff(wirkstoffId) {
    try {
      const response = await this.apiCall(`/wirkstoffe/${wirkstoffId}`)
      
      if (response.success) {
        this.modal.wirkstoff = response.data
        this.modal.isOpen = true
        this.modal.step = 1
        this.renderApp()

        // Clear search
        const searchInput = document.getElementById('wirkstoff-search')
        if (searchInput) {
          searchInput.value = ''
        }
      }
    } catch (error) {
      console.error('Load wirkstoff error:', error)
    }
  }

  // Modal navigation
  modalNext() {
    if (this.modal.step < 3) {
      this.modal.step++
      
      if (this.modal.step === 2) {
        this.loadModalProducts()
      }
      
      this.renderApp()
    }
  }

  modalBack() {
    if (this.modal.step > 1) {
      this.modal.step--
      this.renderApp()
    }
  }

  closeModal(event) {
    if (!event || event.target.classList.contains('modal-backdrop')) {
      this.modal.isOpen = false
      this.modal.step = 1
      this.modal.wirkstoff = null
      this.modal.produkt = null
      this.renderApp()
    }
  }

  async loadModalProducts() {
    if (!this.modal.wirkstoff) return

    try {
      const response = await this.apiCall(`/produkte/by-wirkstoff/${this.modal.wirkstoff.id}`)
      
      if (response.success) {
        const container = document.getElementById('modal-product-list')
        if (container) {
          container.innerHTML = response.data.map(produkt => `
            <div class="border border-gray-200 rounded-lg p-4 hover:border-supplement-300 cursor-pointer"
              onclick="app.selectModalProduct(${produkt.id})">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h4 class="font-semibold text-gray-900">${produkt.name}</h4>
                  ${produkt.marke ? `<p class="text-sm text-gray-600">${produkt.marke}</p>` : ''}
                  
                  <div class="mt-2 text-sm text-gray-700">
                    ${produkt.hauptwirkstoff_menge} ${produkt.hauptwirkstoff_einheit} ${this.modal.wirkstoff.name}
                    ${produkt.form_name ? ` (${produkt.form_name})` : ''}
                  </div>
                  
                  ${produkt.empfehlung_typ === 'empfohlen' ? `
                    <span class="badge-empfohlen mt-2 inline-block">Empfohlen</span>
                  ` : ''}
                </div>
                
                <div class="text-right ml-4">
                  <div class="price-highlight">${produkt.preis_pro_monat.toFixed(2)}€</div>
                  <div class="text-sm text-gray-600">pro Monat</div>
                </div>
              </div>
            </div>
          `).join('')
        }
      }
    } catch (error) {
      console.error('Load modal products error:', error)
    }
  }

  async selectModalProduct(produktId) {
    try {
      const response = await this.apiCall(`/produkte/${produktId}`)
      
      if (response.success) {
        this.modal.produkt = response.data
        this.modal.step = 3
        this.renderApp()
      }
    } catch (error) {
      console.error('Select modal product error:', error)
    }
  }

  async addToStack(event) {
    event.preventDefault()
    
    if (!this.currentStack || !this.modal.produkt) return

    const formData = new FormData(event.target)
    const data = {
      produkt_id: this.modal.produkt.id,
      dosierung: parseFloat(formData.get('dosierung')),
      einnahmezeit: formData.get('einnahmezeit') || null,
      notiz: formData.get('notiz') || null
    }

    try {
      const response = await this.apiCall(`/stacks/${this.currentStack.id}/produkte`, 'POST', data)
      
      if (response.success) {
        await this.loadStack(this.currentStack.id)
        this.closeModal()
        this.showToast('Produkt erfolgreich hinzugefügt!', 'success')
      } else {
        this.showToast(response.error || 'Fehler beim Hinzufügen', 'error')
      }
    } catch (error) {
      console.error('Add to stack error:', error)
      this.showToast('Fehler beim Hinzufügen', 'error')
    }
  }

  // Stack management
  async loadStack(stackId) {
    try {
      const response = await this.apiCall(`/stacks/${stackId}`)
      
      if (response.success) {
        this.currentStack = response.data
        this.renderApp()
      }
    } catch (error) {
      console.error('Load stack error:', error)
    }
  }

  async loadUserStacks() {
    if (!this.currentUser) return

    try {
      const response = await this.apiCall('/stacks')
      
      if (response.success && response.data.length > 0) {
        // Load first stack or create new one
        await this.loadStack(response.data[0].id)
      } else {
        // Create first stack
        await this.createFirstStack()
      }
    } catch (error) {
      console.error('Load user stacks error:', error)
    }
  }

  async createFirstStack() {
    try {
      const response = await this.apiCall('/stacks', 'POST', {
        name: 'Mein erster Stack',
        beschreibung: 'Grundversorgung mit Nahrungsergänzungsmitteln'
      })
      
      if (response.success) {
        await this.loadStack(response.data.stack_id)
      }
    } catch (error) {
      console.error('Create first stack error:', error)
    }
  }

  // Product selection
  toggleProductSelection(produktId) {
    if (this.selectedProducts.has(produktId)) {
      this.selectedProducts.delete(produktId)
    } else {
      this.selectedProducts.add(produktId)
    }
    this.renderApp()
  }

  toggleAllProducts() {
    const allProducts = this.currentStack?.produkte?.map(p => p.produkt.id) || []
    
    if (this.selectedProducts.size === allProducts.length) {
      this.selectedProducts.clear()
    } else {
      allProducts.forEach(id => this.selectedProducts.add(id))
    }
    this.renderApp()
  }

  clearSelection() {
    this.selectedProducts.clear()
    this.renderApp()
  }

  orderSelected() {
    if (this.selectedProducts.size === 0) return

    const selectedItems = this.currentStack.produkte.filter(item => 
      this.selectedProducts.has(item.produkt.id)
    )

    // Open affiliate links in new tabs
    selectedItems.forEach(item => {
      const url = item.produkt.affiliate_link || item.produkt.shop_link
      if (url) {
        window.open(url, '_blank')
      }
    })

    this.showToast(`${selectedItems.length} Produkte in neuen Tabs geöffnet`, 'success')
  }

  // Authentication
  switchAuthTab(tab) {
    const loginTab = document.getElementById('login-tab')
    const registerTab = document.getElementById('register-tab')
    const loginForm = document.getElementById('login-form')
    const registerForm = document.getElementById('register-form')

    if (tab === 'login') {
      loginTab.className = 'flex-1 py-2 px-4 rounded-md text-sm font-medium text-white bg-supplement-600'
      registerTab.className = 'flex-1 py-2 px-4 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700'
      loginForm.classList.remove('hidden')
      registerForm.classList.add('hidden')
    } else {
      registerTab.className = 'flex-1 py-2 px-4 rounded-md text-sm font-medium text-white bg-supplement-600'
      loginTab.className = 'flex-1 py-2 px-4 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700'
      registerForm.classList.remove('hidden')
      loginForm.classList.add('hidden')
    }
  }

  async handleLogin(event) {
    event.preventDefault()
    
    const formData = new FormData(event.target)
    const data = {
      email: formData.get('email'),
      password: formData.get('password')
    }

    this.setButtonLoading('login', true)

    try {
      const response = await this.apiCall('/auth/login', 'POST', data)
      
      if (response.success) {
        localStorage.setItem('auth_token', response.data.token)
        this.currentUser = response.data.user
        await this.loadUserStacks()
        this.showToast('Erfolgreich angemeldet!', 'success')
      } else {
        this.showToast(response.error || 'Anmeldung fehlgeschlagen', 'error')
      }
    } catch (error) {
      console.error('Login error:', error)
      this.showToast('Anmeldung fehlgeschlagen', 'error')
    } finally {
      this.setButtonLoading('login', false)
    }
  }

  async handleRegister(event) {
    event.preventDefault()
    
    const formData = new FormData(event.target)
    const data = {
      email: formData.get('email'),
      password: formData.get('password'),
      name: formData.get('name') || null
    }

    this.setButtonLoading('register', true)

    try {
      const response = await this.apiCall('/auth/register', 'POST', data)
      
      if (response.success) {
        localStorage.setItem('auth_token', response.data.token)
        this.currentUser = response.data.user
        await this.loadUserStacks()
        this.showToast('Erfolgreich registriert!', 'success')
      } else {
        this.showToast(response.error || 'Registrierung fehlgeschlagen', 'error')
      }
    } catch (error) {
      console.error('Register error:', error)
      this.showToast('Registrierung fehlgeschlagen', 'error')
    } finally {
      this.setButtonLoading('register', false)
    }
  }

  logout() {
    localStorage.removeItem('auth_token')
    this.currentUser = null
    this.currentStack = null
    this.selectedProducts.clear()
    window.location.href = '/'
  }

  // Demo functions
  async resetDemo() {
    if (!this.demoSessionKey) return

    try {
      const response = await this.apiCall(`/demo/session/${this.demoSessionKey}/reset`, 'POST')
      
      if (response.success) {
        this.selectedProducts.clear()
        if (this.currentStack) {
          await this.loadStack(this.currentStack.id)
        }
        this.showToast('Demo zurückgesetzt!', 'success')
      }
    } catch (error) {
      console.error('Reset demo error:', error)
    }
  }

  async cleanupDemoSessions() {
    try {
      await this.apiCall('/demo/cleanup', 'POST')
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  }

  // Modal Functions for "Supplement hinzufügen"
  openAddSupplementModal() {
    this.modal = {
      isOpen: true,
      mode: 'wirkstoff', // 'wirkstoff' or 'produkt'
      searchQuery: '',
      searchResults: [],
      selectedCategory: 'Basisausstattung',
      selectedUnit: 'mg',
      dosierung: '',
      notizen: '',
      selectedWirkstoff: null,
      selectedProdukt: null
    }
    this.renderApp()
  }

  closeSupplementModal() {
    this.modal.isOpen = false
    this.renderApp()
  }

  switchModalMode(mode) {
    this.modal.mode = mode
    this.modal.searchQuery = ''
    this.modal.searchResults = []
    this.renderApp()
  }

  async performModalSearch(query) {
    if (!query || query.length < 2) {
      this.modal.searchResults = []
      this.renderApp()
      return
    }

    try {
      let response
      if (this.modal.mode === 'wirkstoff') {
        response = await this.apiCall(`/wirkstoffe/search?q=${encodeURIComponent(query)}&limit=5`)
      } else {
        response = await this.apiCall(`/produkte?q=${encodeURIComponent(query)}&limit=5`)
      }

      if (response.success) {
        this.modal.searchResults = response.data
        this.renderApp()
      }
    } catch (error) {
      console.error('Modal search error:', error)
    }
  }

  selectModalItem(item) {
    if (this.modal.mode === 'wirkstoff') {
      this.modal.selectedWirkstoff = item
      // Load products for this wirkstoff
      this.loadWirkstoffProducts(item.id)
    } else {
      this.modal.selectedProdukt = item
    }
    this.renderApp()
  }

  async loadWirkstoffProducts(wirkstoffId) {
    try {
      const response = await this.apiCall(`/produkte/by-wirkstoff/${wirkstoffId}`)
      if (response.success) {
        this.modal.wirkstoffProducts = response.data
        this.renderApp()
      }
    } catch (error) {
      console.error('Load wirkstoff products error:', error)
    }
  }

  selectWirkstoffProdukt(produkt) {
    this.modal.selectedProdukt = produkt
    this.renderApp()
  }

  updateModalField(field, value) {
    this.modal[field] = value
  }

  async addSupplementToStack() {
    if (!this.currentStack) {
      this.showToast('Kein Stack ausgewählt', 'error')
      return
    }

    let produktId = null
    
    if (this.modal.selectedProdukt) {
      produktId = this.modal.selectedProdukt.id
    } else {
      this.showToast('Bitte wählen Sie ein Produkt aus', 'error')
      return
    }

    const dosierung = parseFloat(this.modal.dosierung) || 1
    const data = {
      produkt_id: produktId,
      dosierung: dosierung,
      einnahmezeit: this.modal.selectedCategory,
      notiz: this.modal.notizen || null
    }

    try {
      const response = await this.apiCall(`/stacks/${this.currentStack.id}/produkte`, 'POST', data)
      
      if (response.success) {
        this.showToast('Supplement erfolgreich hinzugefügt!', 'success')
        this.closeSupplementModal()
        await this.loadStack(this.currentStack.id)
      } else {
        this.showToast(response.error || 'Fehler beim Hinzufügen', 'error')
      }
    } catch (error) {
      console.error('Add supplement error:', error)
      this.showToast('Fehler beim Hinzufügen', 'error')
    }
  }

  // Utility functions
  setButtonLoading(type, isLoading) {
    const text = document.querySelector(`.${type}-btn-text`)
    const spinner = document.querySelector(`.${type}-btn-spinner`)
    
    if (text && spinner) {
      if (isLoading) {
        text.classList.add('hidden')
        spinner.classList.remove('hidden')
      } else {
        text.classList.remove('hidden')
        spinner.classList.add('hidden')
      }
    }
  }

  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div')
    toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg transition-all duration-300 ${
      type === 'success' ? 'bg-green-600 text-white' :
      type === 'error' ? 'bg-red-600 text-white' :
      type === 'warning' ? 'bg-orange-600 text-white' :
      'bg-blue-600 text-white'
    }`
    
    toast.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : type === 'warning' ? 'exclamation' : 'info'} mr-2"></i>
        <span>${message}</span>
      </div>
    `
    
    document.body.appendChild(toast)
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0'
      toast.style.transform = 'translateX(100%)'
      setTimeout(() => {
        document.body.removeChild(toast)
      }, 300)
    }, 3000)
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new SupplementStack()
})