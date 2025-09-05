// Execute Database Migration via Cloudflare D1 API
const fs = require('fs');

const API_TOKEN = 'IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi';
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe';
const DATABASE_ID = 'f1336769-9231-4cfa-a54b-91a261f07b08';

async function executeMigration() {
  console.log('🗄️ Executing database migration...');
  
  // Read the migration file
  const migrationSQL = fs.readFileSync('./complete_migration.sql', 'utf8');
  
  // Split into smaller chunks to avoid API limits
  const statements = migrationSQL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
  
  console.log(`📋 Executing ${statements.length} SQL statements...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Execute statements in batches
  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i] + ';';
    
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        successCount++;
        if (i % 10 === 0) {
          console.log(`   ✅ Progress: ${i + 1}/${statements.length}`);
        }
      } else {
        errorCount++;
        console.log(`   ⚠️ Statement ${i + 1} failed:`, result.errors?.[0]?.message || 'Unknown error');
      }
    } catch (error) {
      errorCount++;
      console.log(`   ❌ Error executing statement ${i + 1}:`, error.message);
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`\n📊 Migration Results:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  
  // Verify tables were created
  console.log('\n🔍 Verifying table creation...');
  
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.result?.[0]?.results) {
      const tables = result.result[0].results.map(row => row.name);
      console.log(`✅ Tables created: ${tables.length}`);
      console.log(`   📋 Table list: ${tables.join(', ')}`);
      
      // Check for essential tables
      const essentialTables = ['users', 'products', 'stacks', 'wishlist', 'categories', 'nutrients'];
      const missingTables = essentialTables.filter(table => !tables.includes(table));
      
      if (missingTables.length === 0) {
        console.log('🎉 All essential tables created successfully!');
        return true;
      } else {
        console.log(`⚠️ Missing tables: ${missingTables.join(', ')}`);
        return false;
      }
    } else {
      console.log('❌ Failed to verify tables:', result);
      return false;
    }
  } catch (error) {
    console.log('❌ Error verifying tables:', error.message);
    return false;
  }
}

executeMigration().then(success => {
  if (success) {
    console.log('\n🎉 Database migration completed successfully!');
    console.log('📊 The "num_tables: 0" issue should now be resolved');
    process.exit(0);
  } else {
    console.log('\n❌ Database migration had issues');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Migration failed:', error.message);
  process.exit(1);
});