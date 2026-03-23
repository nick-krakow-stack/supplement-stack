# Supplement Stack - Production Deployment

🚀 **Status:** READY FOR DEPLOYMENT

## Deployment Info
- **Frontend:** React + Vite + Tailwind CSS
- **Backend API:** Hono TypeScript
- **Database:** SQLite
- **Hosting:** Cloudflare Pages + Workers
- **Domain:** https://supplementstack.de

## Features Implemented
✅ User Authentication (Email + Password)
✅ Ingredient Management (CRUD, Synonyms, Forms)
✅ Product Management (CRUD, Moderation)
✅ Stack Creation (Combine Products, Calculate Costs)
✅ Interaction Warnings (Ampel System)
✅ Demo Mode (24h Sessions)
✅ Admin Panel (Recommendations, Interactions)
✅ Mobile Responsive Design
✅ Modern UI (Tailwind CSS)
✅ GitHub Actions CI/CD
✅ Cloudflare Deployment

## Quick Start (Local Development)

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Production Deployment

Push to `main` branch → GitHub Actions triggers → Cloudflare Pages deploys automatically

## Environment Variables

### Backend (.env)
```
PORT=4000
JWT_SECRET=your-secret-key-here
DEMO_SESSION_TTL_MINUTES=1440
DB_FILE=./data/supplement-stack.db
```

### GitHub Secrets (Actions)
- `CLOUDFLARE_API_TOKEN` ✅
- `CLOUDFLARE_ACCOUNT_ID` ✅
- `CLOUDFLARE_EMAIL` ✅

## Testing

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/me` - Get current user profile

### Ingredients
- `GET /api/ingredients` - List all ingredients
- `GET /api/ingredients/search?q=keyword` - Search ingredients
- `POST /api/ingredients` - Create ingredient (Admin only)

### Products
- `GET /api/products` - List public products
- `POST /api/products` - Create product

### Stacks
- `POST /api/stacks` - Create stack
- `GET /api/stacks/:id` - Get stack details
- `GET /api/stack-warnings/:id` - Get interaction warnings

### Demo
- `POST /api/demo/sessions` - Create demo session
- `GET /api/demo/sessions/:key` - Get demo session
- `GET /api/demo/reset` - Reset expired sessions

## Support
For issues or feature requests, contact: [your-support-email]

---

**Last Updated:** March 23, 2026
**Version:** 1.0.0
**Status:** 🟢 Production Ready
