// Supplement Stack - Demo App (Standalone, no backend required)
// Complete demo with inline data, nutrient analysis, and stack management

class DemoApp {
  constructor() {
    this.stacks = this.getDefaultStacks()
    this.currentStackId = null
    this.currentProducts = []
    this.init()
  }

  // ========================
  // INLINE DEMO DATA
  // ========================

  getDefaultStacks() {
    return [
      {
        id: 1,
        name: 'Grundausstattung',
        description: 'Basis-Supplements fuer den taeglichen Bedarf',
        products: [
          {
            id: 101, name: 'Vitamin D3 4000 IU', brand: 'Sunday Natural', form: 'Tropfen',
            purchase_price: 19.90, quantity: 180, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 1, name: 'Vitamin D3', amount_per_unit: 100, unit: '\u00b5g', dge_recommended: 20, max_safe_dose: 100, warning_threshold: 80 }
            ]
          },
          {
            id: 102, name: 'Magnesium Glycinat 400mg', brand: 'natural elements', form: 'Kapsel',
            purchase_price: 24.90, quantity: 180, dosage_per_day: 2,
            main_nutrients: [
              { nutrient_id: 2, name: 'Magnesium', amount_per_unit: 200, unit: 'mg', dge_recommended: 400, max_safe_dose: 800, warning_threshold: 600 }
            ]
          },
          {
            id: 103, name: 'Omega-3 Algenoel', brand: 'Norsan', form: 'Oel',
            purchase_price: 29.90, quantity: 100, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 3, name: 'EPA', amount_per_unit: 750, unit: 'mg', dge_recommended: 250, max_safe_dose: 3000, warning_threshold: 2000 },
              { nutrient_id: 4, name: 'DHA', amount_per_unit: 500, unit: 'mg', dge_recommended: 250, max_safe_dose: 3000, warning_threshold: 2000 }
            ]
          },
          {
            id: 104, name: 'Vitamin K2 MK7 200\u00b5g', brand: 'Sunday Natural', form: 'Tropfen',
            purchase_price: 24.90, quantity: 240, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 5, name: 'Vitamin K2', amount_per_unit: 200, unit: '\u00b5g', dge_recommended: 70, max_safe_dose: 1000, warning_threshold: 500 }
            ]
          }
        ]
      },
      {
        id: 2,
        name: 'Sport & Regeneration',
        description: 'Supplements fuer Sportler und Regeneration',
        products: [
          {
            id: 201, name: 'Creatin Monohydrat 5g', brand: 'ESN', form: 'Pulver',
            purchase_price: 29.90, quantity: 100, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 10, name: 'Creatin', amount_per_unit: 5000, unit: 'mg', dge_recommended: 3000, max_safe_dose: 10000, warning_threshold: 7000 }
            ]
          },
          {
            id: 202, name: 'Zink Bisglycinat 25mg', brand: 'natural elements', form: 'Tablette',
            purchase_price: 14.90, quantity: 365, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 6, name: 'Zink', amount_per_unit: 25, unit: 'mg', dge_recommended: 10, max_safe_dose: 40, warning_threshold: 30 }
            ]
          },
          {
            id: 203, name: 'B12 Methylcobalamin 1000\u00b5g', brand: 'Sunday Natural', form: 'Kapsel',
            purchase_price: 18.90, quantity: 120, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 7, name: 'Vitamin B12', amount_per_unit: 1000, unit: '\u00b5g', dge_recommended: 4, max_safe_dose: 5000, warning_threshold: 2000 }
            ]
          },
          {
            id: 204, name: 'Magnesium Glycinat 400mg', brand: 'natural elements', form: 'Kapsel',
            purchase_price: 24.90, quantity: 180, dosage_per_day: 2,
            main_nutrients: [
              { nutrient_id: 2, name: 'Magnesium', amount_per_unit: 200, unit: 'mg', dge_recommended: 400, max_safe_dose: 800, warning_threshold: 600 }
            ]
          },
          {
            id: 205, name: 'Vitamin C Acerola 1000mg', brand: 'Lebe Vital', form: 'Tablette',
            purchase_price: 12.90, quantity: 120, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 8, name: 'Vitamin C', amount_per_unit: 1000, unit: 'mg', dge_recommended: 110, max_safe_dose: 2000, warning_threshold: 1500 }
            ]
          }
        ]
      },
      {
        id: 3,
        name: 'Immunsystem',
        description: 'Gezielte Immunsystem-Unterstuetzung',
        products: [
          {
            id: 301, name: 'Vitamin D3 4000 IU', brand: 'Sunday Natural', form: 'Tropfen',
            purchase_price: 19.90, quantity: 180, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 1, name: 'Vitamin D3', amount_per_unit: 100, unit: '\u00b5g', dge_recommended: 20, max_safe_dose: 100, warning_threshold: 80 }
            ]
          },
          {
            id: 302, name: 'Zink Bisglycinat 25mg', brand: 'natural elements', form: 'Tablette',
            purchase_price: 14.90, quantity: 365, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 6, name: 'Zink', amount_per_unit: 25, unit: 'mg', dge_recommended: 10, max_safe_dose: 40, warning_threshold: 30 }
            ]
          },
          {
            id: 303, name: 'Vitamin C Acerola 1000mg', brand: 'Lebe Vital', form: 'Tablette',
            purchase_price: 12.90, quantity: 120, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 8, name: 'Vitamin C', amount_per_unit: 1000, unit: 'mg', dge_recommended: 110, max_safe_dose: 2000, warning_threshold: 1500 }
            ]
          },
          {
            id: 304, name: 'Selen 200\u00b5g', brand: 'Greenfood', form: 'Kapsel',
            purchase_price: 16.90, quantity: 180, dosage_per_day: 1,
            main_nutrients: [
              { nutrient_id: 9, name: 'Selen', amount_per_unit: 200, unit: '\u00b5g', dge_recommended: 70, max_safe_dose: 400, warning_threshold: 300 }
            ]
          }
        ]
      }
    ]
  }

  // ========================
  // INITIALIZATION
  // ========================

  init() {
    this.populateStackSelector()
    this.setupEventListeners()

    // Auto-select first stack
    if (this.stacks.length > 0) {
      const selector = document.getElementById('stack-selector')
      if (selector) {
        selector.value = this.stacks[0].id
        this.selectStack(this.stacks[0].id)
      }
    }
  }

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
    selector.innerHTML = '<option value="">Stack ausw\u00e4hlen...</option>' +
      this.stacks.map(s => `<option value="${s.id}">${this.esc(s.name)} (${s.products.length} Produkte)</option>`).join('')
  }

  selectStack(stackId) {
    this.currentStackId = stackId
    this.updateDeleteButton(true)
    const stack = this.stacks.find(s => s.id === stackId)
    if (!stack) return

    this.currentProducts = stack.products
    this.renderProducts(stack.products)
    this.renderNutrientOverview(stack.products)
    this.renderCostSummary(stack.products)
  }

  updateDeleteButton(enabled) {
    const btn = document.getElementById('btn-delete-stack')
    if (!btn) return
    btn.disabled = !enabled
    btn.className = enabled
      ? 'bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-medium shadow-sm cursor-pointer'
      : 'bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm cursor-not-allowed'
  }

  clearDisplay() {
    const grid = document.getElementById('stack-products-grid')
    if (grid) grid.innerHTML = '<div class="col-span-full text-center py-8"><i class="fas fa-box-open text-4xl text-gray-300 mb-4"></i><p class="text-gray-500">W\u00e4hlen Sie einen Stack aus</p></div>'
    document.getElementById('nutrient-overview').innerHTML = '<p class="text-gray-500 italic text-center py-8"><i class="fas fa-info-circle mr-2"></i>W\u00e4hlen Sie einen Stack aus, um die N\u00e4hrstoff-Analyse zu sehen</p>'
    document.getElementById('cost-section')?.remove()
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
        <p class="text-gray-400 text-sm mt-2">Klicken Sie "Produkt hinzuf\u00fcgen"</p>
      </div>`
      return
    }

    grid.innerHTML = products.map(p => {
      const dosage = p.dosage_per_day || 1
      const pricePerUnit = p.quantity > 0 ? p.purchase_price / p.quantity : 0
      const monthlyC = pricePerUnit * dosage * 30
      const daysSupply = dosage > 0 ? Math.floor(p.quantity / dosage) : p.quantity
      const nutrients = (p.main_nutrients || []).map(n => n.name).join(', ')

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
            <div class="font-bold text-gray-800 text-sm">${p.purchase_price.toFixed(2)}&euro;</div>
          </div>
          <div class="bg-emerald-50 rounded-lg p-2 text-center">
            <div class="text-[10px] text-emerald-600">/Monat</div>
            <div class="font-bold text-emerald-700 text-sm">${monthlyC.toFixed(2)}&euro;</div>
          </div>
          <div class="bg-blue-50 rounded-lg p-2 text-center">
            <div class="text-[10px] text-blue-600">Tage</div>
            <div class="font-bold text-blue-700 text-sm">${daysSupply}</div>
          </div>
        </div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs text-gray-500">Dosierung:</span>
          <div class="flex items-center gap-1">
            <button onclick="window.demoApp?.changeDosage(${p.id}, ${dosage - 1})" class="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs flex items-center justify-center" ${dosage <= 1 ? 'disabled' : ''}>-</button>
            <span class="text-sm font-bold text-gray-800 w-8 text-center">${dosage}x</span>
            <button onclick="window.demoApp?.changeDosage(${p.id}, ${dosage + 1})" class="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs flex items-center justify-center">+</button>
          </div>
        </div>
        <button onclick="window.demoApp?.removeProduct(${p.id})" class="w-full bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 text-xs font-medium transition-colors">
          <i class="fas fa-trash mr-1"></i>Entfernen
        </button>
      </div>`
    }).join('')
  }

  // ========================
  // RENDER: NUTRIENT OVERVIEW
  // ========================

  renderNutrientOverview(products) {
    const container = document.getElementById('nutrient-overview')
    if (!container) return

    // Aggregate nutrients across all products (multiply by dosage)
    const nutrientMap = new Map()
    products.forEach(p => {
      const dosage = p.dosage_per_day || 1
      ;(p.main_nutrients || []).forEach(n => {
        const key = n.nutrient_id || n.name
        const existing = nutrientMap.get(key) || {
          name: n.name, amount: 0, unit: n.unit || 'mg',
          dge: n.dge_recommended, max_safe: n.max_safe_dose, warning: n.warning_threshold
        }
        existing.amount += (n.amount_per_unit || 0) * dosage
        nutrientMap.set(key, existing)
      })
    })

    if (nutrientMap.size === 0) {
      container.innerHTML = '<p class="col-span-full text-gray-500 text-center py-4"><i class="fas fa-info-circle mr-2"></i>Keine N\u00e4hrstoffdaten verf\u00fcgbar</p>'
      return
    }

    container.innerHTML = Array.from(nutrientMap.values()).map(n => {
      const pct = n.dge ? Math.min(200, (n.amount / n.dge) * 100) : 50
      let level = 'safe', levelLabel = 'Optimal', levelColor = 'text-green-600'

      if (n.max_safe && n.amount > n.max_safe) {
        level = 'danger'; levelLabel = 'Zu hoch!'; levelColor = 'text-red-600'
      } else if (n.warning && n.amount > n.warning) {
        level = 'warning'; levelLabel = 'Erh\u00f6ht'; levelColor = 'text-orange-600'
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
          <span class="text-sm font-bold text-blue-600">${this.fmtAmt(n.amount)} ${this.esc(n.unit)}</span>
          ${n.dge ? `<span class="text-xs text-gray-400">DGE: ${this.fmtAmt(n.dge)} ${this.esc(n.unit)}</span>` : ''}
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
    const nutrientSection = document.getElementById('nutrient-overview')?.closest('.bg-white')
    if (!costSection && nutrientSection) {
      costSection = document.createElement('div')
      costSection.id = 'cost-section'
      costSection.className = 'bg-white rounded-lg shadow-md p-6 mb-8'
      nutrientSection.parentNode.insertBefore(costSection, nutrientSection)
    }
    if (!costSection) return

    const dailyCost = products.reduce((sum, p) => {
      const pricePerUnit = p.quantity > 0 ? p.purchase_price / p.quantity : 0
      return sum + pricePerUnit * (p.dosage_per_day || 1)
    }, 0)
    const monthlyCost = dailyCost * 30
    const yearlyCost = dailyCost * 365

    costSection.innerHTML = `
      <h2 class="text-2xl font-bold text-gray-900 mb-4"><i class="fas fa-calculator mr-2 text-emerald-600"></i>Kosten\u00fcbersicht</h2>
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

  // ========================
  // INTERACTIVE ACTIONS
  // ========================

  changeDosage(productId, newDosage) {
    if (newDosage < 1) return
    const stack = this.stacks.find(s => s.id === this.currentStackId)
    if (!stack) return
    const product = stack.products.find(p => p.id === productId)
    if (product) {
      product.dosage_per_day = newDosage
      this.renderProducts(stack.products)
      this.renderNutrientOverview(stack.products)
      this.renderCostSummary(stack.products)
      this.notify('Dosierung aktualisiert', 'success')
    }
  }

  removeProduct(productId) {
    const stack = this.stacks.find(s => s.id === this.currentStackId)
    if (!stack) return
    stack.products = stack.products.filter(p => p.id !== productId)
    this.populateStackSelector()
    document.getElementById('stack-selector').value = this.currentStackId
    this.renderProducts(stack.products)
    this.renderNutrientOverview(stack.products)
    this.renderCostSummary(stack.products)
    this.notify('Produkt entfernt', 'success')
  }

  deleteCurrentStack() {
    if (!this.currentStackId) return
    const stack = this.stacks.find(s => s.id === this.currentStackId)
    if (!confirm(`Stack "${stack?.name}" wirklich l\u00f6schen?`)) return

    this.stacks = this.stacks.filter(s => s.id !== this.currentStackId)
    this.currentStackId = null
    this.populateStackSelector()
    this.clearDisplay()
    this.updateDeleteButton(false)
    this.notify('Stack gel\u00f6scht (Demo)', 'success')
  }

  // ========================
  // MODALS
  // ========================

  showAddProductModal() {
    document.getElementById('modal-overlay')?.remove()
    const html = `
    <div id="modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-backdrop fade-in" onclick="if(event.target===this)this.remove()">
      <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 slide-up">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold"><i class="fas fa-plus text-green-600 mr-2"></i>Produkt hinzuf\u00fcgen (Demo)</h2>
          <button onclick="document.getElementById('modal-overlay').remove()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times text-xl"></i></button>
        </div>
        <form id="demo-add-product-form" class="space-y-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Name *</label><input name="name" required class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="z.B. Vitamin D3 4000 IU"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Marke</label><input name="brand" class="w-full px-3 py-2 border rounded-md" placeholder="z.B. Sunday Natural"></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Form</label><select name="form" class="w-full px-3 py-2 border rounded-md"><option>Kapsel</option><option>Tablette</option><option>Tropfen</option><option>Pulver</option><option>Oel</option><option>Fluessig</option></select></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Preis (&euro;)</label><input name="price" type="number" step="0.01" min="0" class="w-full px-3 py-2 border rounded-md" placeholder="19.90"></div>
          </div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Einheiten pro Packung</label><input name="quantity" type="number" min="1" class="w-full px-3 py-2 border rounded-md" placeholder="60" value="60"></div>
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p class="text-xs text-yellow-700"><i class="fas fa-info-circle mr-1"></i>In der Demo werden keine N\u00e4hrstoffwerte berechnet. Registrieren Sie sich f\u00fcr die volle Funktionalit\u00e4t!</p>
          </div>
          <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-medium transition-colors"><i class="fas fa-plus mr-2"></i>Produkt hinzuf\u00fcgen</button>
        </form>
      </div>
    </div>`
    document.body.insertAdjacentHTML('beforeend', html)

    document.getElementById('demo-add-product-form').addEventListener('submit', (e) => {
      e.preventDefault()
      const f = e.target
      const stack = this.stacks.find(s => s.id === this.currentStackId)
      if (!stack) { this.notify('Bitte w\u00e4hlen Sie zuerst einen Stack', 'error'); return }

      const newProduct = {
        id: Date.now(),
        name: f.name.value,
        brand: f.brand.value || 'Unbekannt',
        form: f.form.value,
        purchase_price: parseFloat(f.price.value) || 0,
        quantity: parseInt(f.quantity.value) || 60,
        dosage_per_day: 1,
        main_nutrients: []
      }
      stack.products.push(newProduct)
      this.populateStackSelector()
      document.getElementById('stack-selector').value = this.currentStackId
      this.selectStack(this.currentStackId)
      document.getElementById('modal-overlay')?.remove()
      this.notify('Produkt hinzugef\u00fcgt (Demo)', 'success')
    })
  }

  showCreateStackModal() {
    document.getElementById('modal-overlay')?.remove()
    const html = `
    <div id="modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-backdrop fade-in" onclick="if(event.target===this)this.remove()">
      <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 slide-up">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold"><i class="fas fa-magic text-purple-600 mr-2"></i>Stack erstellen (Demo)</h2>
          <button onclick="document.getElementById('modal-overlay').remove()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times text-xl"></i></button>
        </div>
        <form id="demo-create-stack-form" class="space-y-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Name *</label><input name="name" required class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500" placeholder="z.B. Mein Stack"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label><textarea name="description" rows="2" class="w-full px-3 py-2 border rounded-md" placeholder="Optional..."></textarea></div>
          <button type="submit" class="w-full bg-purple-600 text-white py-3 rounded-md hover:bg-purple-700 font-medium transition-colors"><i class="fas fa-magic mr-2"></i>Stack erstellen</button>
        </form>
      </div>
    </div>`
    document.body.insertAdjacentHTML('beforeend', html)

    document.getElementById('demo-create-stack-form').addEventListener('submit', (e) => {
      e.preventDefault()
      const newStack = {
        id: Date.now(),
        name: e.target.name.value,
        description: e.target.description.value || '',
        products: []
      }
      this.stacks.push(newStack)
      this.populateStackSelector()
      document.getElementById('stack-selector').value = newStack.id
      this.selectStack(newStack.id)
      document.getElementById('modal-overlay')?.remove()
      this.notify('Stack erstellt (Demo)', 'success')
    })
  }

  // ========================
  // UTILITIES
  // ========================

  fmtAmt(num) {
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
  window.demoApp = new DemoApp()
})
