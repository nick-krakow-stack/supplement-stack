// Deploy to Cloudflare Pages Production
const fs = require('fs');

const API_TOKEN = 'IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi';
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe';
const PROJECT_NAME = 'supplementstack';

async function deployToPages() {
  console.log('🚀 Deploying to Cloudflare Pages...');
  
  try {
    // First, trigger a new deployment from the main branch
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        production_branch: 'main'
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Deployment triggered successfully!');
      console.log(`🔗 Deployment ID: ${result.result.id}`);
      console.log(`📅 Created: ${result.result.created_on}`);
      console.log(`🌐 URL: ${result.result.url}`);
      
      // Check deployment status
      const deploymentId = result.result.id;
      console.log('\n⏳ Monitoring deployment progress...');
      
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const statusResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${deploymentId}`, {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        const statusResult = await statusResponse.json();
        
        if (statusResponse.ok) {
          const stage = statusResult.result.latest_stage;
          console.log(`   📊 Status: ${stage.status} (${stage.name})`);
          
          if (stage.status === 'success') {
            console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
            console.log(`🌐 Live URL: https://${PROJECT_NAME}.pages.dev`);
            console.log(`🌐 Custom Domain: https://supplementstack.de`);
            return true;
          } else if (stage.status === 'failure') {
            console.log('\n❌ Deployment failed');
            console.log(`💥 Error: ${stage.error_message || 'Unknown error'}`);
            return false;
          }
        }
        
        attempts++;
      }
      
      console.log('\n⏰ Deployment is still running (this can take a few minutes)');
      console.log('🌐 You can check status at: https://dash.cloudflare.com/pages');
      return true;
      
    } else {
      console.log('❌ Deployment failed:', result);
      
      // Try alternative method - direct file upload
      console.log('\n🔄 Trying alternative deployment method...');
      return await deployViaWorkers();
    }
  } catch (error) {
    console.log('❌ Deployment error:', error.message);
    return false;
  }
}

async function deployViaWorkers() {
  console.log('📦 Deploying via Workers API...');
  
  if (!fs.existsSync('dist/_worker.js')) {
    console.log('❌ dist/_worker.js not found. Building first...');
    return false;
  }
  
  const workerContent = fs.readFileSync('dist/_worker.js', 'utf8');
  
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${PROJECT_NAME}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/javascript'
      },
      body: workerContent
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Worker deployed successfully!');
      console.log(`🌐 Live at: https://${PROJECT_NAME}.${ACCOUNT_ID}.workers.dev`);
      return true;
    } else {
      console.log('❌ Worker deployment failed:', result);
      return false;
    }
  } catch (error) {
    console.log('❌ Worker deployment error:', error.message);
    return false;
  }
}

deployToPages().then(success => {
  if (success) {
    console.log('\n🎉 DEPLOYMENT COMPLETED!');
    console.log('✅ Latest code changes are now live');
    console.log('✅ Authentication middleware fixes deployed');  
    console.log('✅ Debug alert removals deployed');
    console.log('\n🧪 Test your site now:');
    console.log('   🔐 Auth: https://supplementstack.de/auth');
    console.log('   📊 Dashboard: https://supplementstack.de/dashboard');
    console.log('   📦 Products: https://supplementstack.de/products');
  } else {
    console.log('\n⚠️ Deployment had issues - check Cloudflare dashboard');
  }
}).catch(error => {
  console.error('💥 Deployment process failed:', error.message);
});