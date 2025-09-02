// Cloudflare Workers Static Assets Direct Upload
// Modern 3-phase deployment process: https://developers.cloudflare.com/workers/static-assets/direct-upload/

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const CLOUDFLARE_API_TOKEN = '6de775cfcd599b036dae4a07cf8309d956f6d' // Global API Key as token
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe'
const SCRIPT_NAME = 'supplementstack'

function calculateFileHash(filePath) {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('md5').update(content).digest('hex')
}

function getAllFiles(dir, baseDir = dir) {
  const files = []
  const items = fs.readdirSync(dir)
  
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir))
    } else {
      const relativePath = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/')
      files.push({
        path: relativePath,
        fullPath: fullPath,
        hash: calculateFileHash(fullPath),
        size: stat.size
      })
    }
  }
  
  return files
}

async function phase1_registerManifest(files) {
  console.log('📋 Phase 1: Registering upload manifest...')
  
  // Build manifest object
  const manifest = {}
  for (const file of files) {
    manifest[file.path] = {
      hash: file.hash,
      size: file.size
    }
  }
  
  console.log(`   Files in manifest: ${Object.keys(manifest).length}`)
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/assets-upload-session`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ manifest })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Manifest registered successfully')
      console.log(`   Upload JWT received (expires in 1 hour)`)
      console.log(`   Buckets to upload: ${data.result.buckets?.length || 0}`)
      
      return {
        uploadJWT: data.result.jwt,
        buckets: data.result.buckets || []
      }
    } else {
      console.error('❌ Manifest registration failed:', data)
      return null
    }
  } catch (error) {
    console.error('💥 Error registering manifest:', error.message)
    return null
  }
}

async function phase2_uploadFiles(files, uploadJWT, buckets) {
  console.log('📤 Phase 2: Uploading missing files...')
  
  if (buckets.length === 0) {
    console.log('   No files need uploading (all unchanged)')
    return uploadJWT // Return the JWT as completion token
  }
  
  const fileMap = {}
  files.forEach(file => {
    fileMap[file.hash] = file
  })
  
  let completionJWT = null
  
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i]
    console.log(`   Uploading bucket ${i + 1}/${buckets.length} (${bucket.length} files)`)
    
    // Create FormData for multipart upload
    const FormData = (await import('form-data')).default
    const form = new FormData()
    
    for (const hash of bucket) {
      const file = fileMap[hash]
      if (file) {
        const content = fs.readFileSync(file.fullPath)
        const base64Content = content.toString('base64')
        
        // Determine content type
        const ext = path.extname(file.path).toLowerCase()
        let contentType = 'application/octet-stream'
        if (ext === '.html') contentType = 'text/html'
        else if (ext === '.js') contentType = 'application/javascript'
        else if (ext === '.css') contentType = 'text/css'
        else if (ext === '.json') contentType = 'application/json'
        
        form.append(hash, base64Content, {
          contentType: contentType,
          filename: path.basename(file.path)
        })
        
        console.log(`     📄 ${file.path} (${file.size} bytes)`)
      }
    }
    
    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/assets/upload?base64=true`
    
    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${uploadJWT}`,
          ...form.getHeaders()
        },
        body: form
      })
      
      const data = await response.json()
      
      if (response.ok) {
        console.log(`   ✅ Bucket ${i + 1} uploaded successfully`)
        if (response.status === 201 && data.result?.jwt) {
          completionJWT = data.result.jwt
          console.log('   🎯 Received completion JWT')
        }
      } else {
        console.error(`   ❌ Bucket ${i + 1} upload failed:`, data)
        return null
      }
    } catch (error) {
      console.error(`   💥 Error uploading bucket ${i + 1}:`, error.message)
      return null
    }
  }
  
  return completionJWT || uploadJWT
}

async function phase3_deployWorker(completionJWT) {
  console.log('🚀 Phase 3: Deploying Worker with assets...')
  
  // Read the main worker file
  const workerPath = 'dist/_worker.js'
  if (!fs.existsSync(workerPath)) {
    console.error('❌ Worker file not found:', workerPath)
    return false
  }
  
  const workerContent = fs.readFileSync(workerPath, 'utf8')
  
  // Create FormData for multipart deployment
  const FormData = (await import('form-data')).default
  const form = new FormData()
  
  // Add the main worker script
  form.append('main.js', workerContent, {
    contentType: 'application/javascript',
    filename: 'main.js'
  })
  
  // Add metadata with assets JWT
  const metadata = {
    main_module: 'main.js',
    compatibility_date: '2023-08-14',
    assets: {
      jwt: completionJWT
    },
    bindings: [
      {
        name: 'ASSETS',
        type: 'assets'
      }
    ]
  }
  
  form.append('metadata', JSON.stringify(metadata), {
    contentType: 'application/json'
  })
  
  const deployUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`
  
  try {
    const response = await fetch(deployUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        ...form.getHeaders()
      },
      body: form
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Worker deployed successfully!')
      console.log(`   Script: ${data.result.id}`)
      console.log(`   Modified: ${data.result.modified_on}`)
      return true
    } else {
      console.error('❌ Worker deployment failed:', data)
      return false
    }
  } catch (error) {
    console.error('💥 Error deploying worker:', error.message)
    return false
  }
}

async function deployToCloudflare() {
  console.log('🚀 Cloudflare Workers Direct Upload Deployment')
  console.log('=' .repeat(50))
  
  // Ensure dist folder exists and is built
  if (!fs.existsSync('dist')) {
    console.error('❌ dist/ folder not found. Run: npm run build')
    return false
  }
  
  // Get all files to upload
  const files = getAllFiles('dist')
  console.log(`📁 Found ${files.length} files to deploy`)
  
  // Phase 1: Register manifest
  const manifestResult = await phase1_registerManifest(files)
  if (!manifestResult) {
    console.error('❌ Failed to register manifest')
    return false
  }
  
  // Phase 2: Upload files
  const completionJWT = await phase2_uploadFiles(files, manifestResult.uploadJWT, manifestResult.buckets)
  if (!completionJWT) {
    console.error('❌ Failed to upload files')
    return false
  }
  
  // Phase 3: Deploy worker
  const deploySuccess = await phase3_deployWorker(completionJWT)
  if (!deploySuccess) {
    console.error('❌ Failed to deploy worker')
    return false
  }
  
  console.log('')
  console.log('🎉 Deployment completed successfully!')
  console.log('🌐 Your MailerSend system should now be live at:')
  console.log('   https://supplementstack.pages.dev/')
  console.log('   https://supplementstack.de/')
  console.log('')
  console.log('🧪 Test the deployment:')
  console.log('   - Registration: https://supplementstack.de/auth')
  console.log('   - Password Reset: https://supplementstack.de/reset-password')
  console.log('   - API Health: https://supplementstack.de/api/health')
  
  return true
}

// Run if executed directly
if (require.main === module) {
  deployToCloudflare().catch(error => {
    console.error('💥 Deployment failed:', error.message)
    process.exit(1)
  })
}

module.exports = { deployToCloudflare }