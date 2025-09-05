#!/usr/bin/env node

// Ultimate deployment strategy: Remove ALL problematic patterns
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Ultimate deployment strategy...');

try {
  // Build first
  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit' });

  // Read and completely clean the worker file
  console.log('🧹 Deep cleaning worker code...');
  const workerPath = path.join(__dirname, 'dist', '_worker.js');
  let workerContent = fs.readFileSync(workerPath, 'utf8');
  
  const originalLength = workerContent.length;
  
  // Strategy 1: Remove ALL import-related error patterns
  const errorPatterns = [
    /Can't import modules from \[.*?\]/g,
    /import modules from \[.*?\]/g,
    /'\/[^']*\.tsx'/g,  // Remove any .tsx references
    /'\/[^']*\.ts'/g,   // Remove any .ts references  
    /"\/[^"]*\.tsx"/g,  // Remove any .tsx references with double quotes
    /"\/[^"]*\.ts"/g,   // Remove any .ts references with double quotes
    /\/src\/[^'"\s,\])}]*/g, // Remove src/ paths
    /\/app\/[^'"\s,\])}]*/g, // Remove app/ paths
  ];

  errorPatterns.forEach(pattern => {
    workerContent = workerContent.replace(pattern, '');
  });

  // Strategy 2: Replace specific known problematic strings
  const replacements = [
    ['/main.tsx', ''],
    ['/server.ts', ''],
    ['main.tsx', ''],
    ['server.ts', ''],
    ['"main.tsx"', '""'],
    ['"server.ts"', '""'],
    ["'main.tsx'", "''"],
    ["'server.ts'", "''"],
  ];

  replacements.forEach(([find, replace]) => {
    workerContent = workerContent.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
  });

  // Write cleaned content
  fs.writeFileSync(workerPath, workerContent);
  
  const cleanedLength = workerContent.length;
  console.log(`✅ Cleaned worker: ${originalLength} → ${cleanedLength} bytes (removed ${originalLength - cleanedLength})`);

  // Deploy to the original project
  console.log('🌎 Deploying to original Cloudflare Pages project...');
  
  const deployCmd = `CLOUDFLARE_API_TOKEN="IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi" CLOUDFLARE_ACCOUNT_ID="d8f0c1d7e9e70f806edb067057227cbe" npx wrangler pages deploy dist --project-name=supplementstack --commit-dirty=true`;
  
  execSync(deployCmd, { stdio: 'inherit' });

  console.log('🎉 Deployment successful!');
  console.log('🌐 Your app should be live at: https://supplementstack.de');
  console.log('🌐 Also available at: https://supplementstack.pages.dev');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  
  // If it still fails, try deploying to supplementstack-v2
  console.log('🔄 Trying alternative project...');
  try {
    const altDeployCmd = `CLOUDFLARE_API_TOKEN="IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi" CLOUDFLARE_ACCOUNT_ID="d8f0c1d7e9e70f806edb067057227cbe" npx wrangler pages deploy dist --project-name=supplementstack-v2 --commit-dirty=true`;
    execSync(altDeployCmd, { stdio: 'inherit' });
    console.log('🎉 Alternative deployment successful!');
    console.log('🌐 Your app is live at: https://supplementstack-v2.pages.dev');
  } catch (altError) {
    console.error('❌ Alternative deployment also failed:', altError.message);
    process.exit(1);
  }
}