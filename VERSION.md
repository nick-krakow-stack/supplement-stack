# Supplement Stack - Version History

## Version 2.0.0 - MailerSend Email System (2025-09-02)

### 🚀 Major Features
- **Complete MailerSend Integration** with professional email templates
- **2-Factor Authentication** with email verification requirement
- **Password Reset System** with secure token-based reset
- **5 Professional Email Templates** with responsive HTML design
- **DSGVO Compliance** with proper user data handling

### 📧 Email Templates
1. **Registration Verification** - Beautiful onboarding email
2. **Password Reset** - Security-focused with clear instructions
3. **Welcome Email** - Sent after successful verification
4. **Account Deletion** - DSGVO-compliant confirmation
5. **Resend Verification** - For failed email deliveries

### 🎨 Design Improvements
- Health-optimized color psychology (Emerald/Teal)
- Gradient backgrounds and modern animations
- Mobile-first responsive design
- Professional branding throughout

### 🔐 Security Enhancements
- SHA-256 password hashing
- JWT token authentication with 7-day expiration
- Secure token generation for all auth flows
- 24h verification tokens, 1h reset tokens
- Proper token cleanup and expiration handling

### 🛠️ Technical Stack
- **Backend**: Hono v4 + TypeScript for Cloudflare Workers
- **Database**: Cloudflare D1 with migrations
- **Email**: MailerSend API integration
- **Frontend**: Modern JavaScript with Tailwind CSS
- **Build**: Vite with Cloudflare Pages optimization

### 📱 User Experience
- Professional auth pages at /auth and /reset-password
- Modal dialogs instead of browser alerts
- Real-time form validation
- Loading states and progress indicators
- Clear error handling and user feedback

### 🌐 Domain Configuration
- **Production**: supplementstack.de
- **API Key**: mlsn.b93df73e534656b9e6fecf1dadb07c3b960a19d789482e559ac531b79b8ce745
- **From Email**: noreply@supplementstack.de
- **DNS**: Properly configured with Cloudflare

---

## Version 1.0.0 - Initial Release
- Basic supplement management system
- Product and stack management
- Demo functionality with local storage
- Wishlist features