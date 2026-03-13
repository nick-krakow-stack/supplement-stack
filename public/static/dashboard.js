// Supplement Stack - Dashboard (Authenticated)
// Full-featured dashboard with nutrient analysis, cost calculation, and stack management

class DashboardApp {
  constructor() {
    this.products = []
    this.stacks = []
    this.currentStackId = null
    this.currentStackProducts = []
    this.nutrients = []
    this.init()
  }

  async init() {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      this.showAuthRequired()
      return
    }

    try {
      // Load data in parallel
      const [stacksRes, productsRes, nutrientsRes] = await Promise.all([
        SupplementApp.api('/api/protected/stacks'),
        SupplementApp.api('/api/protected/products'),
        SupplementApp.api('/api/nutrients').catch(() => ({ data: [] }))
      ])

      this.stacks = stacksRes.data || []
      this.products = productsRes.data || []
      this.nutrients = nutrientsRes.data || []

      document.getElementById('dashboard-loading')?.classList.add('hidden')
      document.getElementById('dashboard-content')?.classList.remove('hidden')

      this.populateStackSelector()
      this.setupEventListeners()
      this.renderStats()

      // Auto-select first stack
      if (this.stacks.length > 0) {
        const selector = document.getElementById('stack-selector')
        if (selector) {
          selector.value = this.stacks[0].id
          this.selectStack(this.stacks[0].id)
        }
      }
    } catch (err) {
      console.error('Dashboard init error:', err)
      this.showAuthRequired()
    }
  }

  showAuthRequired() {
    document.getElementById('dashboard-loading')?.classList.add('hidden')
    document.getElementById('dashboard-auth-required')?.classList.remove('hidden')
  }

  // ========================
  // EVENT LISTENERS
  // ========================

  setupEventListeners() {
    document.getElementById('stack-selector')?.addEventListener('change', (e) => {
      const stackId = e.target.value
      this.updateDeleteButton(!!stackId)
      if (stackId) this.selectStack(parseInt(stackId))
      else this.clearDisplay()
    })

    document.getElementById('btn-add-product')?.addEventListener('click', () => this.showAddProductModal())
    document.getElementById('btn-create-stack')?.addEventListener('click', () => this.showCreateStackModal())
    document.getElementById('btn-delete-stack')?.addEventListener('click', () => this.deleteCurrentStack())
  }

  // ========================
  // STACK OPERATIONS
  // ========================

  populateStackSelector() {
    const selector = document.getElementById('stack-selector')
    if (!selector) return
    selector.innerHTML = '<option value="">Stack auswählen...</option>' +
      this.stacks.map(s => `<option value="${s.id}">${this.esc(s.name)} (${s.products?.length || 0} Produkte)</option>`).join('')
  }

  async selectStack(stackId) {
    this.currentStackId = stackId
    this.updateDeleteButton(true)

    try {
      // Load full stack details with nutrient data from API
      const res = await SupplementApp.api(`/api/protected/stacks/${stackId}`)
      const stack = res.data
      if (!stack) return

      this.currentStackProducts = stack.products || []
      this.renderProducts(this.currentStackProducts)
      this.renderNutrientOverview(this.currentStackProducts)
      this.renderCostSummary(this.currentStackProducts)

      document.getElementById('nutrient-section')?.classList.remove('hidden')
    } catch (err) {
      // Fallback: use local data
      const stack = this.stacks.find(s => s.id == stackId)
      if (!stack) return
      const stackProducts = (stack.products || [])
        .map(pid => this.products.find(p => p.id == pid))
        .filter(Boolean)
      this.currentStackProducts = stackProducts
      this.renderProducts(stackProducts)
      this.renderNutrientOverview(stackProducts)
      this.renderCostSummary(stackProducts)
      document.getElementById('nutrient-section')?.classList.remove('hidden')
    }
  }

  updateDeleteButton(enabled) {
    const btn = document.getElementById('btn-delete-stack')
    if (!btn) return
    btn.disabled = !enabled
    btn.className = enabled
      ? 'bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-medium shadow-sm cursor-pointer'
      : 'bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm cursor-not-allowed'
  }

  // ========================
  // RENDER: PRODUCTS
  // ========================

  renderProducts(products) {
    const grid = document.getElementById('stack-products-grid')
    if (!grid) return

    if (products.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-12">
        <i class="fas fa-box-open text-5xl text-gray-300 mb-4"></i>
        <p class="text-gray-500 text-lg">Keine Produkte in diesem Stack</p>
        <p class="text-gray-400 text-sm mt-2">Klicken Sie "Produkt hinzufügen" um zu beginnen</p>
      </div>`
      return
    }

    grid.innerHTML = products.map(p => {
      const dosage = p.dosage_per_day || 1
      const monthlyC = p.monthly_cost || 0
      const nutrients = (p.main_nutrients || []).map(n => n.name).join(', ')
      const daysLeft = p.days_supply || 0

      return `
      <div class="bg-white border rounded-xl p-5 shadow-md hover:shadow-lg transition-all relative fade-in">
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-t-xl"></div>
        <div class="flex items-center mb-3 mt-1">
          <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-center mr-3 flex-shrink-0">
            <i class="fas fa-pills text-emerald-500"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-gray-800 text-sm truncate">${this.esc(p.name)}</h3>
            <p class="text-xs text-gray-500">${this.esc(p.brand || '')}</p>
          </div>
        </div>
        ${nutrients ? `<p class="text-xs text-blue-600 mb-3 truncate"><i class="fas fa-dna mr-1"></i>${this.esc(nutrients)}</p>` : ''}
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="bg-gray-50 rounded-lg p-2 text-center">
            <div class="text-[10px] text-gray-500">Preis</div>
            <div class="font-bold text-gray-800 text-sm">${(p.purchase_price || 0).toFixed(2)}&euro;</div>
          </div>
          <div class="bg-emerald-50 rounded-lg p-2 text-center">
            <div class="text-[10px] text-emerald-600">/Monat</div>
            <div class="font-bold text-emerald-700 text-sm">${monthlyC.toFixed(2)}&euro;</div>
          </div>
          <div class="bg-blue-50 rounded-lg p-2 text-center">
            <div class="text-[10px] text-blue-600">Tage</div>
            <div class="font-bold text-blue-700 text-sm">${daysLeft}</div>
          </div>
        </div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs text-gray-500">Dosierung:</span>
          <div class="flex items-center gap-1">
            <button onclick="window.dashboardApp?.changeDosage(${p.id}, ${dosage - 1})" class="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs flex items-center justify-center" ${dosage <= 1 ? 'disabled' : ''}>-</button>
            <span class="text-sm font-bold text-gray-800 w-8 text-center">${dosage}x</span>
            <button onclick="window.dashboardApp?.changeDosage(${p.id}, ${dosage + 1})" class="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs flex items-center justify-center">+</button>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="window.dashboardApp?.removeProductFromStack(${p.id})" class="flex-1 bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 text-xs font-medium transition-colors">
            <i class="fas fa-trash mr-1"></i>Entfernen
          </button>
          ${p.shop_url ? `<a href="${p.shop_url}" target="_blank" rel="noopener" class="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-100 text-xs font-medium text-center transition-colors"><i class="fas fa-external-link-alt mr-1"></i>Shop</a>` : ''}
        </div>
      </div>`
    }).join('')
  }

  // ========================
  // RENDER: NUTRIENT OVERVIEW with DGE reference
  // ========================

  renderNutrientOverview(products) {
    const container = document.getElementById('nutrient-overview')
    if (!container) return

    // Aggregate nutrients with dosage multiplier
    const nutrientMap = new Map()
    products.forEach(p => {
      const dosage = p.dosage_per_day || 1
      ;(p.main_nutrients || []).forEach(n => {
        const key = n.nutrient_id || n.name
        const existing = nutrientMap.get(key) || {
          name: n.name,
          amount: 0,
          unit: n.unit || 'mg',
          dge: n.dge_recommended || null,
          max_safe: n.max_safe_dose || null,
          warning: n.warning_threshold || null
        }
        existing.amount += (n.amount_per_unit || 0) * dosage
        // Take the best reference values
        if (n.dge_recommended && !existing.dge) existing.dge = n.dge_recommended
        if (n.max_safe_dose && !existing.max_safe) existing.max_safe = n.max_safe_dose
        if (n.warning_threshold && !existing.warning) existing.warning = n.warning_threshold
        nutrientMap.set(key, existing)
      })
    })

    // Also try to get reference values from loaded nutrients
    nutrientMap.forEach((val, key) => {
      if (!val.dge) {
        const ref = this.nutrients.find(n => n.id == key || n.name === val.name)
        if (ref) {
          val.dge = ref.dge_recommended
          val.max_safe = ref.max_safe_dose
          val.warning = ref.warning_threshold
        }
      }
    })

    if (nutrientMap.size === 0) {
      container.innerHTML = '<p class="col-span-full text-gray-500 text-center py-4"><i class="fas fa-info-circle mr-2"></i>Keine Nährstoffdaten verfügbar</p>'
      return
    }

    container.innerHTML = Array.from(nutrientMap.values()).map(n => {
      const pct = n.dge ? Math.min(200, (n.amount / n.dge) * 100) : 50
      let level = 'safe'
      let levelLabel = 'Optimal'
      let levelColor = 'text-green-600'

      if (n.max_safe && n.amount > n.max_safe) {
        level = 'danger'; levelLabel = 'Zu hoch!'; levelColor = 'text-red-600'
      } else if (n.warning && n.amount > n.warning) {
        level = 'warning'; levelLabel = 'Erhöht'; levelColor = 'text-orange-600'
      } else if (n.dge && n.amount > n.dge * 1.5) {
        level = 'caution'; levelLabel = 'Hoch'; levelColor = 'text-yellow-600'
      } else if (n.dge && n.amount < n.dge * 0.5) {
        level = 'caution'; levelLabel = 'Niedrig'; levelColor = 'text-yellow-600'
      }

      const barWidth = n.dge ? Math.min(100, (n.amount / (n.max_safe || n.dge * 3)) * 100) : 30

      return `
      <div class="bg-gray-50 rounded-lg p-4 border hover:border-blue-300 transition-colors">
        <div class="flex justify-between items-center mb-1">
          <span class="font-medium text-gray-800 text-sm">${this.esc(n.name)}</span>
          <span class="text-xs font-bold ${levelColor}">${levelLabel}</span>
        </div>
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-bold text-blue-600">${this.formatAmount(n.amount)} ${this.esc(n.unit)}</span>
          ${n.dge ? `<span class="text-xs text-gray-400">DGE: ${this.formatAmount(n.dge)} ${this.esc(n.unit)}</span>` : ''}
        </div>
        <div class="nutrient-bar">
          <div class="nutrient-progress ${level}" style="width: ${barWidth}%"></div>
        </div>
        ${n.dge ? `<div class="text-xs text-gray-400 mt-1">${Math.round(pct)}% der DGE-Empfehlung</div>` : ''}
      </div>`
    }).join('')
  }

  // ========================
  // RENDER: COST SUMMARY
  // ========================

  renderCostSummary(products) {
    let costSection = document.getElementById('cost-section')
    if (!costSection) {
      // Create cost section if not exists
      const nutrientSection = document.getElementById('nutrient-section')
      if (nutrientSection) {
        costSection = document.createElement('div')
        costSection.id = 'cost-section'
        costSection.className = 'bg-white rounded-lg shadow-md p-6 mb-8'
        nutrientSection.parentNode.insertBefore(costSection, nutrientSection)
      } else return
    }

    const dailyCost = products.reduce((sum, p) => {
      const servings = p.quantity || p.servings_per_package || 1
      const price = p.purchase_price || p.price_per_package || 0
      const dosage = p.dosage_per_day || 1
      return sum + (servings > 0 ? (price / servings) * dosage : 0)
    }, 0)

    const monthlyCost = dailyCost * 30
    const yearlyCost = dailyCost * 365

    costSection.innerHTML = `
      <h2 class="text-2xl font-bold text-gray-900 mb-4"><i class="fas fa-calculator mr-2 text-emerald-600"></i>Kostenübersicht</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-200">
          <div class="text-sm text-emerald-600 mb-1">Pro Tag</div>
          <div class="text-2xl font-bold text-emerald-700">${dailyCost.toFixed(2)} &euro;</div>
        </div>
        <div class="bg-blue-50 rounded-xl p-4 text-center border border-blue-200">
          <div class="text-sm text-blue-600 mb-1">Pro Monat</div>
          <div class="text-2xl font-bold text-blue-700">${monthlyCost.toFixed(2)} &euro;</div>
        </div>
        <div class="bg-purple-50 rounded-xl p-4 text-center border border-purple-200">
          <div class="text-sm text-purple-600 mb-1">Pro Jahr</div>
          <div class="text-2xl font-bold text-purple-700">${yearlyCost.toFixed(2)} &euro;</div>
        </div>
      </div>
      <p class="text-xs text-gray-400 mt-3 text-center">${products.length} Produkte im Stack</p>`
  }

  renderStats() {
    // Quick stats overview at the top
    const content = document.getElementById('dashboard-content')
    if (!content) return
    const statsDiv = document.createElement('div')
    statsDiv.className = 'grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8'
    statsDiv.innerHTML = `
      <div class="bg-white rounded-lg shadow-sm p-4 text-center border">
        <div class="text-3xl font-bold text-blue-600">${this.stacks.length}</div>
        <div class="text-sm text-gray-500">Stacks</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-4 text-center border">
        <div class="text-3xl font-bold text-emerald-600">${this.products.length}</div>
        <div class="text-sm text-gray-500">Produkte</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-4 text-center border">
        <div class="text-3xl font-bold text-purple-600">${this.nutrients.length}</div>
        <div class="text-sm text-gray-500">Nährstoffe</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-4 text-center border">
        <div class="text-3xl font-bold text-orange-600">${this.stacks.reduce((sum, s) => sum + (s.products?.length || 0), 0)}</div>
        <div class="text-sm text-gray-500">Im Stack</div>
      </div>`
    const heading = content.querySelector('.text-center.mb-8')
    if (heading) heading.after(statsDiv)
  }

  clearDisplay() {
    const grid = document.getElementById('stack-products-grid')
    if (grid) grid.innerHTML = '<div class="col-span-full text-center py-8"><i class="fas fa-box-open text-4xl text-gray-300 mb-4"></i><p class="text-gray-500">Wählen Sie einen Stack aus</p></div>'
    document.getElementById('nutrient-section')?.classList.add('hidden')
    document.getElementById('cost-section')?.remove()
  }

  // ========================
  // MODALS
  // ========================

  showAddProductModal() {
    const stackId = this.currentStackId
    document.getElementById('modal-overlay')?.remove()
    const html = `
    <div id="modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-backdrop fade-in" onclick="if(event.target===this)this.remove()">
      <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 slide-up">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold"><i class="fas fa-plus text-green-600 mr-2"></i>Produkt hinzufügen</h2>
          <button onclick="document.getElementById('modal-overlay').remove()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times text-xl"></i></button>
        </div>
        <form id="add-product-form" class="space-y-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Name *</label><input name="name" required class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="z.B. Vitamin D3 4000 IU"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Marke</label><input name="brand" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500" placeholder="z.B. Sunday Natural"></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Form</label><select name="form" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"><option>Kapsel</option><option>Tablette</option><option>Tropfen</option><option>Pulver</option><option>Öl</option><option>Flüssig</option></select></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Preis (&euro;)</label><input name="purchase_price" type="number" step="0.01" min="0" class="w-full px-3 py-2 border rounded-md" placeholder="19.90"></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Einheiten/Packung</label><input name="quantity" type="number" min="1" class="w-full px-3 py-2 border rounded-md" placeholder="60" value="60"></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Shop-URL</label><input name="shop_url" type="url" class="w-full px-3 py-2 border rounded-md" placeholder="https://..."></div>
          </div>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p class="text-xs text-blue-700"><i class="fas fa-info-circle mr-1"></i>Nährstoffe können nach dem Erstellen über das Produktdetail hinzugefügt werden.</p>
          </div>
          <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-medium transition-colors"><i class="fas fa-plus mr-2"></i>Produkt speichern${stackId ? ' & zum Stack hinzufügen' : ''}</button>
        </form>
      </div>
    </div>`
    document.body.insertAdjacentHTML('beforeend', html)

    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const f = e.target
      const data = { name: f.name.value, brand: f.brand.value, form: f.form.value, purchase_price: parseFloat(f.purchase_price.value) || 0, quantity: parseInt(f.quantity.value) || 30, shop_url: f.shop_url.value }

      try {
        const res = await SupplementApp.api('/api/protected/products', { method: 'POST', body: JSON.stringify(data) })
        if (res.data) this.products.push(res.data)

        if (stackId && res.data?.id) {
          await SupplementApp.api(`/api/protected/stacks/${stackId}/products`, { method: 'POST', body: JSON.stringify({ productId: res.data.id }) })
          const stack = this.stacks.find(s => s.id == stackId)
          if (stack) { if (!stack.products) stack.products = []; stack.products.push(res.data.id) }
          this.populateStackSelector()
          this.selectStack(stackId)
        }
        document.getElementById('modal-overlay')?.remove()
        this.notify('Produkt erfolgreich hinzugefügt!', 'success')
      } catch (err) { this.notify('Fehler: ' + err.message, 'error') }
    })
  }

  showCreateStackModal() {
    document.getElementById('modal-overlay')?.remove()
    const html = `
    <div id="modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-backdrop fade-in" onclick="if(event.target===this)this.remove()">
      <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 slide-up">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold"><i class="fas fa-magic text-purple-600 mr-2"></i>Stack erstellen</h2>
          <button onclick="document.getElementById('modal-overlay').remove()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times text-xl"></i></button>
        </div>
        <form id="create-stack-form" class="space-y-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Name *</label><input name="name" required class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500" placeholder="z.B. Grundausstattung"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label><textarea name="description" rows="2" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500" placeholder="Optional..."></textarea></div>
          <button type="submit" class="w-full bg-purple-600 text-white py-3 rounded-md hover:bg-purple-700 font-medium transition-colors"><i class="fas fa-magic mr-2"></i>Stack erstellen</button>
        </form>
      </div>
    </div>`
    document.body.insertAdjacentHTML('beforeend', html)

    document.getElementById('create-stack-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const data = { name: e.target.name.value, description: e.target.description.value }
      try {
        const res = await SupplementApp.api('/api/protected/stacks', { method: 'POST', body: JSON.stringify(data) })
        if (res.data) {
          this.stacks.push(res.data)
          this.populateStackSelector()
          const selector = document.getElementById('stack-selector')
          if (selector) { selector.value = res.data.id; this.selectStack(res.data.id) }
        }
        document.getElementById('modal-overlay')?.remove()
        this.notify('Stack erstellt!', 'success')
      } catch (err) { this.notify('Fehler: ' + err.message, 'error') }
    })
  }

  async deleteCurrentStack() {
    if (!this.currentStackId) return
    const stack = this.stacks.find(s => s.id == this.currentStackId)
    if (!confirm(`Stack "${stack?.name}" wirklich löschen? Alle Zuordnungen gehen verloren.`)) return

    try {
      await SupplementApp.api(`/api/protected/stacks/${this.currentStackId}`, { method: 'DELETE' })
      this.stacks = this.stacks.filter(s => s.id != this.currentStackId)
      this.currentStackId = null
      this.populateStackSelector()
      this.clearDisplay()
      this.updateDeleteButton(false)
      this.notify('Stack gelöscht', 'success')
    } catch (err) { this.notify('Fehler: ' + err.message, 'error') }
  }

  async removeProductFromStack(productId) {
    if (!this.currentStackId) return
    if (!confirm('Produkt aus Stack entfernen?')) return
    try {
      await SupplementApp.api(`/api/protected/stacks/${this.currentStackId}/products/${productId}`, { method: 'DELETE' })
      const stack = this.stacks.find(s => s.id == this.currentStackId)
      if (stack) stack.products = (stack.products || []).filter(pid => pid != productId)
      this.populateStackSelector()
      this.selectStack(this.currentStackId)
      this.notify('Produkt entfernt', 'success')
    } catch (err) { this.notify('Fehler: ' + err.message, 'error') }
  }

  async changeDosage(productId, newDosage) {
    if (!this.currentStackId || newDosage < 1) return
    try {
      await SupplementApp.api(`/api/protected/stacks/${this.currentStackId}/products/${productId}`, {
        method: 'PUT', body: JSON.stringify({ dosagePerDay: newDosage })
      })
      this.selectStack(this.currentStackId)
    } catch (err) { this.notify('Fehler: ' + err.message, 'error') }
  }

  // ========================
  // UTILITIES
  // ========================

  formatAmount(num) {
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    if (num >= 100) return Math.round(num).toString()
    if (num >= 1) return num.toFixed(1).replace(/\.0$/, '')
    return num.toFixed(2)
  }

  notify(message, type = 'info') {
    const colors = { success: 'from-emerald-500 to-teal-500', error: 'from-red-500 to-pink-500', info: 'from-blue-500 to-indigo-500' }
    const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' }
    const el = document.createElement('div')
    el.className = `fixed top-4 right-4 z-[60] px-5 py-3 rounded-xl shadow-xl text-white text-sm font-semibold bg-gradient-to-r ${colors[type] || colors.info} toast-enter`
    el.innerHTML = `<i class="fas fa-${icons[type] || icons.info} mr-2"></i>${message}`
    document.body.appendChild(el)
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300) }, 3000)
  }

  esc(str) {
    if (!str) return ''
    const d = document.createElement('div')
    d.textContent = str
    return d.innerHTML
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardApp = new DashboardApp()
})
