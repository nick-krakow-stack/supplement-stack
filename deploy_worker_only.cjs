// Deploy just the Worker without assets to test
const fs = require('fs')

const CLOUDFLARE_API_TOKEN = 'IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi'
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe'
const SCRIPT_NAME = 'supplementstack'

async function deployWorkerOnly() {
  console.log('🚀 Deploying Worker only (no assets)...')
  
  // Read the main worker file
  const workerPath = 'dist/_worker.js'
  if (!fs.existsSync(workerPath)) {
    console.error('❌ Worker file not found:', workerPath)
    return false
  }
  
  const workerContent = fs.readFileSync(workerPath, 'utf8')
  console.log(`📄 Worker file size: ${workerContent.length} bytes`)
  
  // Create FormData for deployment
  const FormData = require('form-data')
  const form = new FormData()
  
  // Add the main worker script
  form.append('main.js', workerContent)
  
  // Simple metadata without assets
  const metadata = {
    main_module: 'main.js',
    compatibility_date: '2023-08-14'
  }
  
  form.append('metadata', JSON.stringify(metadata))
  
  const deployUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`
  
  try {
    console.log('📤 Sending deployment request...')
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
      console.log(`   Script: ${data.result?.id}`)
      console.log(`   Modified: ${data.result?.modified_on}`)
      console.log('')
      console.log('🌐 Worker should be accessible at:')
      console.log(`   https://${SCRIPT_NAME}.${ACCOUNT_ID.substring(0,8)}.workers.dev/`)
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

deployWorkerOnly()