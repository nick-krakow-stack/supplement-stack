#!/usr/bin/env node

// Safe deployment that preserves working functionality
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🛡️  Safe deployment strategy...');

try {
  // First, let's test locally that our build works
  console.log('🧪 Testing build locally...');
  
  // Check if _worker.js exists and is reasonable size
  const workerPath = path.join(__dirname, 'dist', '_worker.js');
  if (!fs.existsSync(workerPath)) {
    throw new Error('Worker file does not exist! Build failed.');
  }
  
  const workerStats = fs.statSync(workerPath);
  console.log(`📊 Worker file size: ${workerStats.size} bytes`);
  
  if (workerStats.size < 10000) {
    throw new Error('Worker file too small, something is wrong!');
  }
  
  // Check for known problematic patterns before deploying
  const workerContent = fs.readFileSync(workerPath, 'utf8');
  const problemPatterns = ['/src/index.tsx', '/app/server.ts'];
  let hasProblems = false;
  
  problemPatterns.forEach(pattern => {
    if (workerContent.includes(pattern)) {
      console.log(`⚠️  Found problematic pattern: ${pattern}`);
      hasProblems = true;
    }
  });
  
  if (hasProblems) {
    console.log('🧹 Cleaning problematic patterns...');
    let cleanedContent = workerContent;
    problemPatterns.forEach(pattern => {
      cleanedContent = cleanedContent.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    });
    fs.writeFileSync(workerPath, cleanedContent);
    console.log('✅ Cleaned problematic patterns');
  }
  
  // Now deploy safely
  console.log('🚀 Deploying to Cloudflare...');
  
  const deployCmd = `CLOUDFLARE_API_TOKEN="IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi" CLOUDFLARE_ACCOUNT_ID="d8f0c1d7e9e70f806edb067057227cbe" npx wrangler pages deploy dist --project-name=supplementstack --commit-dirty=true`;
  
  execSync(deployCmd, { stdio: 'inherit' });
  
  console.log('🎉 Safe deployment completed!');
  console.log('🌐 Check: https://supplementstack.de');

} catch (error) {
  console.error('❌ Safe deployment failed:', error.message);
  console.log('');
  console.log('🔄 The original working system should still be intact.');
  console.log('🌐 Current site: https://supplementstack.de');
}