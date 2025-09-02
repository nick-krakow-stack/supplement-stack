// MailerSend API integration for transactional emails
// Using MailerSend API Key: mlsn.b93df73e534656b9e6fecf1dadb07c3b960a19d789482e559ac531b79b8ce745

const MAILERSEND_API_KEY = 'mlsn.b93df73e534656b9e6fecf1dadb07c3b960a19d789482e559ac531b79b8ce745'
const MAILERSEND_API_URL = 'https://api.mailersend.com/v1'

export interface EmailRecipient {
  email: string
  name?: string
}

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface SendEmailOptions {
  to: EmailRecipient[]
  from?: EmailRecipient
  subject: string
  html: string
  text: string
  tags?: string[]
}

// Send email via MailerSend API
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const mailersendPayload = {
      from: options.from || {
        email: 'noreply@supplementstack.de',
        name: 'Supplement Stack'
      },
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      tags: options.tags || ['authentication']
    }

    console.log('[MAILERSEND] Sending email to:', options.to.map(r => r.email).join(', '))
    
    const response = await fetch(`${MAILERSEND_API_URL}/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MAILERSEND_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(mailersendPayload)
    })

    if (response.ok) {
      console.log('[MAILERSEND] Email sent successfully')
      return true
    } else {
      const errorText = await response.text()
      console.error('[MAILERSEND] API Error:', response.status, response.statusText, errorText)
      return false
    }
  } catch (error) {
    console.error('[MAILERSEND] Send error:', error)
    return false
  }
}

// Generate secure token for various purposes
export function generateSecureToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Email verification template
export function generateVerificationEmail(
  userEmail: string, 
  verificationToken: string, 
  baseUrl: string
): EmailTemplate {
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`
  
  const subject = '✅ Supplement Stack - E-Mail bestätigen'
  
  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>E-Mail Bestätigung - Supplement Stack</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 40px 30px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: bold; margin: 0 0 10px; }
        .header-subtitle { opacity: 0.9; font-size: 16px; }
        .content { padding: 40px 30px; }
        .welcome { color: #1f2937; font-size: 28px; margin: 0 0 20px; font-weight: bold; text-align: center; }
        .text { color: #4b5563; line-height: 1.7; margin: 0 0 25px; font-size: 16px; }
        .cta-section { text-align: center; margin: 35px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-weight: 700; font-size: 16px; transition: all 0.3s ease; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39); }
        .button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px 0 rgba(16, 185, 129, 0.5); }
        .security-box { background: linear-gradient(135deg, #fef3c7 0%, #fef7e6 100%); border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 8px; }
        .security-title { color: #92400e; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; }
        .security-text { color: #78350f; font-size: 14px; line-height: 1.6; }
        .features { background: #f8fafc; padding: 25px; border-radius: 8px; margin: 25px 0; }
        .features h3 { color: #1e293b; margin-bottom: 15px; font-size: 18px; }
        .feature-list { list-style: none; padding: 0; }
        .feature-item { color: #475569; margin-bottom: 8px; padding-left: 25px; position: relative; }
        .feature-item::before { content: '✅'; position: absolute; left: 0; }
        .footer { background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 25px 30px; text-align: center; }
        .footer-text { color: #64748b; font-size: 14px; line-height: 1.6; }
        .footer-link { color: #10b981; text-decoration: none; font-weight: 500; }
        .backup-url { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; word-break: break-all; font-size: 14px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">🏋️ Supplement Stack</h1>
          <p class="header-subtitle">Dein wissenschaftlich fundierter Gesundheitsguide</p>
        </div>
        
        <div class="content">
          <h2 class="welcome">Willkommen bei Supplement Stack! 🎉</h2>
          
          <p class="text">
            Hallo! Du hast dich erfolgreich bei <strong>Supplement Stack</strong> registriert. 
            Um dein Konto zu aktivieren und die DSGVO-Bestimmungen zu erfüllen, musst du deine E-Mail-Adresse bestätigen.
          </p>
          
          <div class="cta-section">
            <a href="${verificationUrl}" class="button">
              ✅ E-Mail jetzt bestätigen
            </a>
          </div>
          
          <div class="security-box">
            <div class="security-title">
              🔐 Sicherheitshinweis
            </div>
            <div class="security-text">
              Dieser Link ist <strong>24 Stunden gültig</strong> und kann nur einmal verwendet werden. 
              Falls du dich nicht bei Supplement Stack registriert hast, ignoriere diese E-Mail einfach.
            </div>
          </div>
          
          <div class="features">
            <h3>🚀 Was dich nach der Bestätigung erwartet:</h3>
            <ul class="feature-list">
              <li class="feature-item">Personalisierte Supplement-Empfehlungen basierend auf wissenschaftlichen Studien</li>
              <li class="feature-item">Intelligente Wunschliste und Stack-Verwaltung</li>
              <li class="feature-item">Zugang zu DGE-konformen Gesundheitsdaten</li>
              <li class="feature-item">Exklusive Angebote und Updates zu neuen Produkten</li>
              <li class="feature-item">Community-Features und Erfahrungsaustausch</li>
            </ul>
          </div>
          
          <p class="text">
            <strong>Funktioniert der Button nicht?</strong><br>
            Kopiere einfach diesen Link in deinen Browser:
          </p>
          
          <div class="backup-url">
            ${verificationUrl}
          </div>
        </div>
        
        <div class="footer">
          <p class="footer-text">
            <strong>Supplement Stack</strong> - Wissenschaftlich fundierte Gesundheits-Optimierung<br>
            Diese E-Mail wurde an <strong>${userEmail}</strong> gesendet.<br><br>
            
            <a href="${baseUrl}/legal" class="footer-link">Impressum & Datenschutz</a> • 
            <a href="${baseUrl}/unsubscribe" class="footer-link">Abmelden</a><br><br>
            
            Bei Fragen erreichst du uns unter: <a href="mailto:support@supplementstack.de" class="footer-link">support@supplementstack.de</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
🏋️ SUPPLEMENT STACK - E-Mail Bestätigung

Willkommen bei Supplement Stack!

Du hast dich erfolgreich registriert. Um dein Konto zu aktivieren, bestätige bitte deine E-Mail-Adresse:

${verificationUrl}

🔐 SICHERHEIT:
- Link ist 24 Stunden gültig
- Kann nur einmal verwendet werden
- Falls du dich nicht registriert hast, ignoriere diese E-Mail

🚀 NACH DER BESTÄTIGUNG:
✅ Personalisierte Supplement-Empfehlungen
✅ Intelligente Wunschliste und Stack-Verwaltung  
✅ Zugang zu wissenschaftlichen Gesundheitsdaten
✅ Exklusive Angebote und Updates

Bei Fragen: support@supplementstack.de
Impressum & Datenschutz: ${baseUrl}/legal

Viele Grüße
Das Supplement Stack Team
  `
  
  return { subject, html, text }
}

// Password reset email template
export function generatePasswordResetEmail(
  userEmail: string,
  resetToken: string,
  baseUrl: string
): EmailTemplate {
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`
  
  const subject = '🔑 Supplement Stack - Passwort zurücksetzen'
  
  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Passwort zurücksetzen - Supplement Stack</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #fef2f2 0%, #fef7f7 100%); }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: bold; margin: 0 0 10px; }
        .header-subtitle { opacity: 0.9; font-size: 16px; }
        .content { padding: 40px 30px; }
        .title { color: #1f2937; font-size: 28px; margin: 0 0 20px; font-weight: bold; text-align: center; }
        .text { color: #4b5563; line-height: 1.7; margin: 0 0 25px; font-size: 16px; }
        .cta-section { text-align: center; margin: 35px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-weight: 700; font-size: 16px; transition: all 0.3s ease; box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.39); }
        .button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px 0 rgba(239, 68, 68, 0.5); }
        .warning-box { background: linear-gradient(135deg, #fef3c7 0%, #fef7e6 100%); border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 8px; }
        .warning-title { color: #92400e; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; }
        .warning-text { color: #78350f; font-size: 14px; line-height: 1.6; }
        .security-tips { background: #f0f9ff; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #0ea5e9; }
        .security-tips h3 { color: #0c4a6e; margin-bottom: 15px; font-size: 18px; }
        .tip-list { list-style: none; padding: 0; }
        .tip-item { color: #075985; margin-bottom: 8px; padding-left: 25px; position: relative; }
        .tip-item::before { content: '🛡️'; position: absolute; left: 0; }
        .footer { background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 25px 30px; text-align: center; }
        .footer-text { color: #64748b; font-size: 14px; line-height: 1.6; }
        .footer-link { color: #ef4444; text-decoration: none; font-weight: 500; }
        .backup-url { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; word-break: break-all; font-size: 14px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">🏋️ Supplement Stack</h1>
          <p class="header-subtitle">Sicherheit hat Priorität</p>
        </div>
        
        <div class="content">
          <h2 class="title">🔑 Passwort zurücksetzen</h2>
          
          <p class="text">
            Du hast eine Passwort-Zurücksetzung für dein <strong>Supplement Stack</strong> Konto angefordert.
            Klicke auf den Button unten, um ein neues Passwort zu erstellen.
          </p>
          
          <div class="cta-section">
            <a href="${resetUrl}" class="button">
              🔑 Neues Passwort erstellen
            </a>
          </div>
          
          <div class="warning-box">
            <div class="warning-title">
              ⚠️ Wichtige Sicherheitshinweise
            </div>
            <div class="warning-text">
              • Dieser Link ist <strong>1 Stunde gültig</strong> und kann nur einmal verwendet werden<br>
              • Falls du keine Passwort-Zurücksetzung angefordert hast, ignoriere diese E-Mail<br>
              • Dein aktuelles Passwort bleibt solange aktiv, bis du es erfolgreich änderst
            </div>
          </div>
          
          <div class="security-tips">
            <h3>🛡️ Tipps für ein sicheres Passwort:</h3>
            <ul class="tip-list">
              <li class="tip-item">Mindestens 12 Zeichen lang</li>
              <li class="tip-item">Kombination aus Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen</li>
              <li class="tip-item">Keine persönlichen Informationen verwenden</li>
              <li class="tip-item">Eindeutiges Passwort nur für Supplement Stack</li>
              <li class="tip-item">Passwort-Manager für maximale Sicherheit nutzen</li>
            </ul>
          </div>
          
          <p class="text">
            <strong>Funktioniert der Button nicht?</strong><br>
            Kopiere einfach diesen Link in deinen Browser:
          </p>
          
          <div class="backup-url">
            ${resetUrl}
          </div>
          
          <p class="text">
            <strong>Du hast keine Passwort-Zurücksetzung angefordert?</strong><br>
            Dann kannst du diese E-Mail ignorieren. Dein Konto bleibt sicher und dein Passwort wird nicht geändert.
          </p>
        </div>
        
        <div class="footer">
          <p class="footer-text">
            <strong>Supplement Stack</strong> - Deine Sicherheit ist unsere Priorität<br>
            Diese E-Mail wurde an <strong>${userEmail}</strong> gesendet.<br><br>
            
            Bei verdächtigen Aktivitäten: <a href="mailto:security@supplementstack.de" class="footer-link">security@supplementstack.de</a><br>
            <a href="${baseUrl}/legal" class="footer-link">Impressum & Datenschutz</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
🏋️ SUPPLEMENT STACK - Passwort zurücksetzen

🔑 PASSWORT-ZURÜCKSETZUNG ANGEFORDERT

Du hast eine Passwort-Zurücksetzung für dein Supplement Stack Konto angefordert.

${resetUrl}

⚠️ SICHERHEITSHINWEISE:
- Link ist 1 Stunde gültig
- Kann nur einmal verwendet werden
- Falls nicht von dir angefordert, ignoriere diese E-Mail
- Aktuelles Passwort bleibt bis zur Änderung aktiv

🛡️ TIPPS FÜR SICHERES PASSWORT:
✅ Mindestens 12 Zeichen
✅ Groß-/Kleinbuchstaben, Zahlen, Sonderzeichen
✅ Keine persönlichen Informationen
✅ Eindeutig für Supplement Stack
✅ Passwort-Manager nutzen

Bei Sicherheitsfragen: security@supplementstack.de
Impressum & Datenschutz: ${baseUrl}/legal

Bleib sicher!
Das Supplement Stack Team
  `
  
  return { subject, html, text }
}

// Welcome email after successful verification
export function generateWelcomeEmail(
  userName: string,
  userEmail: string,
  baseUrl: string
): EmailTemplate {
  const subject = '🎉 Willkommen bei Supplement Stack - Deine Gesundheitsreise beginnt!'
  
  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Willkommen bei Supplement Stack</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 40px 30px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: bold; margin: 0 0 10px; }
        .header-subtitle { opacity: 0.9; font-size: 16px; }
        .content { padding: 40px 30px; }
        .welcome { color: #1f2937; font-size: 32px; margin: 0 0 20px; font-weight: bold; text-align: center; }
        .text { color: #4b5563; line-height: 1.7; margin: 0 0 25px; font-size: 16px; }
        .cta-section { text-align: center; margin: 35px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-weight: 700; font-size: 16px; transition: all 0.3s ease; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39); margin: 0 10px 10px; }
        .button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px 0 rgba(16, 185, 129, 0.5); }
        .button.secondary { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.39); }
        .features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
        .feature-card { background: #f8fafc; padding: 25px; border-radius: 12px; text-align: center; border: 2px solid #e2e8f0; }
        .feature-icon { font-size: 32px; margin-bottom: 15px; }
        .feature-title { color: #1e293b; font-weight: 600; margin-bottom: 10px; font-size: 16px; }
        .feature-desc { color: #64748b; font-size: 14px; line-height: 1.5; }
        .stats-box { background: linear-gradient(135deg, #fef7e6 0%, #fef3c7 100%); padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center; }
        .stats-title { color: #92400e; font-weight: 600; margin-bottom: 15px; font-size: 18px; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .stat-item { text-align: center; }
        .stat-number { color: #f59e0b; font-size: 24px; font-weight: bold; display: block; }
        .stat-label { color: #78350f; font-size: 12px; margin-top: 5px; }
        .footer { background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 25px 30px; text-align: center; }
        .footer-text { color: #64748b; font-size: 14px; line-height: 1.6; }
        .footer-link { color: #10b981; text-decoration: none; font-weight: 500; }
        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">🏋️ Supplement Stack</h1>
          <p class="header-subtitle">Wissenschaftlich fundierte Gesundheits-Optimierung</p>
        </div>
        
        <div class="content">
          <h2 class="welcome">Willkommen, ${userName || 'Gesundheits-Enthusiast'}! 🎉</h2>
          
          <p class="text">
            <strong>Herzlichen Glückwunsch!</strong> Du bist jetzt offiziell Teil der Supplement Stack Community. 
            Deine E-Mail wurde erfolgreich bestätigt und dein Konto ist vollständig aktiviert.
          </p>
          
          <div class="cta-section">
            <a href="${baseUrl}/dashboard" class="button">
              🚀 Dashboard entdecken
            </a>
            <a href="${baseUrl}/products" class="button secondary">
              🔍 Produkte erkunden
            </a>
          </div>
          
          <div class="features-grid">
            <div class="feature-card">
              <div class="feature-icon">🧬</div>
              <div class="feature-title">Wissenschaftlich fundiert</div>
              <div class="feature-desc">Alle Empfehlungen basieren auf aktuellen Studien und DGE-Richtlinien</div>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🎯</div>
              <div class="feature-title">Personalisiert</div>
              <div class="feature-desc">Individuelle Supplement-Stacks basierend auf deinen Zielen</div>
            </div>
            <div class="feature-card">
              <div class="feature-icon">💡</div>
              <div class="feature-title">Intelligent optimiert</div>
              <div class="feature-desc">KI-gestützte Empfehlungen für maximale Gesundheitsvorteile</div>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🏆</div>
              <div class="feature-title">Premium Qualität</div>
              <div class="feature-desc">Nur geprüfte Produkte von vertrauenswürdigen Herstellern</div>
            </div>
          </div>
          
          <div class="stats-box">
            <div class="stats-title">📊 Unsere Community im Überblick</div>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-number">1.247</span>
                <div class="stat-label">Aktive Nutzer</div>
              </div>
              <div class="stat-item">
                <span class="stat-number">3.891</span>
                <div class="stat-label">Bewertete Produkte</div>
              </div>
              <div class="stat-item">
                <span class="stat-number">156</span>
                <div class="stat-label">Wissenschaftliche Studien</div>
              </div>
            </div>
          </div>
          
          <p class="text">
            <strong>🚀 Nächste Schritte:</strong>
          </p>
          <p class="text">
            1. <strong>Profile vervollständigen</strong> - Je mehr wir über dich wissen, desto präziser unsere Empfehlungen<br>
            2. <strong>Ersten Stack erstellen</strong> - Starte mit einem vordefinierten Stack oder erstelle deinen eigenen<br>
            3. <strong>Community beitreten</strong> - Tausche dich mit Gleichgesinnten aus und teile deine Erfahrungen<br>
            4. <strong>Fortschritte tracken</strong> - Überwache deine Gesundheitsziele und Erfolge
          </p>
        </div>
        
        <div class="footer">
          <p class="footer-text">
            <strong>Supplement Stack</strong> - Deine Reise zu optimaler Gesundheit beginnt jetzt!<br>
            Du erhältst diese E-Mail, weil du dich bei supplementstack.de registriert hast.<br><br>
            
            Fragen oder Feedback? <a href="mailto:support@supplementstack.de" class="footer-link">support@supplementstack.de</a><br>
            <a href="${baseUrl}/legal" class="footer-link">Impressum & Datenschutz</a> • 
            <a href="${baseUrl}/settings" class="footer-link">E-Mail Einstellungen</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
🏋️ SUPPLEMENT STACK - Willkommen!

🎉 WILLKOMMEN, ${userName?.toUpperCase() || 'GESUNDHEITS-ENTHUSIAST'}!

Herzlichen Glückwunsch! Du bist jetzt Teil der Supplement Stack Community.
Deine E-Mail wurde erfolgreich bestätigt und dein Konto ist aktiviert.

🚀 NÄCHSTE SCHRITTE:

Dashboard entdecken: ${baseUrl}/dashboard
Produkte erkunden: ${baseUrl}/products

📋 GETTING STARTED:
1. Profile vervollständigen für präzise Empfehlungen
2. Ersten Stack erstellen oder vordefinierte nutzen
3. Community beitreten und Erfahrungen teilen
4. Fortschritte tracken und Ziele überwachen

🌟 WAS DICH ERWARTET:
🧬 Wissenschaftlich fundierte Empfehlungen (DGE-konform)
🎯 Personalisierte Supplement-Stacks
💡 KI-gestützte Gesundheitsoptimierung
🏆 Premium-Qualität von geprüften Herstellern

📊 COMMUNITY STATS:
• 1.247 aktive Nutzer
• 3.891 bewertete Produkte  
• 156 wissenschaftliche Studien

Bei Fragen: support@supplementstack.de
Dashboard: ${baseUrl}/dashboard
Impressum: ${baseUrl}/legal

Willkommen an Bord!
Das Supplement Stack Team
  `
  
  return { subject, html, text }
}

// Account deletion confirmation email
export function generateAccountDeletionEmail(
  userEmail: string,
  baseUrl: string
): EmailTemplate {
  const subject = '✅ Supplement Stack - Konto erfolgreich gelöscht'
  
  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Konto gelöscht - Supplement Stack</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #64748b 0%, #475569 100%); padding: 40px 30px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: bold; margin: 0 0 10px; }
        .header-subtitle { opacity: 0.9; font-size: 16px; }
        .content { padding: 40px 30px; text-align: center; }
        .title { color: #1f2937; font-size: 28px; margin: 0 0 20px; font-weight: bold; }
        .text { color: #4b5563; line-height: 1.7; margin: 0 0 25px; font-size: 16px; }
        .info-box { background: #f0f9ff; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #0ea5e9; }
        .info-title { color: #0c4a6e; font-weight: 600; margin-bottom: 10px; }
        .info-text { color: #075985; font-size: 14px; line-height: 1.6; }
        .cta-section { text-align: center; margin: 35px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-weight: 700; font-size: 16px; transition: all 0.3s ease; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39); }
        .button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px 0 rgba(16, 185, 129, 0.5); }
        .footer { background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 25px 30px; text-align: center; }
        .footer-text { color: #64748b; font-size: 14px; line-height: 1.6; }
        .footer-link { color: #10b981; text-decoration: none; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">🏋️ Supplement Stack</h1>
          <p class="header-subtitle">Auf Wiedersehen</p>
        </div>
        
        <div class="content">
          <h2 class="title">👋 Konto erfolgreich gelöscht</h2>
          
          <p class="text">
            Dein <strong>Supplement Stack</strong> Konto wurde erfolgreich gelöscht. 
            Alle deine persönlichen Daten wurden gemäß DSGVO-Bestimmungen sicher entfernt.
          </p>
          
          <div class="info-box">
            <div class="info-title">🗑️ Was wurde gelöscht:</div>
            <div class="info-text">
              • Alle persönlichen Profildaten<br>
              • Gespeicherte Supplement-Stacks und Wunschlisten<br>
              • Kaufhistorie und Präferenzen<br>
              • E-Mail-Abonnements und Benachrichtigungen<br>
              • Konto-Zugangsdaten und Session-Tokens
            </div>
          </div>
          
          <p class="text">
            <strong>Du hattest eine großartige Zeit bei uns?</strong><br>
            Falls du deine Meinung änderst, kannst du jederzeit ein neues Konto erstellen 
            und wieder von unseren wissenschaftlich fundierten Gesundheitsempfehlungen profitieren.
          </p>
          
          <div class="cta-section">
            <a href="${baseUrl}/register" class="button">
              🔄 Neues Konto erstellen
            </a>
          </div>
          
          <p class="text">
            <strong>Feedback erwünscht!</strong><br>
            Wir würden gerne wissen, warum du uns verlassen hast. 
            Dein anonymes Feedback hilft uns, Supplement Stack zu verbessern.
          </p>
        </div>
        
        <div class="footer">
          <p class="footer-text">
            <strong>Supplement Stack</strong> - Danke, dass du Teil unserer Community warst!<br><br>
            
            Feedback senden: <a href="mailto:feedback@supplementstack.de" class="footer-link">feedback@supplementstack.de</a><br>
            <a href="${baseUrl}/legal" class="footer-link">Impressum & Datenschutz</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
🏋️ SUPPLEMENT STACK - Konto gelöscht

👋 AUF WIEDERSEHEN!

Dein Supplement Stack Konto wurde erfolgreich gelöscht.
Alle persönlichen Daten wurden DSGVO-konform entfernt.

🗑️ GELÖSCHT WURDEN:
✅ Alle persönlichen Profildaten
✅ Supplement-Stacks und Wunschlisten
✅ Kaufhistorie und Präferenzen
✅ E-Mail-Abonnements
✅ Zugangsdaten und Session-Tokens

🔄 MEINUNG GEÄNDERT?
Du kannst jederzeit ein neues Konto erstellen:
${baseUrl}/register

💬 FEEDBACK ERWÜNSCHT:
Warum hast du uns verlassen? Dein anonymes Feedback hilft uns:
feedback@supplementstack.de

Danke, dass du Teil unserer Community warst!
Das Supplement Stack Team

Impressum: ${baseUrl}/legal
  `
  
  return { subject, html, text }
}