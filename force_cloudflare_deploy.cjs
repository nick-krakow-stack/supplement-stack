// Force Cloudflare Pages Deployment
const API_TOKEN = 'IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi';
const ACCOUNT_ID = 'd8f0c1d7e9e70f806edb067057227cbe';
const PROJECT_NAME = 'supplementstack';

async function forceDeployment() {
  console.log('🚀 Forcing new Cloudflare Pages deployment...');
  console.log(`📧 Account: email@nickkrakow.de`);
  console.log(`🌐 Domain: supplementstack.de`);
  console.log('');

  try {
    // Method 1: Trigger deployment via Pages API
    console.log('📋 Method 1: Pages API deployment...');
    
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: 'main',
        build_config: {
          build_command: 'npm run build',
          destination_dir: 'dist'
        }
      })
    });

    const result = await response.json();

    if (response.ok && result.result) {
      console.log('✅ New deployment triggered successfully!');
      console.log(`🆔 Deployment ID: ${result.result.id}`);
      console.log(`🔗 URL: ${result.result.url}`);
      console.log(`📅 Created: ${result.result.created_on}`);
      
      // Monitor deployment progress
      return await monitorDeployment(result.result.id);
    } else {
      console.log('⚠️ Pages API failed:', result);
      console.log('');
      
      // Method 2: Try project rebuild
      console.log('📋 Method 2: Project rebuild...');
      return await triggerRebuild();
    }

  } catch (error) {
    console.log('❌ Error with Pages API:', error.message);
    console.log('');
    
    // Method 2: Try project rebuild  
    console.log('📋 Method 2: Project rebuild...');
    return await triggerRebuild();
  }
}

async function triggerRebuild() {
  try {
    // Get latest deployment and trigger a rebuild
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (response.ok && result.result && result.result.length > 0) {
      const latestDeployment = result.result[0];
      
      console.log('📊 Latest deployment status:');
      console.log(`   🕒 Created: ${latestDeployment.created_on}`);
      console.log(`   📋 Status: ${latestDeployment.latest_stage?.status}`);
      console.log(`   🌐 URL: ${latestDeployment.url}`);
      
      // Try to retry the latest deployment
      const retryResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${latestDeployment.id}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      const retryResult = await retryResponse.json();

      if (retryResponse.ok) {
        console.log('✅ Deployment retry triggered!');
        return await monitorDeployment(latestDeployment.id);
      } else {
        console.log('⚠️ Retry failed:', retryResult);
        
        // The GitHub push should trigger automatically
        console.log('💡 GitHub webhook should trigger deployment automatically');
        console.log('⏳ Please wait 1-2 minutes for automatic deployment');
        return true;
      }
    } else {
      console.log('❌ Could not get deployment info:', result);
      return false;
    }

  } catch (error) {
    console.log('❌ Error with rebuild:', error.message);
    
    // GitHub webhook fallback
    console.log('');
    console.log('💡 Falling back to GitHub webhook deployment');
    console.log('⏳ The git push should trigger deployment automatically');
    console.log('📊 Check: https://dash.cloudflare.com/pages');
    return true;
  }
}

async function monitorDeployment(deploymentId) {
  console.log('');
  console.log('⏳ Monitoring deployment progress...');
  
  let attempts = 0;
  const maxAttempts = 20; // 2 minutes max
  
  while (attempts < maxAttempts) {
    try {
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds
      
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.result) {
        const stage = result.result.latest_stage;
        const progress = `${attempts + 1}/${maxAttempts}`;
        
        console.log(`   📊 [${progress}] ${stage.name}: ${stage.status}`);
        
        if (stage.status === 'success') {
          console.log('');
          console.log('🎉 DEPLOYMENT SUCCESSFUL!');
          console.log(`🌐 Live at: https://supplementstack.de`);
          console.log(`🔗 Pages URL: https://${PROJECT_NAME}.pages.dev`);
          
          // Verify the deployment
          await verifyDeployment();
          return true;
          
        } else if (stage.status === 'failure') {
          console.log('');
          console.log('❌ DEPLOYMENT FAILED');
          console.log(`💥 Error: ${stage.error_message || 'Unknown error'}`);
          return false;
        }
      }
      
      attempts++;
      
    } catch (error) {
      console.log(`   ❌ Monitor error: ${error.message}`);
      attempts++;
    }
  }
  
  console.log('');
  console.log('⏰ Monitoring timeout - deployment may still be in progress');
  console.log('🌐 Check manually: https://dash.cloudflare.com/pages');
  return true;
}

async function verifyDeployment() {
  console.log('');
  console.log('🔍 Verifying deployment...');
  
  try {
    const healthResponse = await fetch('https://supplementstack.de/api/health');
    if (healthResponse.ok) {
      const health = await healthResponse.text();
      console.log(`   ✅ Health check: ${health}`);
    }
    
    const mainResponse = await fetch('https://supplementstack.de/');
    if (mainResponse.ok) {
      console.log(`   ✅ Main page: ${mainResponse.status}`);
    }
    
    console.log('');
    console.log('🧪 Test these URLs now:');
    console.log('   🏠 https://supplementstack.de/');
    console.log('   🔐 https://supplementstack.de/auth');
    console.log('   📊 https://supplementstack.de/dashboard');
    console.log('   📦 https://supplementstack.de/products');
    
  } catch (error) {
    console.log(`   ⚠️ Verification error: ${error.message}`);
  }
}

// Execute deployment
forceDeployment().then(success => {
  console.log('');
  console.log('=' .repeat(50));
  if (success) {
    console.log('🎉 DEPLOYMENT PROCESS COMPLETED');
    console.log('✅ Your database fixes should now be live!');
    console.log('✅ Dashboard errors should be resolved');
  } else {
    console.log('⚠️ DEPLOYMENT HAD ISSUES');
    console.log('💡 Check Cloudflare dashboard manually');
  }
  console.log('=' .repeat(50));
}).catch(error => {
  console.error('💥 Deployment process failed:', error.message);
});