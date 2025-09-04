// SMTP Email integration for Cloudflare Workers with MailerSend SMTP
// Using nodemailer-compatible approach for Workers

// MailerSend SMTP Configuration
const SMTP_CONFIG = {
  host: 'smtp.mailersend.net',
  port: 587,
  username: 'MS_te8J69@supplementstack.de', 
  password: 'mssp.T7Tiydx.z3m5jgrrjydgdpyo.XawKZnW'
}

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

// Simple SMTP email sender using fetch to MailerSend API (more reliable than raw SMTP in Workers)
export async function sendEmail(options: SendEmailOptions, apiKey?: string): Promise<boolean> {
  try {
    console.log('[SMTP-EMAIL] sendEmail called with:', {
      to: options.to.map(r => r.email),
      subject: options.subject,
      apiKeyProvided: !!apiKey
    })
    
    // Use MailerSend API with proper authentication - fallback to hardcoded for development
    const MAILERSEND_API_KEY = apiKey || 'mlsn.b93df73e534656b9e6fecf1dadb07c3b960a19d789482e559ac531b79b8ce745'
    
    const payload = {
      from: {
        email: options.from?.email || 'noreply@supplementstack.de',
        name: options.from?.name || 'Supplement Stack'
      },
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    }

    console.log('[SMTP] Sending email via MailerSend API:', {
      to: options.to.map(r => r.email),
      subject: options.subject,
      from: payload.from.email
    })

    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    if (response.ok) {
      console.log('[SMTP] Email sent successfully:', responseData)
      return true
    } else {
      console.error('[SMTP] Email send failed:', {
        status: response.status,
        statusText: response.statusText,
        error: responseData
      })
      return false
    }
  } catch (error) {
    console.error('[SMTP] Email send error:', error)
    return false
  }
}

