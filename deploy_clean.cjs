#!/usr/bin/env node

// Clean deployment script for Supplement Stack
// This script forces a clean deployment without cache issues

const { execSync } = require('child_process');

console.log('🚀 Starting clean deployment process...');

try {
  // Set environment variables
  process.env.CLOUDFLARE_API_TOKEN = 'IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe';

  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('🔄 Attempting deployment with cache bypass...');
  
  // Try multiple deployment strategies
  const deployStrategies = [
    'npx wrangler pages deploy dist --project-name supplementstack --commit-dirty=true --compatibility-date=2024-09-01',
    'npx wrangler pages deploy dist --project-name supplementstack --commit-dirty=true --no-bundle',
    'npx wrangler pages deploy dist --project-name supplementstack --commit-dirty=true --skip-caching'
  ];

  for (let i = 0; i < deployStrategies.length; i++) {
    try {
      console.log(`\n🎯 Trying deployment strategy ${i + 1}...`);
      execSync(deployStrategies[i], { stdio: 'inherit' });
      console.log('✅ Deployment successful!');
      break;
    } catch (error) {
      console.log(`❌ Strategy ${i + 1} failed, trying next...`);
      if (i === deployStrategies.length - 1) {
        throw new Error('All deployment strategies failed');
      }
    }
  }

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}