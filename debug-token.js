const locationId = '3lkoUn4O7jExzrkx3shg';

// Test with your actual token from the database
async function testToken() {
  try {
    console.log('Testing GHL API token...');
    
    // First, let's get the token from your database
    const dbResponse = await fetch('https://zjgwpgllznqhexyadozz.supabase.co/rest/v1/ghl_configurations', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZ3dwZ2xsem5xaGV4eWFkb3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg5OTIyMiwiZXhwIjoyMDY2NDc1MjIyfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZ3dwZ2xsem5xaGV4eWFkb3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg5OTIyMiwiZXhwIjoyMDY2NDc1MjIyfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'
      }
    });
    
    if (!dbResponse.ok) {
      throw new Error(`Database query failed: ${dbResponse.status}`);
    }
    
    const configs = await dbResponse.json();
    console.log('Database configs found:', configs.length);
    
    const config = configs.find(c => c.ghl_account_id === locationId && c.is_active);
    
    if (!config) {
      console.log('❌ No active configuration found for location:', locationId);
      return;
    }
    
    console.log('✅ Configuration found:', {
      id: config.id,
      business_name: config.business_name,
      has_access_token: !!config.access_token,
      has_refresh_token: !!config.refresh_token,
      token_expires_at: config.token_expires_at,
      token_prefix: config.access_token?.substring(0, 20) + '...'
    });
    
    // Check token expiry
    if (config.token_expires_at) {
      const expiryDate = new Date(config.token_expires_at);
      const now = new Date();
      const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      console.log('Token expiry info:', {
        expires_at: config.token_expires_at,
        hours_until_expiry: Math.round(hoursUntilExpiry * 100) / 100,
        is_expired: hoursUntilExpiry <= 0
      });
      
      if (hoursUntilExpiry <= 0) {
        console.log('❌ TOKEN IS EXPIRED! This explains the "Invalid JWT" error.');
        return;
      }
    }
    
    // Test the token with GHL API
    console.log('Testing token with GHL API...');
    
    const ghlResponse = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    });
    
    console.log('GHL API Response:', {
      status: ghlResponse.status,
      statusText: ghlResponse.statusText,
      headers: Object.fromEntries(ghlResponse.headers.entries())
    });
    
    const responseText = await ghlResponse.text();
    
    if (ghlResponse.ok) {
      console.log('✅ TOKEN IS VALID! API call successful.');
      try {
        const data = JSON.parse(responseText);
        console.log('Location data:', {
          name: data.location?.name || data.name,
          id: data.location?.id || data.id
        });
      } catch (e) {
        console.log('Response (raw):', responseText.substring(0, 200));
      }
    } else {
      console.log('❌ TOKEN FAILED! API call failed.');
      console.log('Error response:', responseText);
      
      if (ghlResponse.status === 401) {
        console.log('🔄 Attempting token refresh...');
        await attemptTokenRefresh(config);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

async function attemptTokenRefresh(config) {
  try {
    const params = new URLSearchParams({
      client_id: 'your-client-id', // You'll need to add this
      client_secret: 'your-client-secret', // You'll need to add this
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token
    });

    const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (response.ok) {
      const tokenData = await response.json();
      console.log('✅ Token refresh successful!');
      console.log('New token prefix:', tokenData.access_token.substring(0, 20) + '...');
      
      // You would update the database here
      console.log('💡 Update your database with the new tokens');
    } else {
      const errorText = await response.text();
      console.log('❌ Token refresh failed:', errorText);
    }
  } catch (error) {
    console.log('❌ Token refresh error:', error.message);
  }
}

testToken();