// Generate verification email template (German/DSGVO compliant)
export function generateVerificationEmail(email: string, token: string, baseUrl: string): EmailTemplate {
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`
  
  return {
    subject: 'E-Mail-Adresse bestätigen - Supplement Stack',
    html: `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>E-Mail-Adresse bestätigen</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; padding: 15px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌟 Willkommen bei Supplement Stack!</h1>
          </div>
          <div class="content">
            <h2>E-Mail-Adresse bestätigen</h2>
            <p>Hallo,</p>
            <p>vielen Dank für Ihre Registrierung bei Supplement Stack! Um Ihr Konto zu aktivieren, bestätigen Sie bitte Ihre E-Mail-Adresse:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" class="button">E-Mail-Adresse bestätigen</a>
            </div>
            
            <p>Alternativ können Sie diesen Link in Ihren Browser kopieren:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            
            <p><strong>Wichtiger Hinweis:</strong> Dieser Bestätigungslink ist 24 Stunden gültig.</p>
            
            <hr style="margin: 30px 0; border: none; height: 1px; background: #e9ecef;">
            
            <h3>🎯 Was Sie erwartet:</h3>
            <ul>
              <li>✅ Personalisierte Supplement-Empfehlungen</li>
              <li>✅ Wissenschaftlich fundierte Nährstoff-Analysen</li>
              <li>✅ DSGVO-konforme Datenverwaltung</li>
              <li>✅ Deutsche Qualitäts-Supplements</li>
            </ul>
          </div>
          <div class="footer">
            <p><strong>Supplement Stack</strong><br>
            Ihr vertrauensvoller Partner für Nahrungsergänzung</p>
            <p>Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.</p>
            <p>Datenschutz: <a href="${baseUrl}/datenschutz">Datenschutzerklärung</a> | 
            <a href="${baseUrl}/impressum">Impressum</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Willkommen bei Supplement Stack!

E-Mail-Adresse bestätigen

Hallo,

vielen Dank für Ihre Registrierung bei Supplement Stack! Um Ihr Konto zu aktivieren, bestätigen Sie bitte Ihre E-Mail-Adresse:

Bestätigungslink: ${verificationUrl}

Wichtiger Hinweis: Dieser Bestätigungslink ist 24 Stunden gültig.

Was Sie erwartet:
- Personalisierte Supplement-Empfehlungen  
- Wissenschaftlich fundierte Nährstoff-Analysen
- DSGVO-konforme Datenverwaltung
- Deutsche Qualitäts-Supplements

Supplement Stack - Ihr vertrauensvoller Partner für Nahrungsergänzung

Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
    `
  }
}

// Generate welcome email template
export function generateWelcomeEmail(email: string, name?: string): EmailTemplate {
  const userName = name || email.split('@')[0]
  
  return {
    subject: '🎉 Willkommen bei Supplement Stack - Ihr Konto ist aktiv!',
    html: `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Willkommen bei Supplement Stack</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .feature-box { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4CAF50; }
          .button { display: inline-block; padding: 15px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Herzlich willkommen, ${userName}!</h1>
            <p>Ihr Supplement Stack Konto ist jetzt aktiv</p>
          </div>
          <div class="content">
            <h2>Schön, dass Sie da sind!</h2>
            <p>Ihre E-Mail-Adresse wurde erfolgreich bestätigt. Sie können jetzt alle Funktionen von Supplement Stack nutzen.</p>
            
            <div class="feature-box">
              <h3>🔬 Wissenschaftlich fundiert</h3>
              <p>Unsere Empfehlungen basieren auf aktuellen Studien und den Richtlinien der Deutschen Gesellschaft für Ernährung (DGE).</p>
            </div>
            
            <div class="feature-box">
              <h3>🎯 Personalisiert</h3>
              <p>Basierend auf Ihren Angaben zu Alter, Gewicht und Ernährungsweise erhalten Sie maßgeschneiderte Supplement-Empfehlungen.</p>
            </div>
            
            <div class="feature-box">
              <h3>🇩🇪 DSGVO-konform</h3>
              <p>Ihre Daten sind bei uns sicher. Wir halten uns strikt an die deutsche Datenschutz-Grundverordnung.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://supplementstack.de/" class="button">Jetzt loslegen</a>
            </div>
            
            <hr style="margin: 30px 0; border: none; height: 1px; background: #e9ecef;">
            
            <h3>💡 Tipp für den Einstieg:</h3>
            <p>Schauen Sie sich unsere vorgefertigten Supplement-Stacks an. Diese wurden von Ernährungsexperten zusammengestellt und decken die häufigsten Nährstoffbedürfnisse ab.</p>
          </div>
          <div class="footer">
            <p><strong>Supplement Stack</strong><br>
            Ihr vertrauensvoller Partner für Nahrungsergänzung</p>
            <p>Bei Fragen erreichen Sie uns unter: <a href="mailto:support@supplementstack.de">support@supplementstack.de</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Herzlich willkommen, ${userName}!

Ihr Supplement Stack Konto ist jetzt aktiv.

Schön, dass Sie da sind! Ihre E-Mail-Adresse wurde erfolgreich bestätigt. Sie können jetzt alle Funktionen von Supplement Stack nutzen.

Ihre Vorteile:
- Wissenschaftlich fundierte Empfehlungen basierend auf DGE-Richtlinien
- Personalisierte Supplement-Empfehlungen für Ihre Bedürfnisse  
- DSGVO-konforme Datensicherheit

Jetzt loslegen: https://supplementstack.de/

Tipp für den Einstieg: Schauen Sie sich unsere vorgefertigten Supplement-Stacks an.

Bei Fragen erreichen Sie uns unter: support@supplementstack.de

Supplement Stack - Ihr vertrauensvoller Partner für Nahrungsergänzung
    `
  }
}

// Generate secure token for email verification
export function generateSecureToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Generate password reset email template
export function generatePasswordResetEmail(email: string, token: string, baseUrl: string): EmailTemplate {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`
  
  return {
    subject: 'Passwort zurücksetzen - Supplement Stack',
    html: `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Passwort zurücksetzen</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #FF6B35, #F7931E); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; padding: 15px 30px; background: #FF6B35; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Passwort zurücksetzen</h1>
          </div>
          <div class="content">
            <h2>Passwort-Reset angefordert</h2>
            <p>Hallo,</p>
            <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts für Ihr Supplement Stack Konto gestellt.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="button">Neues Passwort erstellen</a>
            </div>
            
            <p>Alternativ können Sie diesen Link in Ihren Browser kopieren:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${resetUrl}
            </p>
            
            <div class="warning">
              <h3>⚠️ Wichtige Sicherheitshinweise:</h3>
              <ul>
                <li>Dieser Link ist nur <strong>1 Stunde</strong> gültig</li>
                <li>Nach Verwendung wird der Link ungültig</li>
                <li>Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail</li>
                <li>Ihr aktuelles Passwort bleibt bis zur Änderung aktiv</li>
              </ul>
            </div>
            
            <p>Aus Sicherheitsgründen werden Sie nach der Passwort-Änderung automatisch abgemeldet und müssen sich mit dem neuen Passwort erneut anmelden.</p>
          </div>
          <div class="footer">
            <p><strong>Supplement Stack</strong><br>
            Sicherheit hat bei uns höchste Priorität</p>
            <p>Bei verdächtigen Aktivitäten kontaktieren Sie uns: <a href="mailto:security@supplementstack.de">security@supplementstack.de</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Passwort zurücksetzen - Supplement Stack

Hallo,

Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts für Ihr Supplement Stack Konto gestellt.

Reset-Link: ${resetUrl}

Wichtige Sicherheitshinweise:
- Dieser Link ist nur 1 Stunde gültig
- Nach Verwendung wird der Link ungültig  
- Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail
- Ihr aktuelles Passwort bleibt bis zur Änderung aktiv

Aus Sicherheitsgründen werden Sie nach der Passwort-Änderung automatisch abgemeldet.

Bei verdächtigen Aktivitäten kontaktieren Sie uns: security@supplementstack.de

Supplement Stack - Sicherheit hat bei uns höchste Priorität
    `
  }
}