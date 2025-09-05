#!/usr/bin/env node

// Production deployment script with clean build
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting production deployment...');

try {
  // Step 1: Clean build
  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit' });

  // Step 2: Clean problematic imports
  console.log('🧹 Cleaning build artifacts...');
  const workerPath = path.join(__dirname, 'dist', '_worker.js');
  let workerContent = fs.readFileSync(workerPath, 'utf8');
  
  // Remove all problematic import references
  const cleanPatterns = [
    [/\/src\/index\.tsx/g, '/main.tsx'],
    [/\/app\/server\.ts/g, '/server.ts'],
    [/src\/index\.tsx/g, 'main.tsx'],
    [/app\/server\.ts/g, 'server.ts'],
    [/'\/src\/index\.tsx'/g, "'/main.tsx'"],
    [/'\/app\/server\.ts'/g, "'/server.ts'"],
    [/"\/src\/index\.tsx"/g, '"/main.tsx"'],
    [/"\/app\/server\.ts"/g, '"/server.ts"']
  ];

  let cleanedCount = 0;
  cleanPatterns.forEach(([pattern, replacement]) => {
    const matches = workerContent.match(pattern);
    if (matches) {
      cleanedCount += matches.length;
      workerContent = workerContent.replace(pattern, replacement);
    }
  });

  fs.writeFileSync(workerPath, workerContent);
  console.log(`✅ Cleaned ${cleanedCount} problematic references`);

  // Step 3: Deploy to Cloudflare Pages
  console.log('🌎 Deploying to Cloudflare Pages...');
  
  const deployCmd = `CLOUDFLARE_API_TOKEN="${process.env.CLOUDFLARE_API_TOKEN || 'IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi'}" CLOUDFLARE_ACCOUNT_ID="${process.env.CLOUDFLARE_ACCOUNT_ID || 'd8f0c1d7e9e70f806edb067057227cbe'}" npx wrangler pages deploy dist --project-name=supplementstack --commit-dirty=true`;
  
  execSync(deployCmd, { stdio: 'inherit' });

  console.log('🎉 Deployment successful!');
  console.log('🌐 Your app should be live at: https://supplementstack.pages.dev');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}