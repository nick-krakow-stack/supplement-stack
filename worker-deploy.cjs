#!/usr/bin/env node

// Direct Worker deployment - bypass Pages complexity
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Direct Worker deployment strategy...');

try {
  // Build normally
  execSync('npm run build', { stdio: 'inherit' });
  
  // Deploy as Worker instead of Pages
  const workerConfig = `
name = "supplementstack-api"
main = "dist/_worker.js"
compatibility_date = "2024-09-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "supplementstack-production"
database_id = "f1336769-9231-4cfa-a54b-91a261f07b08"

[vars]
ENVIRONMENT = "production"
JWT_SECRET = "supplement-stack-jwt-2024-secure-production-key"
`;

  fs.writeFileSync('wrangler-worker-deploy.toml', workerConfig);
  
  console.log('📦 Deploying as Cloudflare Worker...');
  
  const deployCmd = `CLOUDFLARE_API_TOKEN="IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi" CLOUDFLARE_ACCOUNT_ID="d8f0c1d7e9e70f806edb067057227cbe" npx wrangler deploy --config wrangler-worker-deploy.toml --name supplementstack-api`;
  
  execSync(deployCmd, { stdio: 'inherit' });
  
  console.log('🎉 Worker deployment successful!');
  console.log('🌐 API available at: https://supplementstack-api.nickkrakow.de.workers.dev');
  
} catch (error) {
  console.error('❌ Worker deployment failed:', error.message);
  
  // Final fallback: Try GitHub deployment trigger
  console.log('🔄 Trying to trigger GitHub deployment...');
  
  // Create empty commit to trigger deployment
  try {
    execSync('git commit --allow-empty -m "trigger: Force deployment to Cloudflare Pages"', { stdio: 'inherit' });
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('✅ GitHub deployment triggered. Check Cloudflare Pages dashboard.');
  } catch (gitError) {
    console.error('❌ GitHub deployment trigger failed:', gitError.message);
  }
}