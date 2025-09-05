#!/usr/bin/env node

// Simple deployment script that creates a clean worker
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Creating simple deployment...');

// Read the source file
const srcPath = path.join(__dirname, 'src', 'index.ts');
let srcContent = fs.readFileSync(srcPath, 'utf8');

console.log('📝 Source file size:', srcContent.length);

// Create a simple export for Cloudflare Worker
const simpleWorker = `
// Simple Cloudflare Worker export
${srcContent}

// Export for Cloudflare Workers
export default app;
`;

// Write to a simple file
const distDir = path.join(__dirname, 'dist-simple');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

fs.writeFileSync(path.join(distDir, '_worker.js'), simpleWorker);
fs.copyFileSync(path.join(__dirname, 'dist', '_routes.json'), path.join(distDir, '_routes.json'));

// Copy static files
if (fs.existsSync(path.join(__dirname, 'public'))) {
  execSync(`cp -r public/* ${distDir}/`, { cwd: __dirname });
}

console.log('✅ Simple deployment package created!');
console.log('📁 Location: dist-simple/');
console.log('📊 Worker size:', fs.statSync(path.join(distDir, '_worker.js')).size, 'bytes');