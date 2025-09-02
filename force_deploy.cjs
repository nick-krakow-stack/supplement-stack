// Force deployment to Cloudflare Pages via direct file upload
// This bypasses GitHub integration issues

const fs = require('fs')
const path = require('path')

const CLOUDFLARE_API_KEY = '6de775cfcd599b036dae4a07cf8309d956f6d'
const CLOUDFLARE_EMAIL = 'email@nickkrakow.de'
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe'
const PROJECT_NAME = 'supplementstack'

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  
  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList)
    } else {
      // Get relative path from dist folder
      const relativePath = path.relative('dist', filePath)
      fileList.push({
        path: relativePath,
        fullPath: filePath,
        size: stat.size
      })
    }
  })
  
  return fileList
}

async function createDirectDeployment() {
  console.log('🚀 Starting direct deployment to Cloudflare Pages...')
  
  // Get all files to upload
  const files = getAllFiles('dist')
  console.log(`📁 Found ${files.length} files to deploy`)
  
  // Create manifest with 32-character hex hashes (MD5)
  const manifest = {}
  
  for (const file of files) {
    const content = fs.readFileSync(file.fullPath)
    const hash = require('crypto').createHash('md5').update(content).digest('hex')
    
    // Use proper path format (leading slash)
    const manifestPath = file.path.startsWith('/') ? file.path : '/' + file.path
    
    manifest[manifestPath] = {
      hash: hash,
      size: file.size
    }
  }
  
  console.log('📋 Manifest created with', Object.keys(manifest).length, 'files')
  console.log('📄 Sample files:')
  Object.keys(manifest).slice(0, 3).forEach(path => {
    console.log(`   ${path} (${manifest[path].size} bytes, hash: ${manifest[path].hash})`)
  })
  
  // Try to create deployment with proper manifest format
  const deployUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`
  
  try {
    const response = await fetch(deployUrl, {
      method: 'POST',
      headers: {
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        manifest: manifest
      })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Deployment created:', data.result.id)
      console.log('📤 Upload URL:', data.result.upload_url)
      
      // Now upload files
      if (data.result.upload_url) {
        console.log('📤 Uploading files...')
        
        for (const file of files) {
          const content = fs.readFileSync(file.fullPath)
          const uploadUrl = `${data.result.upload_url}/${file.path}`
          
          console.log(`⬆️  Uploading ${file.path}...`)
          
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            body: content,
            headers: {
              'Content-Type': 'application/octet-stream'
            }
          })
          
          if (!uploadResponse.ok) {
            console.error(`❌ Failed to upload ${file.path}:`, uploadResponse.status)
          }
        }
        
        // Finalize deployment
        const finalizeUrl = `${deployUrl}/${data.result.id}`
        const finalizeResponse = await fetch(finalizeUrl, {
          method: 'PATCH',
          headers: {
            'X-Auth-Email': CLOUDFLARE_EMAIL,
            'X-Auth-Key': CLOUDFLARE_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            stage: 'deploy'
          })
        })
        
        if (finalizeResponse.ok) {
          console.log('✅ Deployment finalized successfully!')
          console.log(`🌐 Check status at: https://dash.cloudflare.com/`)
        }
      }
      
      return data.result
    } else {
      console.error('❌ Deployment creation failed:', data)
      return null
    }
  } catch (error) {
    console.error('💥 Error:', error.message)
    return null
  }
}

// Run if executed directly
if (require.main === module) {
  createDirectDeployment().then(result => {
    if (result) {
      console.log('🎉 Direct deployment completed!')
    } else {
      console.log('❌ Deployment failed - try manual upload via dashboard')
      console.log('📋 Manual steps:')
      console.log('  1. Go to https://dash.cloudflare.com/')
      console.log('  2. Select Pages > supplementstack')
      console.log('  3. Click "Upload assets"')
      console.log('  4. Upload the dist/ folder contents')
    }
  })
}

module.exports = { createDirectDeployment }