#!/bin/bash

# Check Production Database Status for Supplement Stack
# Run this to verify current database state

echo "🗄️  Checking Supplement Stack Production Database Status..."
echo ""

# Check if wrangler is authenticated
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo "❌ You are not authenticated with Cloudflare"
    echo "🔓 Please run: npx wrangler login"
    exit 1
fi

echo "👤 Logged in as:"
npx wrangler whoami

echo ""
echo "🗄️  Available D1 Databases:"
npx wrangler d1 list

echo ""
echo "📊 Production Database Tables:"
npx wrangler d1 execute supplementstack-production --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --env=production

echo ""
echo "📈 Table counts:"
echo "🏠 Getting table counts from production database..."

# Count tables
TABLE_COUNT=$(npx wrangler d1 execute supplementstack-production --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='table';" --env=production 2>/dev/null | grep -o '[0-9]\+' | tail -1)

if [ "$TABLE_COUNT" = "0" ]; then
    echo "⚠️  Database has 0 tables - migration needed!"
    echo "🚀 Run ./setup_production_db.sh to create tables"
else
    echo "✅ Database has $TABLE_COUNT tables"
    
    # Check if core tables exist
    echo ""
    echo "🔍 Checking core tables:"
    
    for table in users products stacks wishlist categories nutrients; do
        if npx wrangler d1 execute supplementstack-production --command="SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" --env=production 2>/dev/null | grep -q "$table"; then
            echo "✅ $table table exists"
        else
            echo "❌ $table table missing"
        fi
    done
fi

echo ""
echo "📋 Database Status Check Complete"