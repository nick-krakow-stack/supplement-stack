// Email sending utilities using MailChannels API
// Optimized for Cloudflare Workers

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface SendEmailOptions {
  to: string
  from?: string
  subject: string
  html: string
  text: string
}

// Generate email verification template
export function generateVerificationEmail(
  userEmail: string, 
  verificationToken: string, 
  baseUrl: string
): EmailTemplate {
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`
  
  const subject = '✅ Supplement Stack - E-Mail bestätigen'
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>E-Mail Bestätigung</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; text-align: center; }
        .logo { color: white; font-size: 24px; font-weight: bold; margin: 0; }
        .content { padding: 40px 30px; }
        .title { color: #1f2937; font-size: 24px; margin: 0 0 20px; }
        .text { color: #4b5563; line-height: 1.6; margin: 0 0 25px; }
        .button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { background: #f3f4f6; padding: 20px 30px; text-align: center; color: #6b7280; font-size: 14px; }
        .security-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">🏋️ Supplement Stack</h1>
        </div>
        
        <div class="content">
          <h2 class="title">Willkommen bei Supplement Stack!</h2>
          
          <p class="text">
            Hallo! Du hast dich erfolgreich bei <strong>Supplement Stack</strong> registriert. 
            Um dein Konto zu aktivieren und die DSGVO-Bestimmungen zu erfüllen, musst du deine E-Mail-Adresse bestätigen.
          </p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">
              ✅ E-Mail jetzt bestätigen
            </a>
          </div>
          
          <div class="security-note">
            <strong>🔐 Sicherheitshinweis:</strong><br>
            Dieser Link ist 24 Stunden gültig und kann nur einmal verwendet werden. 
            Falls du dich nicht bei Supplement Stack registriert hast, ignoriere diese E-Mail.
          </div>
          
          <p class="text">
            <strong>Was passiert nach der Bestätigung?</strong><br>
            • Vollzugriff auf personalisierte Supplement-Empfehlungen<br>
            • Wunschliste und Stack-Verwaltung<br>
            • Zugang zu wissenschaftlich fundierten Gesundheitsdaten<br>
            • Exklusive Angebote und Updates
          </p>
          
          <p class="text">
            Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
            <a href="${verificationUrl}" style="color: #10b981; word-break: break-all;">${verificationUrl}</a>
          </p>
        </div>
        
        <div class="footer">
          <p>
            <strong>Supplement Stack</strong> - Dein wissenschaftlich fundierter Gesundheitsguide<br>
            Diese E-Mail wurde an <strong>${userEmail}</strong> gesendet.<br>
            <br>
            Impressum & Datenschutz: <a href="${baseUrl}/legal" style="color: #10b981;">supplementstack.de/legal</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Willkommen bei Supplement Stack!

Du hast dich erfolgreich registriert. Um dein Konto zu aktivieren, bestätige bitte deine E-Mail-Adresse:

${verificationUrl}

Dieser Link ist 24 Stunden gültig.

Bei Fragen kontaktiere uns über supplementstack.de

Viele Grüße
Das Supplement Stack Team
  `
  
  return { subject, html, text }
}

// Send email via MailChannels API
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const mailChannelsResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: options.to }],
          }
        ],
        from: {
          email: options.from || 'noreply@supplementstack.de',
          name: 'Supplement Stack'
        },
        subject: options.subject,
        content: [
          {
            type: 'text/html',
            value: options.html
          },
          {
            type: 'text/plain', 
            value: options.text
          }
        ]
      })
    })

    if (mailChannelsResponse.ok) {
      console.log('[EMAIL] Successfully sent to:', options.to)
      return true
    } else {
      const errorText = await mailChannelsResponse.text()
      console.error('[EMAIL] MailChannels error:', mailChannelsResponse.status, errorText)
      return false
    }
  } catch (error) {
    console.error('[EMAIL] Send error:', error)
    return false
  }
}

// Generate secure verification token
export function generateVerificationToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}