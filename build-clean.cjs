#!/usr/bin/env node

// Clean build script that removes problematic import references
const fs = require('fs');
const path = require('path');

console.log('🔨 Starting clean build process...');

// Read the original worker file
const workerPath = path.join(__dirname, 'dist', '_worker.js');
let workerContent = fs.readFileSync(workerPath, 'utf8');

console.log('📝 Original file size:', workerContent.length);

// Remove problematic import references
const originalLength = workerContent.length;
workerContent = workerContent.replace(/\/src\/index\.tsx/g, '/main.tsx');
workerContent = workerContent.replace(/\/app\/server\.ts/g, '/server.ts');
workerContent = workerContent.replace(/src\/index\.tsx/g, 'main.tsx');
workerContent = workerContent.replace(/app\/server\.ts/g, 'server.ts');

console.log('🧹 Cleaned file size:', workerContent.length);
console.log('📊 Removed', originalLength - workerContent.length, 'characters');

// Write the cleaned file
fs.writeFileSync(workerPath, workerContent);

console.log('✅ Clean build completed successfully!');