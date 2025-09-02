// Cloudflare Pages Deployment Solutions
// Multiple methods to trigger deployment: Deploy Hooks, Git Push, and Wrangler

const CLOUDFLARE_API_KEY = '6de775cfcd599b036dae4a07cf8309d956f6d'
const CLOUDFLARE_EMAIL = 'email@nickkrakow.de'
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe'
const PROJECT_NAME = 'supplementstack'

// If you have a deploy hook URL, set it here (created via dashboard)
const DEPLOY_HOOK_URL = process.env.DEPLOY_HOOK_URL || null

// Method 1: Deploy Hook (if URL is available)
async function triggerWithDeployHook() {
  if (!DEPLOY_HOOK_URL) {
    console.log('❌ No Deploy Hook URL configured')
    console.log('📋 To create a deploy hook:')
    console.log('  1. Go to https://dash.cloudflare.com/')
    console.log(`  2. Select Pages > ${PROJECT_NAME}`)
    console.log('  3. Go to Settings > Builds & deployments')
    console.log('  4. Click "Add deploy hook"')
    console.log('  5. Set name="api-trigger" and branch="main"')
    console.log('  6. Copy the webhook URL and set DEPLOY_HOOK_URL environment variable')
    return null
  }

  console.log('🪝 Triggering deployment via Deploy Hook...')
  
  try {
    const response = await fetch(DEPLOY_HOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      console.log('✅ Deploy Hook triggered successfully!')
      console.log('🌐 Check deployment status at: https://dash.cloudflare.com/')
      return { success: true, method: 'deploy_hook' }
    } else {
      console.error('❌ Deploy Hook failed:', response.status, response.statusText)
      const text = await response.text()
      console.error('📋 Response:', text)
      return null
    }
  } catch (error) {
    console.error('💥 Deploy Hook error:', error.message)
    return null
  }
}

// Method 2: Force Git push to trigger auto-deployment
async function triggerWithGitPush() {
  console.log('🔄 Attempting to trigger deployment via Git push...')
  
  try {
    const { execSync } = await import('child_process')
    
    // Check if we're in a Git repository
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' })
    } catch (error) {
      console.error('❌ Not in a Git repository')
      return null
    }
    
    // Check if there are any changes to commit
    const status = execSync('git status --porcelain', { encoding: 'utf8' })
    
    if (status.trim()) {
      console.log('📝 Found uncommitted changes, committing...')
      execSync('git add .')
      const timestamp = new Date().toISOString()
      execSync(`git commit -m "Deploy: MailerSend system update ${timestamp}"`)
    } else {
      console.log('📝 No changes to commit, creating empty commit to trigger deployment...')
      const timestamp = new Date().toISOString()
      execSync(`git commit --allow-empty -m "Trigger deployment: ${timestamp}"`)
    }
    
    // Push to main branch
    console.log('⬆️ Pushing to main branch...')
    execSync('git push origin main', { stdio: 'inherit' })
    
    console.log('✅ Git push completed! Auto-deployment should trigger shortly.')
    console.log('🌐 Monitor at: https://dash.cloudflare.com/')
    
    return { success: true, method: 'git_push' }
    
  } catch (error) {
    console.error('💥 Git push failed:', error.message)
    return null
  }
}

// Method 3: Direct API deployment (for completeness, may require manifest)
async function triggerWithAPI() {
  console.log('🚀 Attempting API deployment trigger...')
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_KEY,
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ API deployment triggered!')
      console.log('📊 Deployment ID:', data.result.id)
      return data.result
    } else {
      console.log('❌ API method failed (expected for Git-connected projects)')
      if (data.errors && data.errors[0]?.message?.includes('manifest')) {
        console.log('  This is normal for Git-connected projects - they need Deploy Hooks or Git pushes')
      }
      return null
    }
  } catch (error) {
    console.log('❌ API method not available:', error.message)
    return null
  }
}

async function checkProjectStatus() {
  console.log('🔍 Checking project status...')
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}`
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_KEY,
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Project found!')
      console.log('📋 Name:', data.result.name)
      console.log('🌐 Domains:', data.result.domains)
      console.log('📦 Latest deployment:', data.result.canonical_deployment?.id)
      return data.result
    } else {
      console.error('❌ Project check failed:', response.status, data)
      return null
    }
  } catch (error) {
    console.error('💥 Network error:', error)
    return null
  }
}

async function listDeployments() {
  console.log('📋 Listing recent deployments...')
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_KEY,
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log(`✅ Found ${data.result.length} deployments:`)
      data.result.slice(0, 5).forEach((deploy, i) => {
        console.log(`${i+1}. ${deploy.id} - ${deploy.environment} - ${deploy.latest_stage?.name}`)
      })
      return data.result
    } else {
      console.error('❌ Failed to list deployments:', response.status, data)
      return null
    }
  } catch (error) {
    console.error('💥 Network error:', error)
    return null
  }
}

// Main deployment orchestration
async function main() {
  console.log('🏁 Cloudflare Pages Deployment Orchestrator')
  console.log('='.repeat(50))
  
  // 1. Check project status
  const project = await checkProjectStatus()
  if (!project) {
    console.log('❌ Project not found or API credentials invalid')
    return
  }
  
  // 2. Show current deployment status
  console.log('\n📊 Current Deployment Status:')
  const deployments = await listDeployments()
  if (deployments && deployments.length > 0) {
    const latest = deployments[0]
    console.log(`   Latest: ${latest.id} (${latest.environment})`)
    console.log(`   Status: ${latest.latest_stage?.name || 'unknown'}`)
  }
  
  console.log('\n🚀 Attempting deployment trigger...')
  
  // 3. Try deployment methods in order of preference
  let result = null
  
  // First try Deploy Hook if available
  result = await triggerWithDeployHook()
  if (result) {
    console.log('\n✅ Deployment triggered via Deploy Hook!')
    return
  }
  
  // Next try Git push method
  result = await triggerWithGitPush()
  if (result) {
    console.log('\n✅ Deployment triggered via Git push!')
    console.log('   Auto-deployment should start within 1-2 minutes')
    console.log('   🌐 Monitor progress: https://dash.cloudflare.com/')
    return
  }
  
  // Finally try API method (likely to fail for Git projects)
  result = await triggerWithAPI()
  if (result) {
    console.log('\n✅ Deployment triggered via API!')
    return
  }
  
  // All methods failed
  console.log('\n❌ All deployment methods failed')
  console.log('📋 Manual options:')
  console.log('  1. Create a Deploy Hook in Cloudflare Dashboard')
  console.log('  2. Make a Git commit and push to main branch')
  console.log('  3. Use: npm run deploy (with wrangler)')
}

// Export for Node.js usage
if (typeof module !== 'undefined') {
  module.exports = { 
    main, 
    triggerWithDeployHook,
    triggerWithGitPush, 
    triggerWithAPI,
    checkProjectStatus, 
    listDeployments 
  }
}

// Run if executed directly  
if (typeof process !== 'undefined' && process.argv[1]?.includes('trigger_deployment')) {
  main()
}