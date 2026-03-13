// Supplement Stack - Auth Frontend (Unified)
// Handles: login, register, forgot password, reset password

class AuthSystem {
  constructor() {
    this.init()
  }

  init() {
    this.setupEventListeners()
  }

  setupEventListeners() {
    const registerForm = document.getElementById('registerForm')
    if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e))

    const loginForm = document.getElementById('loginForm')
    if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e))

    const forgotForm = document.getElementById('forgotPasswordForm')
    if (forgotForm) forgotForm.addEventListener('submit', (e) => this.handleForgotPassword(e))

    const resetForm = document.getElementById('resetPasswordForm')
    if (resetForm) resetForm.addEventListener('submit', (e) => this.handleResetPassword(e))

    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault()
        this.switchToTab(e.target.dataset.tab)
      })
    })
  }

  async handleRegister(e) {
    e.preventDefault()
    const form = e.target
    const data = {
      email: form.querySelector('[name="email"]').value,
      password: form.querySelector('[name="password"]').value,
      confirmPassword: form.querySelector('[name="confirmPassword"]').value
    }

    try {
      this.setLoading('registerBtn', true)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()

      if (res.ok && result.success) {
        this.showMessage('Registrierung erfolgreich! Bitte überprüfen Sie Ihre E-Mails.', 'success')
        form.reset()
        this.switchToTab('login')
      } else {
        this.showMessage(result.message || 'Registrierung fehlgeschlagen', 'error')
      }
    } catch {
      this.showMessage('Netzwerkfehler bei der Registrierung', 'error')
    } finally {
      this.setLoading('registerBtn', false)
    }
  }

  async handleLogin(e) {
    e.preventDefault()
    const form = e.target
    const data = {
      email: form.querySelector('[name="email"]').value,
      password: form.querySelector('[name="password"]').value
    }

    try {
      this.setLoading('loginBtn', true)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()

      if (res.ok && result.success && result.data?.token) {
        // Store token in localStorage (cookie is also set by server)
        localStorage.setItem('auth_token', result.data.token)
        localStorage.setItem('user', JSON.stringify(result.data.user))

        this.showMessage('Anmeldung erfolgreich! Weiterleitung...', 'success')
        setTimeout(() => { window.location.href = '/dashboard' }, 800)
      } else {
        this.showMessage(result.message || 'Anmeldung fehlgeschlagen', 'error')
      }
    } catch {
      this.showMessage('Netzwerkfehler bei der Anmeldung', 'error')
    } finally {
      this.setLoading('loginBtn', false)
    }
  }

  async handleForgotPassword(e) {
    e.preventDefault()
    const data = { email: e.target.querySelector('[name="email"]').value }

    try {
      this.setLoading('forgotBtn', true)
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()
      this.showMessage(result.message || 'Falls ein Konto existiert, wurde ein Link gesendet.', 'success')
      e.target.reset()
    } catch {
      this.showMessage('Netzwerkfehler', 'error')
    } finally {
      this.setLoading('forgotBtn', false)
    }
  }

  async handleResetPassword(e) {
    e.preventDefault()
    const token = new URLSearchParams(window.location.search).get('token')
    const data = {
      token,
      password: e.target.querySelector('[name="password"]').value,
      confirmPassword: e.target.querySelector('[name="confirmPassword"]').value
    }

    try {
      this.setLoading('resetBtn', true)
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()

      if (res.ok && result.success) {
        this.showMessage('Passwort geändert! Sie können sich jetzt anmelden.', 'success')
        setTimeout(() => { window.location.href = '/auth' }, 2000)
      } else {
        this.showMessage(result.message || 'Passwort-Reset fehlgeschlagen', 'error')
      }
    } catch {
      this.showMessage('Netzwerkfehler', 'error')
    } finally {
      this.setLoading('resetBtn', false)
    }
  }

  switchToTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'))
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'))

    const target = document.getElementById(`${tabName}Tab`)
    if (target) target.classList.remove('hidden')

    const btn = document.querySelector(`[data-tab="${tabName}"]`)
    if (btn) btn.classList.add('active')
  }

  showMessage(text, type = 'info') {
    const container = document.getElementById('auth-message') || document.querySelector('.auth-container')
    if (!container) return

    const msgEl = document.getElementById('auth-message')
    if (msgEl) {
      const colors = {
        success: 'bg-green-100 text-green-700 border-green-300',
        error: 'bg-red-100 text-red-700 border-red-300',
        info: 'bg-blue-100 text-blue-700 border-blue-300'
      }
      msgEl.className = `p-3 rounded-md border text-sm mb-4 ${colors[type] || colors.info}`
      msgEl.textContent = text
      msgEl.classList.remove('hidden')
      setTimeout(() => msgEl.classList.add('hidden'), 6000)
    }
  }

  setLoading(btnId, loading) {
    const btn = document.getElementById(btnId)
    if (!btn) return
    if (loading) {
      btn.disabled = true
      btn._origText = btn.textContent
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Laden...'
    } else {
      btn.disabled = false
      btn.textContent = btn._origText || btn.textContent
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => new AuthSystem())
