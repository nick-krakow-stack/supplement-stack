#!/usr/bin/env node

// Simple build without problematic Vite plugins
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Creating simple build...');

// Read source
const srcPath = path.join(__dirname, 'src', 'index.ts');
let srcContent = fs.readFileSync(srcPath, 'utf8');

// Remove TypeScript types (simple approach)
let jsContent = srcContent
  .replace(/: [A-Z][a-zA-Z<>[\],\s]*/g, '') // Remove type annotations
  .replace(/interface [^{}]*{[^{}]*}/g, '') // Remove interfaces
  .replace(/type [^=]*=[^;]*;/g, '') // Remove type definitions
  .replace(/import.*from.*['"][^'"]*['"];?\n?/g, '') // Remove imports
  .replace(/export\s+{[^}]*}\s*from[^;]*;?\n?/g, ''); // Remove re-exports

// Add necessary imports at the top
const workerCode = `
// Cloudflare Worker for Supplement Stack
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-pages';

${jsContent}

// Export for Cloudflare Worker
export default app;
`;

// Ensure dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Write simple worker
fs.writeFileSync(path.join(distDir, '_worker.js'), workerCode);

// Create basic _routes.json
const routes = {
  "version": 1,
  "include": ["/api/*"],
  "exclude": ["/static/*"]
};
fs.writeFileSync(path.join(distDir, '_routes.json'), JSON.stringify(routes, null, 2));

// Copy static files
if (fs.existsSync(path.join(__dirname, 'public'))) {
  execSync(`cp -r public/* ${distDir}/`, { cwd: __dirname });
}

console.log('✅ Simple build completed!');
console.log('📊 Worker size:', fs.statSync(path.join(distDir, '_worker.js')).size, 'bytes');