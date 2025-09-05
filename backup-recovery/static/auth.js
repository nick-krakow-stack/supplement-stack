// Authentication frontend functionality
class AuthSystem {
  constructor() {
    this.baseUrl = '';
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkAuthStatus();
  }

  setupEventListeners() {
    // Registration form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Forgot password form
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
      forgotForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
    }

    // Reset password form
    const resetForm = document.getElementById('resetPasswordForm');
    if (resetForm) {
      resetForm.addEventListener('submit', (e) => this.handleResetPassword(e));
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => this.handleLogout(e));
    }

    // Tab switching
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e));
    });
  }

  async handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword')
    };

    try {
      this.showLoading('registerBtn', true);
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage('Registrierung erfolgreich! Bitte überprüfen Sie Ihre E-Mails.', 'success');
        e.target.reset();
        this.switchToTab('login');
      } else {
        this.showMessage(result.message || 'Registrierung fehlgeschlagen', 'error');
      }
    } catch (error) {
      this.showMessage('Netzwerkfehler bei der Registrierung', 'error');
    } finally {
      this.showLoading('registerBtn', false);
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      this.showLoading('loginBtn', true);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        if (result.requiresVerification) {
          this.showMessage('Anmeldedaten korrekt! Bitte überprüfen Sie Ihre E-Mails und bestätigen Sie die Anmeldung.', 'info');
        } else {
          this.showMessage('Anmeldung erfolgreich!', 'success');
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1000);
        }
      } else {
        this.showMessage(result.message || 'Anmeldung fehlgeschlagen', 'error');
      }
    } catch (error) {
      this.showMessage('Netzwerkfehler bei der Anmeldung', 'error');
    } finally {
      this.showLoading('loginBtn', false);
    }
  }

  async handleForgotPassword(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
      email: formData.get('email')
    };

    try {
      this.showLoading('forgotBtn', true);
      
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage(result.message, 'success');
        e.target.reset();
      } else {
        this.showMessage(result.message || 'Fehler beim Senden der E-Mail', 'error');
      }
    } catch (error) {
      this.showMessage('Netzwerkfehler', 'error');
    } finally {
      this.showLoading('forgotBtn', false);
    }
  }

  async handleResetPassword(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const data = {
      token: token,
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword')
    };

    try {
      this.showLoading('resetBtn', true);
      
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage('Passwort erfolgreich geändert! Sie können sich jetzt anmelden.', 'success');
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
      } else {
        this.showMessage(result.message || 'Passwort-Reset fehlgeschlagen', 'error');
      }
    } catch (error) {
      this.showMessage('Netzwerkfehler beim Passwort-Reset', 'error');
    } finally {
      this.showLoading('resetBtn', false);
    }
  }

  async handleLogout(e) {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        this.showMessage('Erfolgreich abgemeldet', 'success');
        setTimeout(() => {
          window.location.href = '/auth';
        }, 1000);
      } else {
        this.showMessage('Fehler beim Abmelden', 'error');
      }
    } catch (error) {
      this.showMessage('Netzwerkfehler beim Abmelden', 'error');
    }
  }

  async checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/profile', {
        credentials: 'include'
      });

      if (response.ok) {
        // User is authenticated
        const userData = await response.json();
        this.updateUserInterface(userData.user);
      } else {
        // User is not authenticated
        this.updateUserInterface(null);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      this.updateUserInterface(null);
    }
  }

  updateUserInterface(user) {
    const authElements = document.querySelectorAll('[data-auth-required]');
    const unauthElements = document.querySelectorAll('[data-unauth-required]');
    
    authElements.forEach(el => {
      el.style.display = user ? 'block' : 'none';
    });
    
    unauthElements.forEach(el => {
      el.style.display = user ? 'none' : 'block';
    });

    if (user) {
      const userEmailElements = document.querySelectorAll('[data-user-email]');
      userEmailElements.forEach(el => {
        el.textContent = user.email;
      });
    }
  }

  switchTab(e) {
    e.preventDefault();
    const targetTab = e.target.dataset.tab;
    this.switchToTab(targetTab);
  }

  switchToTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      content.classList.add('hidden');
    });

    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
      tab.classList.remove('active');
    });

    // Show target tab content
    const targetContent = document.getElementById(`${tabName}Tab`);
    if (targetContent) {
      targetContent.classList.remove('hidden');
    }

    // Add active class to clicked tab
    const targetTabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetTabButton) {
      targetTabButton.classList.add('active');
    }
  }

  showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.auth-message');
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `auth-message p-4 rounded-md mb-4 ${this.getMessageClass(type)}`;
    messageDiv.textContent = message;

    // Insert at the top of the auth container
    const authContainer = document.querySelector('.auth-container') || document.body;
    authContainer.insertBefore(messageDiv, authContainer.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }

  getMessageClass(type) {
    const classes = {
      success: 'bg-green-100 text-green-700 border border-green-300',
      error: 'bg-red-100 text-red-700 border border-red-300',
      info: 'bg-blue-100 text-blue-700 border border-blue-300',
      warning: 'bg-yellow-100 text-yellow-700 border border-yellow-300'
    };
    return classes[type] || classes.info;
  }

  showLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (isLoading) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.innerHTML = '<span class="loading-spinner"></span> Laden...';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }
}

// Initialize auth system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AuthSystem();
});

// Add CSS for loading spinner
const style = document.createElement('style');
style.textContent = `
  .loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #333;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .auth-tab.active {
    background-color: #3B82F6;
    color: white;
  }
  
  .hidden {
    display: none !important;
  }
`;
document.head.appendChild(style);