// Fix missing categories table
const API_TOKEN = 'IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi';
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe';
const DATABASE_ID = 'f1336769-9231-4cfa-a54b-91a261f07b08';

async function fixCategories() {
  console.log('🔧 Creating missing categories table...');
  
  const statements = [
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `INSERT OR IGNORE INTO categories (id, name, description, sort_order) VALUES
    (1, 'Vitamine', 'Fettlösliche und wasserlösliche Vitamine', 1)`,
    
    `INSERT OR IGNORE INTO categories (id, name, description, sort_order) VALUES
    (2, 'Mineralstoffe', 'Mengen- und Spurenelemente', 2)`,
    
    `INSERT OR IGNORE INTO categories (id, name, description, sort_order) VALUES
    (3, 'Aminosäuren', 'Essentielle und nicht-essentielle Aminosäuren', 3)`,
    
    `INSERT OR IGNORE INTO categories (id, name, description, sort_order) VALUES
    (4, 'Fettsäuren', 'Omega-3/6/9 Fettsäuren', 4)`,
    
    `INSERT OR IGNORE INTO categories (id, name, description, sort_order) VALUES
    (5, 'Pflanzenstoffe', 'Sekundäre Pflanzenstoffe', 5)`
  ];
  
  for (const sql of statements) {
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
        console.log('✅ Categories statement executed');
      } else {
        console.log('⚠️ Categories statement failed:', result.errors?.[0]?.message);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
  
  console.log('🎉 Categories table fix completed!');
}

fixCategories();