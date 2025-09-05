// Apply database schema fixes
const API_TOKEN = 'IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi';
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe';
const DATABASE_ID = 'f1336769-9231-4cfa-a54b-91a261f07b08';

async function applyDatabaseFix() {
  console.log('🔧 Applying database schema fixes...');
  
  const fixes = [
    "ALTER TABLE stacks ADD COLUMN is_public BOOLEAN DEFAULT FALSE;"
  ];
  
  for (const sql of fixes) {
    try {
      console.log(`📋 Executing: ${sql}`);
      
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
        console.log('✅ Fix applied successfully');
      } else {
        console.log('⚠️ Fix failed (may already exist):', result.errors?.[0]?.message || 'Unknown error');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
  
  console.log('🎉 Database fixes completed!');
}

applyDatabaseFix();