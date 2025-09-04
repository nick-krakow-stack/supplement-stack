#!/bin/bash

# Setup Production Database for Supplement Stack
# Run this script locally after authenticating with Cloudflare

echo "🗄️  Setting up Supplement Stack Production Database..."
echo "📋 This script will create all necessary tables in your D1 production database"
echo ""

# Check if wrangler is authenticated
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo "❌ You are not authenticated with Cloudflare"
    echo "🔓 Please run: npx wrangler login"
    echo "   Then run this script again"
    exit 1
fi

# Verify the database exists
echo "🔍 Checking if database exists..."
if ! npx wrangler d1 list | grep -q "supplementstack-production"; then
    echo "❌ Database 'supplementstack-production' not found"
    echo "📝 Available databases:"
    npx wrangler d1 list
    exit 1
fi

echo "✅ Database found: supplementstack-production"
echo ""

# Execute the complete migration
echo "🚀 Applying database migration..."
if npx wrangler d1 execute supplementstack-production --file=./complete_migration.sql --env=production; then
    echo ""
    echo "✅ Database migration completed successfully!"
    echo ""
    
    # Verify tables were created
    echo "🔍 Verifying table creation..."
    echo "📊 Database structure:"
    npx wrangler d1 execute supplementstack-production --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --env=production
    
    echo ""
    echo "🎉 Production database is now ready!"
    echo "🌐 Your authenticated pages should now work properly"
    
else
    echo "❌ Migration failed!"
    echo "📋 Please check the error messages above"
    exit 1
fi

echo ""
echo "🧪 Testing database connectivity..."
echo "👥 User table structure:"
npx wrangler d1 execute supplementstack-production --command="PRAGMA table_info(users);" --env=production

echo ""
echo "📦 Products table structure:" 
npx wrangler d1 execute supplementstack-production --command="PRAGMA table_info(products);" --env=production

echo ""
echo "✨ Setup complete! Your authentication system should now work with full database support."