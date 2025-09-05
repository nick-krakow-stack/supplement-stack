// MailerSend Integration for GDPR-compliant email sending
// API Key: mlsn.b93df73e534656b9e6fecf1dadb07c3b960a19d789482e559ac531b79b8ce745

interface MailerSendRecipient {
  email: string;
  name?: string;
}

interface MailerSendPersonalization {
  email: string;
  data: {
    [key: string]: string;
  };
}

interface MailerSendEmailOptions {
  from: {
    email: string;
    name: string;
  };
  to: MailerSendRecipient[];
  subject: string;
  html: string;
  text?: string;
  template_id?: string;
  personalization?: MailerSendPersonalization[];
}

export class MailerSendService {
  private apiKey: string;
  private baseUrl = 'https://api.mailersend.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async sendRequest(endpoint: string, data: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('MailerSend API Error:', response.status, errorData);
      throw new Error(`MailerSend API Error: ${response.status} - ${errorData}`);
    }

    return response.json();
  }

  async sendEmail(options: MailerSendEmailOptions) {
    return this.sendRequest('/email', options);
  }

  // Email verification email (GDPR-compliant)
  async sendEmailVerification(userEmail: string, userName: string, verificationToken: string, baseUrl: string) {
    const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
    
    const emailOptions: MailerSendEmailOptions = {
      from: {
        email: 'noreply@supplementstack.de',
        name: 'Supplement Stack'
      },
      to: [{
        email: userEmail,
        name: userName
      }],
      subject: 'E-Mail-Adresse bestätigen - Supplement Stack',
      html: this.getEmailVerificationTemplate(userName, verificationLink),
      text: this.getEmailVerificationTextTemplate(userName, verificationLink)
    };

    return this.sendEmail(emailOptions);
  }

  // 2-Step login email
  async sendLoginVerification(userEmail: string, userName: string, loginToken: string, baseUrl: string) {
    const loginLink = `${baseUrl}/api/auth/verify-login?token=${loginToken}`;
    
    const emailOptions: MailerSendEmailOptions = {
      from: {
        email: 'noreply@supplementstack.de',
        name: 'Supplement Stack'
      },
      to: [{
        email: userEmail,
        name: userName
      }],
      subject: 'Anmeldung bestätigen - Supplement Stack',
      html: this.getLoginVerificationTemplate(userName, loginLink),
      text: this.getLoginVerificationTextTemplate(userName, loginLink)
    };

    return this.sendEmail(emailOptions);
  }

  // Password reset email
  async sendPasswordReset(userEmail: string, userName: string, resetToken: string, baseUrl: string) {
    const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
    
    const emailOptions: MailerSendEmailOptions = {
      from: {
        email: 'noreply@supplementstack.de',
        name: 'Supplement Stack'
      },
      to: [{
        email: userEmail,
        name: userName
      }],
      subject: 'Passwort zurücksetzen - Supplement Stack',
      html: this.getPasswordResetTemplate(userName, resetLink),
      text: this.getPasswordResetTextTemplate(userName, resetLink)
    };

    return this.sendEmail(emailOptions);
  }

  // GDPR-compliant email verification template
  private getEmailVerificationTemplate(userName: string, verificationLink: string): string {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Mail-Adresse bestätigen</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 8px 8px 0 0;
        }
        .content { 
            background: #f9f9f9; 
            padding: 30px; 
            border-radius: 0 0 8px 8px;
        }
        .button { 
            display: inline-block; 
            background: #667eea; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
        }
        .footer { 
            text-align: center; 
            margin-top: 30px; 
            font-size: 12px; 
            color: #666;
        }
        .privacy-notice {
            background: #e8f4f8;
            padding: 15px;
            border-left: 4px solid #667eea;
            margin: 20px 0;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧬 Supplement Stack</h1>
        <p>Willkommen bei deinem intelligenten Supplement Manager</p>
    </div>
    
    <div class="content">
        <h2>Hallo ${userName}!</h2>
        
        <p>vielen Dank für deine Registrierung bei Supplement Stack. Um die DSGVO-Anforderungen zu erfüllen, müssen wir deine E-Mail-Adresse bestätigen.</p>
        
        <p><strong>Bitte klicke auf den folgenden Button, um deine E-Mail-Adresse zu verifizieren:</strong></p>
        
        <div style="text-align: center;">
            <a href="${verificationLink}" class="button">E-Mail-Adresse bestätigen</a>
        </div>
        
        <p>Alternativ kannst du auch diesen Link in deinen Browser kopieren:<br>
        <code style="background: #eee; padding: 5px; border-radius: 3px; word-break: break-all;">${verificationLink}</code></p>
        
        <div class="privacy-notice">
            <h4>🔒 Datenschutz & DSGVO-Konformität</h4>
            <p>Deine Daten werden nach den strengsten deutschen und europäischen Datenschutzgesetzen behandelt. Du hast jederzeit das Recht auf:</p>
            <ul>
                <li>Auskunft über deine gespeicherten Daten</li>
                <li>Berichtigung unrichtiger Daten</li>
                <li>Löschung deiner Daten</li>
                <li>Datenportabilität</li>
                <li>Widerspruch gegen die Verarbeitung</li>
            </ul>
            <p>Diese E-Mail-Verifizierung ist notwendig, um sicherzustellen, dass nur du Zugriff auf dein Konto hast.</p>
        </div>
        
        <p>Falls du dich nicht bei Supplement Stack registriert hast, kannst du diese E-Mail ignorieren. Deine Daten werden automatisch nach 24 Stunden gelöscht, wenn die Verifizierung nicht erfolgt.</p>
        
        <p>Bei Fragen wende dich gerne an: <a href="mailto:support@supplementstack.de">support@supplementstack.de</a></p>
        
        <p>Viele Grüße<br>Dein Supplement Stack Team</p>
    </div>
    
    <div class="footer">
        <p>Supplement Stack - Dein intelligenter Supplement Manager<br>
        Diese E-Mail wurde automatisch generiert. Bitte antworte nicht direkt auf diese E-Mail.</p>
        <p>Impressum: <a href="https://supplementstack.de/impressum">https://supplementstack.de/impressum</a> | 
        Datenschutz: <a href="https://supplementstack.de/datenschutz">https://supplementstack.de/datenschutz</a></p>
    </div>
</body>
</html>
    `;
  }

  private getEmailVerificationTextTemplate(userName: string, verificationLink: string): string {
    return `
Hallo ${userName}!

Vielen Dank für deine Registrierung bei Supplement Stack.

Um die DSGVO-Anforderungen zu erfüllen, müssen wir deine E-Mail-Adresse bestätigen.

Bitte klicke auf diesen Link: ${verificationLink}

DATENSCHUTZ & DSGVO-KONFORMITÄT:
Deine Daten werden nach den strengsten deutschen und europäischen Datenschutzgesetzen behandelt.

Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren. Die Daten werden nach 24 Stunden automatisch gelöscht.

Bei Fragen: support@supplementstack.de

Viele Grüße
Dein Supplement Stack Team
    `;
  }

  private getLoginVerificationTemplate(userName: string, loginLink: string): string {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anmeldung bestätigen</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 8px 8px 0 0;
        }
        .content { 
            background: #f9f9f9; 
            padding: 30px; 
            border-radius: 0 0 8px 8px;
        }
        .button { 
            display: inline-block; 
            background: #667eea; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
        }
        .security-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer { 
            text-align: center; 
            margin-top: 30px; 
            font-size: 12px; 
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Supplement Stack</h1>
        <p>Anmeldung bestätigen</p>
    </div>
    
    <div class="content">
        <h2>Hallo ${userName}!</h2>
        
        <p>jemand möchte sich mit deinem Supplement Stack Konto anmelden. Aus Sicherheitsgründen benötigen wir deine Bestätigung.</p>
        
        <div class="security-notice">
            <h4>🛡️ Sicherheitshinweis</h4>
            <p>Diese 2-Schritt-Verifizierung schützt dein Konto vor unbefugtem Zugriff und entspricht den DSGVO-Sicherheitsanforderungen.</p>
        </div>
        
        <p><strong>Wenn du es warst, klicke auf den folgenden Button:</strong></p>
        
        <div style="text-align: center;">
            <a href="${loginLink}" class="button">Anmeldung bestätigen</a>
        </div>
        
        <p>Alternativ kannst du auch diesen Link verwenden:<br>
        <code style="background: #eee; padding: 5px; border-radius: 3px; word-break: break-all;">${loginLink}</code></p>
        
        <p><strong>Wenn du es NICHT warst:</strong></p>
        <ul>
            <li>Ignoriere diese E-Mail</li>
            <li>Ändere dein Passwort in den Kontoeinstellungen</li>
            <li>Kontaktiere uns bei Verdacht auf unbefugten Zugriff</li>
        </ul>
        
        <p>Dieser Link ist 15 Minuten gültig und kann nur einmal verwendet werden.</p>
        
        <p>Bei Fragen: <a href="mailto:support@supplementstack.de">support@supplementstack.de</a></p>
        
        <p>Viele Grüße<br>Dein Supplement Stack Team</p>
    </div>
    
    <div class="footer">
        <p>Diese E-Mail wurde automatisch generiert. Bitte antworte nicht direkt auf diese E-Mail.</p>
    </div>
</body>
</html>
    `;
  }

  private getLoginVerificationTextTemplate(userName: string, loginLink: string): string {
    return `
Hallo ${userName}!

Jemand möchte sich mit deinem Supplement Stack Konto anmelden.

Aus Sicherheitsgründen benötigen wir deine Bestätigung.

Wenn du es warst, klicke auf diesen Link: ${loginLink}

Wenn du es NICHT warst:
- Ignoriere diese E-Mail
- Ändere dein Passwort
- Kontaktiere uns bei Verdacht auf unbefugten Zugriff

Link gültig für 15 Minuten.

Bei Fragen: support@supplementstack.de

Viele Grüße
Supplement Stack Team
    `;
  }

  private getPasswordResetTemplate(userName: string, resetLink: string): string {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Passwort zurücksetzen</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 8px 8px 0 0;
        }
        .content { 
            background: #f9f9f9; 
            padding: 30px; 
            border-radius: 0 0 8px 8px;
        }
        .button { 
            display: inline-block; 
            background: #dc3545; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
        }
        .security-notice {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer { 
            text-align: center; 
            margin-top: 30px; 
            font-size: 12px; 
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔑 Supplement Stack</h1>
        <p>Passwort zurücksetzen</p>
    </div>
    
    <div class="content">
        <h2>Hallo ${userName}!</h2>
        
        <p>wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten.</p>
        
        <div class="security-notice">
            <h4>🚨 Sicherheitshinweis</h4>
            <p>Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail. Dein Passwort bleibt unverändert.</p>
        </div>
        
        <p><strong>Um ein neues Passwort zu erstellen, klicke auf den folgenden Button:</strong></p>
        
        <div style="text-align: center;">
            <a href="${resetLink}" class="button">Passwort zurücksetzen</a>
        </div>
        
        <p>Alternativ kannst du auch diesen Link verwenden:<br>
        <code style="background: #eee; padding: 5px; border-radius: 3px; word-break: break-all;">${resetLink}</code></p>
        
        <p><strong>Wichtige Sicherheitsinformationen:</strong></p>
        <ul>
            <li>Dieser Link ist 1 Stunde gültig</li>
            <li>Der Link kann nur einmal verwendet werden</li>
            <li>Wähle ein starkes, einzigartiges Passwort</li>
            <li>Teile dein Passwort niemals mit anderen</li>
        </ul>
        
        <p>Bei weiteren Fragen oder Sicherheitsbedenken: <a href="mailto:support@supplementstack.de">support@supplementstack.de</a></p>
        
        <p>Viele Grüße<br>Dein Supplement Stack Team</p>
    </div>
    
    <div class="footer">
        <p>Diese E-Mail wurde automatisch generiert. Bitte antworte nicht direkt auf diese E-Mail.</p>
    </div>
</body>
</html>
    `;
  }

  private getPasswordResetTextTemplate(userName: string, resetLink: string): string {
    return `
Hallo ${userName}!

Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten.

Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.

Um ein neues Passwort zu erstellen, klicke auf diesen Link: ${resetLink}

WICHTIGE SICHERHEITSINFORMATIONEN:
- Link ist 1 Stunde gültig
- Kann nur einmal verwendet werden
- Wähle ein starkes, einzigartiges Passwort

Bei Fragen: support@supplementstack.de

Viele Grüße
Supplement Stack Team
    `;
  }
}

export default MailerSendService;