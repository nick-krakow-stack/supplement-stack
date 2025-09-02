// Cloudflare Pages build configuration
// This file ensures proper build settings for auto-deployment

export default {
  // Build command for Cloudflare Pages
  build: {
    command: 'npm run build',
    output: 'dist',
    environment: {
      NODE_VERSION: '18',
      NPM_FLAGS: '--ignore-scripts'
    }
  },
  
  // Ensure proper routing for SPA
  routing: {
    include: ['/*'],
    exclude: ['/api/*']
  },
  
  // Headers for security and performance
  headers: {
    '/*': [
      'X-Frame-Options: DENY',
      'X-Content-Type-Options: nosniff'
    ],
    '/static/*': [
      'Cache-Control: public, max-age=31536000'
    ]
  }
}