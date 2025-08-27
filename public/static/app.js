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
            <div class="products-grid-modern">
              ${produkte.map(item => this.renderProductCard(item)).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  renderProductCard(stackItem) {
    const { stack_produkt: sp, produkt: p } = stackItem
    
    // Generate placeholder image with first letter of product name
    const firstLetter = p.name.charAt(0).toUpperCase()
    const placeholderImage = this.generatePlaceholderImage(firstLetter, p.name)
    
    // Generate warnings based on product type
    const warnings = this.getProductWarnings(p)
    
    return `
      <div class="product-card-modern">
        <!-- Product Image -->
        <div class="product-image-container">
          ${p.bild_url ? `
            <img src="${p.bild_url}" alt="${p.name}" class="product-image">
          ` : `
            <div class="product-image-placeholder">
              <span class="placeholder-letter">${firstLetter}</span>
            </div>
          `}
          <div class="product-checkbox">
            <input type="checkbox" 
              ${this.selectedProducts.has(p.id) ? 'checked' : ''}
              onchange="app.toggleProductSelection(${p.id})"
              class="checkbox-modern">
          </div>
        </div>

        <!-- Product Header -->
        <div class="product-header">
          <h4 class="product-title">${p.name}</h4>
          ${p.marke ? `<p class="product-brand">${p.marke}</p>` : ''}
        </div>

        <!-- Product Content -->
        <div class="product-content">
          <!-- Package Content Info -->
          <div class="product-info">
            <div class="info-label">Packungsinhalt:</div>
            <div class="info-value">${this.formatPackageContent(p)}</div>
          </div>

          <!-- Dosage Display -->
          <div class="product-info">
            <div class="info-label">Dosierung:</div>
            <div class="info-value dosage-display">${this.formatDosageDisplay(p, sp)}</div>
          </div>

          <!-- Einnahmezeit Badge -->
          ${sp.einnahmezeit ? `
            <div class="timing-badge timing-${this.getTimingClass(sp.einnahmezeit)}">
              <i class="fas fa-${this.getCategoryIcon(sp.einnahmezeit)} mr-1"></i>
              ${sp.einnahmezeit}
            </div>
          ` : ''}

          <!-- Warnings -->
          ${warnings.length ? `
            <div class="warnings-container">
              ${warnings.map(warning => `
                <div class="warning-item">
                  <i class="fas fa-exclamation-triangle warning-icon"></i>
                  <span class="warning-text">${warning}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Notiz -->
          ${sp.notiz ? `
            <div class="note-container">
              <i class="fas fa-sticky-note note-icon"></i>
              <span class="note-text">${sp.notiz}</span>
            </div>
          ` : ''}
        </div>

        <!-- Price Section -->
        <div class="price-section">
          <div class="price-main">${p.preis_pro_monat.toFixed(2).replace('.', ',')}€</div>
          <div class="price-period">pro Monat</div>
          <div class="price-details">
            Einzelpreis: ${p.preis.toFixed(2).replace('.', ',')}€ (${this.formatPackageContent(p)})
          </div>
        </div>

        <!-- Actions -->
        <div class="card-actions">
          <button onclick="app.editStackProduct(${sp.stack_id}, ${sp.produkt_id})" 
            class="btn-edit">
            <i class="fas fa-edit mr-1"></i> Bearbeiten
          </button>
          
          <button onclick="app.removeFromStack(${sp.stack_id}, ${sp.produkt_id})" 
            class="btn-remove">
            <i class="fas fa-trash mr-1"></i> Entfernen
          </button>
        </div>

        <!-- Shop Button -->
        ${p.shop_link || p.affiliate_link ? `
          <a href="${p.affiliate_link || p.shop_link}" target="_blank" 
            class="btn-shop">
            <i class="fas fa-shopping-cart mr-2"></i> Jetzt bestellen
          </a>
        ` : ''}
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
          <h2 class="text-xl font-semibold text-gray-900">${this.modal.editMode ? 'Supplement bearbeiten' : 'Supplement hinzufügen'}</h2>
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

        <div id="modal-search-results">
          ${this.renderModalSearchResults()}
        </div>
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
${this.modal.editMode ? 'Änderungen speichern' : 'Supplement hinzufügen'}
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
                onclick="app.selectWirkstoffProduktById(${produkt.id})"
              >
                <div>
                  <div class="font-medium">${produkt.name}</div>
                  <div class="text-sm text-gray-600">${produkt.preis?.toFixed(2).replace('.', ',') || '0,00'}€ (${(produkt.preis_pro_monat || 0)?.toFixed(2).replace('.', ',') || '0,00'}€/Monat)</div>
                  <div class="text-xs text-gray-500">${produkt.hauptwirkstoff_menge}${produkt.hauptwirkstoff_einheit} pro ${this.getProductUnitName(produkt)}</div>
                  <div class="text-xs text-blue-600 font-medium">📦 ${this.formatPackageContent(produkt)}</div>
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
                  ${!isWirkstoff && item.preis ? `<div class="text-sm text-green-600">${item.preis?.toFixed(2).replace('.', ',') || '0,00'}€ (${(item.preis_pro_monat || 0)?.toFixed(2).replace('.', ',') || '0,00'}€/Monat)</div>` : ''}
                  ${!isWirkstoff && item.einheit_anzahl ? `<div class="text-xs text-blue-600 font-medium">📦 ${this.formatPackageContent(item)}</div>` : ''}
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
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Gewünschte Dosierung
              ${this.modal.editMode ? '<span class="text-xs text-blue-600 font-normal">(Wirkstoff-Menge)</span>' : ''}
            </label>
            <input
              type="text"
              placeholder="z.B. 1000"
              value="${this.modal.dosierung}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              oninput="app.updateModalField('dosierung', this.value)"
            >
            ${this.modal.editMode ? '<p class="text-xs text-gray-500 mt-1">💡 Wird automatisch in Kapseln/Tropfen umgerechnet</p>' : ''}
          </div>

          <!-- Einheit -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Einheit</label>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onchange="app.updateModalField('selectedUnit', this.value)"
            >
              ${this.getAvailableUnits().map(unit => `
                <option value="${unit}" ${this.modal.selectedUnit === unit ? 'selected' : ''}>${unit}</option>
              `).join('')}
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
    
    // Debounce search to prevent focus loss
    clearTimeout(this.searchTimeout)
    
    if (value.length >= 2) {
      this.searchTimeout = setTimeout(() => {
        this.performModalSearch(value)
      }, 300) // 300ms delay
    } else {
      this.modal.searchResults = []
      // Update only search results without full re-render
      this.updateSearchResults()
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
  formatDosageDisplay(produkt, stackProdukt) {
    const portionen = stackProdukt.dosierung || 1
    const produktName = produkt.name?.toLowerCase() || ''
    
    console.log('🔍 formatDosageDisplay DEBUG:')
    console.log('  Portionen:', portionen)  
    console.log('  Produktname:', produktName)
    console.log('  Produktform:', produkt.form)
    console.log('  D3 Check:', produktName.includes('vitamin d3') || produktName.includes('d3'))
    console.log('  Tropfen Check:', produkt.form?.toLowerCase() === 'tropfen' || produktName.includes('tropfen'))
    

    // Extrahiere Wirkstoffmenge aus Produktname und berechne Gesamtdosis
    let wirkstoffInfo = ''
    
    // Vitamin D3 Tropfen - Robustere Erkennung mit Fallback für falsch gespeicherte Daten
    const istVitaminD3 = produktName.includes('vitamin d3') || produktName.includes('d3')
    const istTropfen = (produkt.form && produkt.form.toLowerCase().includes('tropfen')) || 
                       produktName.includes('tropfen') ||
                       produktName.includes('ie') // D3 mit IE ist meist Tropfen
    
    console.log('🧪 D3 ERKENNUNG:', { istVitaminD3, istTropfen, form: produkt.form, name: produktName })
    
    if (istVitaminD3 && istTropfen) {
      // Fallback: Wenn Portionen > 1000, dann wurden wahrscheinlich IE fälschlicherweise als Portionen gespeichert
      if (portionen > 1000) {
        console.log('🔧 FALLBACK: Große Portionenzahl erkannt:', portionen, '- behandle als IE')
        const korrigierteTropfen = Math.ceil(portionen / 10000) || 1
        const gesamtIE = portionen // Die "Portionen" sind eigentlich IE
        wirkstoffInfo = `${gesamtIE.toLocaleString('de-DE')} IE täglich`
        const result = `${korrigierteTropfen} ${korrigierteTropfen === 1 ? 'Tropfen' : 'Tropfen'} täglich (${wirkstoffInfo})`
        console.log('🔧 FALLBACK Ergebnis:', result)
        return result
      } else {
        // Normale Berechnung - Portionen sind korrekt als Tropfen gespeichert
        console.log('✅ D3 NORMALE BERECHNUNG:', portionen, 'Tropfen gespeichert')
        const ieProTropfen = 10000 // Standard: 10.000 IE pro Tropfen
        const gesamtIE = portionen * ieProTropfen
        wirkstoffInfo = `${gesamtIE.toLocaleString('de-DE')} IE täglich`
        const result = `${portionen} ${portionen === 1 ? 'Tropfen' : 'Tropfen'} täglich (${wirkstoffInfo})`
        console.log('✅ D3 ERGEBNIS:', result)
        return result
      }
    }
    
    // Vitamin B12 Kapseln/Tabletten  
    else if (produktName.includes('b12')) {

      const mcgMatch = produktName.match(/(\d+)mcg/)
      const mcgProKapsel = mcgMatch ? parseInt(mcgMatch[1]) : 1000
      const gesamtMcg = portionen * mcgProKapsel
      wirkstoffInfo = `${gesamtMcg} μg täglich`
      const einheitName = produkt.form?.toLowerCase() === 'tablette' ? 'Tablette' : 'Kapsel'
      return `${portionen} ${portionen === 1 ? einheitName : einheitName + 'n'} täglich (${wirkstoffInfo})`
    }
    
    // Magnesium Kapseln
    else if (produktName.includes('magnesium')) {

      const mgProKapsel = produktName.includes('einzelkapsel') ? 180 : 200 // Standard mg pro Kapsel
      const gesamtMg = portionen * mgProKapsel
      wirkstoffInfo = `${gesamtMg} mg täglich`
      return `${portionen} ${portionen === 1 ? 'Kapsel' : 'Kapseln'} täglich (${wirkstoffInfo})`
    }
    
    // Allgemeiner Fall - versuche Einheit aus Produktname zu extrahieren
    else {
      console.log('❌ ALLGEMEINER FALL erreicht - keine spezielle Erkennung')
      
      // Spezielle Fallback-Checks für D3
      if (produktName.includes('d3') || produktName.includes('vitamin d3')) {
        console.log('🔧 D3 FALLBACK aktiviert')
        // Behandle als Tropfen, auch wenn Erkennung fehlschlug
        const ieProTropfen = 10000
        const gesamtIE = portionen * ieProTropfen
        const wirkstoffInfo = `${gesamtIE.toLocaleString('de-DE')} IE täglich`
        return `${portionen} ${portionen === 1 ? 'Tropfen' : 'Tropfen'} täglich (${wirkstoffInfo})`
      }
      
      const einheitName = produkt.form || 'Portion'
      return `${portionen} ${portionen === 1 ? einheitName : einheitName + 'en'} täglich`
    }
  }

  formatPackageContent(produkt) {
    const anzahl = produkt.einheit_anzahl
    const produktName = produkt.name?.toLowerCase() || ''
    const form = produkt.form?.toLowerCase() || ''
    
    // Intelligente Formatierung basierend auf Produkttyp
    if (form === 'tropfen' || produktName.includes('tropfen')) {
      // Für Tropfen: Rechne ml in Tropfen um (1ml ≈ 20 Tropfen)
      const tropfenAnzahl = Math.round(anzahl * 20)
      return `${tropfenAnzahl} Tropfen pro Packung`
    }
    else if (form === 'flüssig' || form === 'liquid') {
      return `${anzahl} ml pro Packung`
    }
    else if (form === 'kapsel' || form === 'kapseln') {
      return `${anzahl} Kapseln pro Packung`
    }
    else if (form === 'tablette' || form === 'tabletten') {
      return `${anzahl} Tabletten pro Packung`
    }
    else if (form === 'pulver') {
      return `${anzahl}g Pulver pro Packung`
    }
    else {
      // Fallback mit intelligenter Einheit-Erkennung
      const einheit = form || 'Stück'
      return `${anzahl} ${einheit} pro Packung`
    }
  }

  getProductUnitName(produkt) {
    const produktName = produkt.name?.toLowerCase() || ''
    const form = produkt.form?.toLowerCase() || ''
    
    // Intelligente Einheit basierend auf Produkttyp
    if (form === 'tropfen' || produktName.includes('tropfen')) {
      return 'Tropfen'
    }
    else if (form === 'kapsel' || form === 'kapseln') {
      return 'Kapsel'
    }
    else if (form === 'tablette' || form === 'tabletten') {
      return 'Tablette'
    }
    else if (form === 'pulver') {
      return 'Portion'
    }
    else if (form === 'flüssig' || form === 'liquid') {
      return 'ml'
    }
    else {
      // Fallback auf das was in der Datenbank steht, oder "Stück"
      return produkt.einheit_text || 'Stück'
    }
  }

  getAvailableUnits() {
    // Intelligente Unit-Auswahl basierend auf gewähltem Produkt/Wirkstoff
    if (this.modal.selectedProdukt) {
      const produktName = this.modal.selectedProdukt.name?.toLowerCase() || ''
      const form = this.modal.selectedProdukt.form?.toLowerCase() || ''
      
      // Vitamin D3 → nur IE
      if (produktName.includes('vitamin d3') || produktName.includes('d3')) {
        return ['IE']
      }
      // Vitamin B12 → nur μg  
      else if (produktName.includes('b12')) {
        return ['μg']
      }
      // Magnesium → nur mg
      else if (produktName.includes('magnesium')) {
        return ['mg']
      }
      // Omega-3 → nur mg
      else if (produktName.includes('omega')) {
        return ['mg']
      }
      // Zink → nur mg
      else if (produktName.includes('zink')) {
        return ['mg']
      }
      // Eisen → nur mg
      else if (produktName.includes('eisen')) {
        return ['mg']
      }
    }
    
    // Fallback oder bei Wirkstoff-Suche
    if (this.modal.selectedWirkstoff) {
      const wirkstoffName = this.modal.selectedWirkstoff.name?.toLowerCase() || ''
      
      if (wirkstoffName.includes('vitamin d3') || wirkstoffName.includes('d3')) {
        return ['IE']
      }
      else if (wirkstoffName.includes('b12')) {
        return ['μg']
      }
      else if (wirkstoffName.includes('magnesium')) {
        return ['mg']
      }
      else if (wirkstoffName.includes('omega')) {
        return ['mg']
      }
    }
    
    // Allgemeiner Fallback - alle Einheiten
    return ['mg', 'μg', 'g', 'ml', 'IE', 'Tropfen', 'Kapseln', 'Tabletten']
  }

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
                  <div class="price-highlight">${(produkt.preis_pro_monat || 0).toFixed(2).replace('.', ',')}€</div>
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
      selectedProdukt: null,
      editMode: false,
      editStackId: null,
      editProduktId: null
    }
    this.renderApp()
  }

  closeSupplementModal() {
    this.modal = {
      isOpen: false,
      mode: 'wirkstoff',
      searchQuery: '',
      searchResults: [],
      selectedCategory: 'Basisausstattung',
      selectedUnit: 'mg',
      dosierung: '',
      notizen: '',
      selectedWirkstoff: null,
      selectedProdukt: null,
      editMode: false,
      editStackId: null,
      editProduktId: null
    }
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
      this.updateSearchResults()
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
        // Update only search results, not full modal
        this.updateSearchResults()
      }
    } catch (error) {
      console.error('Modal search error:', error)
    }
  }

  updateSearchResults() {
    // Update nur die Suchergebnisse ohne vollständiges Re-rendering
    const resultsContainer = document.getElementById('modal-search-results')
    if (resultsContainer) {
      resultsContainer.innerHTML = this.renderModalSearchResults()
    }
  }

  selectModalItem(item) {
    if (this.modal.mode === 'wirkstoff') {
      this.modal.selectedWirkstoff = item
      
      // Automatisch die richtige Einheit setzen
      if (item.name.toLowerCase().includes('vitamin d3')) {
        this.modal.selectedUnit = 'IE'
      } else if (item.name.toLowerCase().includes('b12')) {
        this.modal.selectedUnit = 'μg'
      } else if (item.name.toLowerCase().includes('magnesium')) {
        this.modal.selectedUnit = 'mg'
      } else {
        // Standard-Einheit basierend auf Wirkstoff-Einheit
        this.modal.selectedUnit = item.einheit || 'mg'
      }
      
      // Load products for this wirkstoff
      this.loadWirkstoffProducts(item.id)
    } else {
      this.modal.selectedProdukt = item
      
      // Automatisch zur richtigen Einheit und Standarddosierung wechseln
      const produktName = item.name?.toLowerCase() || ''
      
      if (produktName.includes('vitamin d3') || produktName.includes('d3')) {
        this.modal.selectedUnit = 'IE'
        this.modal.dosierung = '4000'
      } 
      else if (produktName.includes('b12')) {
        this.modal.selectedUnit = 'μg' 
        this.modal.dosierung = '1000'
      }
      else if (produktName.includes('magnesium')) {
        this.modal.selectedUnit = 'mg'
        this.modal.dosierung = '400'
      }
      else if (produktName.includes('omega')) {
        this.modal.selectedUnit = 'mg'
        this.modal.dosierung = '2000'
      }
      else {
        this.modal.selectedUnit = 'mg'
        this.modal.dosierung = '100'
      }
    }
    this.renderApp()
    
    // Bei Produktauswahl automatisch zum Dosierung-Feld springen
    if (this.modal.mode === 'produkt' && this.modal.selectedProdukt) {
      setTimeout(() => {
        const dosierungInput = document.querySelector('input[oninput*="dosierung"]')
        if (dosierungInput) {
          dosierungInput.focus()
          dosierungInput.select()
        }
      }, 100)
    }
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
    console.log('🔍 selectWirkstoffProdukt aufgerufen:', produkt)
    this.modal.selectedProdukt = produkt
    console.log('✅ selectedProdukt gesetzt:', this.modal.selectedProdukt)
    
    // Automatisch zur richtigen Einheit und Standarddosierung wechseln
    const produktName = produkt.name?.toLowerCase() || ''
    
    if (produktName.includes('vitamin d3') || produktName.includes('d3')) {
      this.modal.selectedUnit = 'IE'
      this.modal.dosierung = '4000' // Standarddosierung für D3
    } 
    else if (produktName.includes('b12')) {
      this.modal.selectedUnit = 'μg' 
      this.modal.dosierung = '1000' // Standarddosierung für B12
    }
    else if (produktName.includes('magnesium')) {
      this.modal.selectedUnit = 'mg'
      this.modal.dosierung = '400' // Standarddosierung für Magnesium
    }
    else if (produktName.includes('omega')) {
      this.modal.selectedUnit = 'mg'
      this.modal.dosierung = '2000' // Standarddosierung für Omega-3
    }
    else {
      this.modal.selectedUnit = 'mg'
      this.modal.dosierung = '100' // Allgemeine Standarddosierung
    }
    
    this.renderApp()
    
    // Automatisch zum Dosierung-Feld springen
    setTimeout(() => {
      const dosierungInput = document.querySelector('input[oninput*="dosierung"]')
      if (dosierungInput) {
        dosierungInput.focus()
        dosierungInput.select() // Text auswählen für einfache Überschreibung
      }
    }, 100)
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

    // Berechne korrekte Dosierung basierend auf Wirkstoff und Einheit
    let dosierung = parseFloat(this.modal.dosierung) || 1
    const einheit = this.modal.selectedUnit || 'mg'
    
    // Intelligente Umrechnung basierend auf Wirkstoff und Einheit
    if (this.modal.selectedProdukt) {
      const produktName = this.modal.selectedProdukt.name.toLowerCase()
      

      // Vitamin D3 Tropfen: IE zu Tropfen - Robustere Erkennung
      if ((produktName.includes('vitamin d3') || produktName.includes('d3')) && 
          (this.modal.selectedProdukt.form?.toLowerCase() === 'tropfen' || produktName.includes('tropfen')) && 
          einheit === 'IE') {
        const originalDosierung = dosierung
        // 10000 IE = 1 Tropfen (standardmäßig)
        dosierung = Math.ceil(dosierung / 10000) || 1
        console.log('🧪 D3 UMRECHNUNG:', originalDosierung, 'IE →', dosierung, 'Tropfen')

      }
      
      // Vitamin B12 Tabletten/Kapseln: μg zu Stück
      else if (produktName.includes('b12') && einheit === 'μg') {
        const originalDosierung = dosierung
        // Extrahiere mcg pro Kapsel aus Produktname (z.B. "1000mcg")
        const mcgMatch = produktName.match(/(\d+)mcg/)
        const mcgProKapsel = mcgMatch ? parseInt(mcgMatch[1]) : 1000 // Default: 1000mcg
        dosierung = Math.ceil(dosierung / mcgProKapsel) || 1

      }
      
      // Magnesium Kapseln: mg zu Kapseln
      else if (produktName.includes('magnesium') && einheit === 'mg') {
        const originalDosierung = dosierung
        // Standard: 180mg pro Kapsel für Einzelkapseln
        const mgProKapsel = produktName.includes('einzelkapsel') ? 180 : 200
        dosierung = Math.ceil(dosierung / mgProKapsel) || 1

      }

    }
    
    const data = {
      produkt_id: produktId,
      dosierung: dosierung,
      einnahmezeit: this.modal.selectedCategory,
      notiz: this.modal.notizen || null
    }
    
    console.log('📤 SPEICHERE DATEN:', data)

    try {
      let response
      
      // Edit-Modus oder Neu-Hinzufügen
      if (this.modal.editMode && this.modal.editStackId && this.modal.editProduktId) {
        // Update bestehenden Eintrag
        response = await this.apiCall(`/stacks/${this.modal.editStackId}/produkte/${this.modal.editProduktId}`, 'PUT', data)
        
        if (response.success) {
          this.showToast('Supplement erfolgreich bearbeitet!', 'success')
        } else {
          this.showToast(response.error || 'Fehler beim Bearbeiten', 'error')
        }
      } else {
        // Neuen Eintrag hinzufügen
        response = await this.apiCall(`/stacks/${this.currentStack.id}/produkte`, 'POST', data)
        
        if (response.success) {
          this.showToast('Supplement erfolgreich hinzugefügt!', 'success')
        } else {
          this.showToast(response.error || 'Fehler beim Hinzufügen', 'error')
        }
      }
      
      if (response.success) {
        this.closeSupplementModal()
        await this.loadStack(this.currentStack.id)
        this.renderApp()
      }
    } catch (error) {
      console.error('Add/Edit supplement error:', error)
      this.showToast('Fehler beim Speichern', 'error')
    }
  }

  selectWirkstoffProduktById(produktId) {
    // Finde das Produkt in der wirkstoffProducts Liste
    const produkt = this.modal.wirkstoffProducts?.find(p => p.id === produktId)
    if (produkt) {
      console.log('🔍 selectWirkstoffProduktById gefunden:', produkt)
      this.selectWirkstoffProdukt(produkt)
    } else {
      console.error('❌ Produkt mit ID', produktId, 'nicht gefunden in:', this.modal.wirkstoffProducts)
    }
  }

  async editStackProduct(stackId, produktId) {
    try {
      // Lade aktuelles Stack-Produkt für Bearbeitung
      const response = await this.apiCall(`/stacks/${stackId}`)
      if (response.success) {
        const stackProdukt = response.data.produkte.find(item => 
          item.produkt.id === produktId
        )
        
        if (stackProdukt) {
          // Berechne die ursprüngliche Wirkstoff-Dosierung aus den Portionen zurück
          const portionen = stackProdukt.stack_produkt.dosierung
          const produktName = stackProdukt.produkt.name.toLowerCase()
          let originalWirkstoffDosierung = portionen
          
          // Rückrechnung basierend auf Produkttyp
          if (produktName.includes('vitamin d3') && 
              stackProdukt.produkt.form?.toLowerCase() === 'tropfen') {
            // 1 Tropfen = 10.000 IE
            originalWirkstoffDosierung = portionen * 10000
            this.modal.selectedUnit = 'IE'
          } 
          else if (produktName.includes('b12')) {
            // Extrahiere mcg pro Kapsel aus Produktname
            const mcgMatch = produktName.match(/(\d+)mcg/)
            const mcgProKapsel = mcgMatch ? parseInt(mcgMatch[1]) : 1000
            originalWirkstoffDosierung = portionen * mcgProKapsel
            this.modal.selectedUnit = 'μg'
          }
          else if (produktName.includes('magnesium')) {
            // Standard: 180-200mg pro Kapsel
            const mgProKapsel = produktName.includes('einzelkapsel') ? 180 : 200
            originalWirkstoffDosierung = portionen * mgProKapsel
            this.modal.selectedUnit = 'mg'
          }
          else {
            // Fallback: Portionen anzeigen
            this.modal.selectedUnit = 'Portionen'
          }
          
          // Öffne Modal mit vorausgefüllten Daten
          this.modal.isOpen = true
          this.modal.selectedProdukt = stackProdukt.produkt
          this.modal.dosierung = originalWirkstoffDosierung.toString()
          this.modal.selectedCategory = stackProdukt.stack_produkt.einnahmezeit || 'Basisausstattung'
          this.modal.notizen = stackProdukt.stack_produkt.notiz || ''
          this.modal.editMode = true
          this.modal.editStackId = stackId
          this.modal.editProduktId = produktId
          
          // Wichtig: Im Edit-Modus soll das Produkt vorausgewählt sein
          this.modal.mode = 'produkt'
          this.modal.searchResults = [stackProdukt.produkt]
          
          this.renderApp()
        }
      }
    } catch (error) {
      console.error('Edit stack product error:', error)
      this.showToast('Fehler beim Laden des Produkts', 'error')
    }
  }

  async removeFromStack(stackId, produktId) {
    if (!confirm('Möchten Sie dieses Supplement wirklich aus Ihrem Stack entfernen?')) {
      return
    }

    try {
      const response = await this.apiCall(`/stacks/${stackId}/produkte/${produktId}`, 'DELETE')
      
      if (response.success) {
        this.showToast('Supplement erfolgreich entfernt!', 'success')
        
        // Entferne das Produkt sofort aus der lokalen Liste (optimistische Update)
        if (this.currentStack && this.currentStack.produkte) {
          this.currentStack.produkte = this.currentStack.produkte.filter(item => 
            item.produkt.id !== produktId
          )
          
          // Berechne Gesamtpreis neu
          this.currentStack.gesamtpreis_monat = this.currentStack.produkte.reduce((sum, item) => 
            sum + (item.produkt.preis_pro_monat || 0), 0
          )
        }
        
        // Rendere sofort die aktualisierte Ansicht
        this.renderApp()
        
        // Optional: Lade Stack im Hintergrund neu um sicherzustellen, dass alles synchron ist
        // await this.loadStack(stackId)
      } else {
        this.showToast(response.error || 'Fehler beim Entfernen', 'error')
      }
    } catch (error) {
      console.error('Remove from stack error:', error)
      this.showToast('Fehler beim Entfernen', 'error')
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