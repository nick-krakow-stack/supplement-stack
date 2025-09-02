# Cloudflare Pages Deployment Setup

## Required Environment Variables

To fix the email sending issue, the following environment variables must be set in the Cloudflare Pages dashboard:

### 1. MailerSend API Key
**Variable:** `MAILERSEND_API_KEY`  
**Value:** `mlsn.b93df73e534656b9e6fecf1dadb07c3b960a19d789482e559ac531b79b8ce745`

### 2. JWT Secret
**Variable:** `JWT_SECRET`  
**Value:** `your-secure-jwt-secret-here` (generate a secure random string)

## How to Set Environment Variables in Cloudflare Pages:

1. Go to Cloudflare Dashboard
2. Navigate to **Pages** > **supplement-stack**
3. Go to **Settings** > **Environment variables**
4. Add the variables above for the **Production** environment
5. Redeploy the latest commit to apply the changes

## Database Configuration

The D1 database is already configured:
- **Database ID:** `f1336769-9231-4cfa-a54b-91a261f07b08`
- **Binding:** `DB`
- **Name:** `supplementstack-production`

## Email Integration Fix

✅ **Problem:** Registration was creating users but failing to send verification emails, showing "Internal Server Error"

✅ **Solution:** Updated email system to use improved MailerSend API integration with proper environment variable handling

✅ **Result:** Email sending will work properly once `MAILERSEND_API_KEY` is set in Cloudflare Pages environment

## Testing the Fix

After setting the environment variables:

1. Visit: https://supplementstack.de
2. Try registration with a test email
3. Should see success message: "Registrierung erfolgreich! Bitte überprüfe deine E-Mails..."
4. Check email for verification message

## SMTP Credentials (Alternative)

If REST API continues to fail, we can implement pure SMTP:
- **Server:** smtp.mailersend.net
- **Username:** MS_te8J69@supplementstack.de
- **Password:** mssp.T7Tiydx.z3m5jgrrjydgdpyo.XawKZnW
- **Port:** 587 or 2525