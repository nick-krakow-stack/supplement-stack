// Verify database is complete
const API_TOKEN = 'IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi';
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe';
const DATABASE_ID = 'f1336769-9231-4cfa-a54b-91a261f07b08';

async function verifyDatabase() {
  console.log('🔍 Verifying complete database setup...');
  
  try {
    // Check tables
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
      console.log(`✅ Total tables: ${tables.length}`);
      
      const essentialTables = ['users', 'products', 'stacks', 'wishlist', 'categories', 'nutrients'];
      console.log('\n📋 Essential tables check:');
      
      let allGood = true;
      for (const table of essentialTables) {
        if (tables.includes(table)) {
          console.log(`   ✅ ${table}`);
        } else {
          console.log(`   ❌ ${table} MISSING`);
          allGood = false;
        }
      }
      
      // Check categories data
      const catResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: "SELECT COUNT(*) as count FROM categories;"
        })
      });
      
      const catResult = await catResponse.json();
      if (catResponse.ok && catResult.result?.[0]?.results?.[0]?.count) {
        const categoryCount = catResult.result[0].results[0].count;
        console.log(`\n📊 Categories count: ${categoryCount}`);
      }
      
      if (allGood) {
        console.log('\n🎉 DATABASE IS READY!');
        console.log('✅ All essential tables exist');
        console.log('✅ The "num_tables: 0" issue is FIXED');
        console.log('✅ Dashboard/Products/Stacks pages should now work!');
        return true;
      } else {
        console.log('\n⚠️ Some tables are missing');
        return false;
      }
    }
  } catch (error) {
    console.log('❌ Verification error:', error.message);
    return false;
  }
}

verifyDatabase();