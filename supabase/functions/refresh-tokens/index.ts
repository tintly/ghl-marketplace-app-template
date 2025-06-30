import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface RefreshTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
}

interface ConfigurationToRefresh {
  id: string
  ghl_account_id: string
  refresh_token: string
  token_expires_at: string
  business_name: string
}

interface RefreshResult {
  configId: string
  locationId: string
  businessName: string
  success: boolean
  error?: string
  hoursUntilExpiry?: number
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  try {
    console.log('=== TOKEN REFRESH PROCESS START ===')
    
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get configurations that need token refresh
    const configurationsToRefresh = await getConfigurationsNeedingRefresh(supabase)
    
    console.log(`Found ${configurationsToRefresh.length} configurations that need token refresh`)

    if (configurationsToRefresh.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No tokens need refreshing at this time",
          refreshed: 0,
          results: []
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Process each configuration
    const results: RefreshResult[] = []
    let successCount = 0

    for (const config of configurationsToRefresh) {
      try {
        console.log(`Processing token refresh for config ${config.id} (${config.business_name})`)
        
        const refreshResult = await refreshTokenForConfiguration(config)
        
        if (refreshResult.success) {
          // Update the database with new tokens
          await updateConfigurationTokens(supabase, config.id, refreshResult.tokenData!)
          successCount++
          
          results.push({
            configId: config.id,
            locationId: config.ghl_account_id,
            businessName: config.business_name,
            success: true,
            hoursUntilExpiry: calculateHoursUntilExpiry(config.token_expires_at)
          })
          
          console.log(`✅ Successfully refreshed tokens for ${config.business_name}`)
        } else {
          results.push({
            configId: config.id,
            locationId: config.ghl_account_id,
            businessName: config.business_name,
            success: false,
            error: refreshResult.error,
            hoursUntilExpiry: calculateHoursUntilExpiry(config.token_expires_at)
          })
          
          console.log(`❌ Failed to refresh tokens for ${config.business_name}: ${refreshResult.error}`)
        }
      } catch (error) {
        console.error(`Error processing config ${config.id}:`, error)
        results.push({
          configId: config.id,
          locationId: config.ghl_account_id,
          businessName: config.business_name,
          success: false,
          error: error.message,
          hoursUntilExpiry: calculateHoursUntilExpiry(config.token_expires_at)
        })
      }
    }

    console.log(`=== TOKEN REFRESH COMPLETE ===`)
    console.log(`Total processed: ${configurationsToRefresh.length}`)
    console.log(`Successful refreshes: ${successCount}`)
    console.log(`Failed refreshes: ${configurationsToRefresh.length - successCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Token refresh completed. ${successCount}/${configurationsToRefresh.length} tokens refreshed successfully.`,
        refreshed: successCount,
        total: configurationsToRefresh.length,
        results: results
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )

  } catch (error) {
    console.error("=== TOKEN REFRESH ERROR ===")
    console.error("Error message:", error.message)
    
    return new Response(
      JSON.stringify({ 
        error: `Token refresh failed: ${error.message}`,
        details: error.toString()
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }
})

async function getConfigurationsNeedingRefresh(supabase: any): Promise<ConfigurationToRefresh[]> {
  console.log('=== FINDING CONFIGURATIONS NEEDING REFRESH ===')
  
  // Get all active configurations with real tokens (not dev/test tokens)
  const { data: configs, error } = await supabase
    .from('ghl_configurations')
    .select('id, ghl_account_id, refresh_token, token_expires_at, business_name, access_token')
    .eq('is_active', true)
    .not('refresh_token', 'is', null)
    .not('access_token', 'is', null)

  if (error) {
    console.error('Error fetching configurations:', error)
    throw new Error(`Failed to fetch configurations: ${error.message}`)
  }

  if (!configs || configs.length === 0) {
    console.log('No active configurations found')
    return []
  }

  console.log(`Found ${configs.length} active configurations`)

  // Filter configurations that need refresh
  const needsRefresh: ConfigurationToRefresh[] = []
  const now = new Date()

  for (const config of configs) {
    // Skip configurations with dev/test tokens
    if (config.access_token?.startsWith('dev-') || 
        config.access_token?.startsWith('test-') ||
        config.refresh_token?.startsWith('dev-') || 
        config.refresh_token?.startsWith('test-')) {
      console.log(`Skipping ${config.business_name} - has dev/test tokens`)
      continue
    }

    if (!config.token_expires_at) {
      console.log(`Skipping ${config.business_name} - no expiry date`)
      continue
    }

    const expiryDate = new Date(config.token_expires_at)
    const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Refresh if token expires within 24 hours or has already expired
    if (hoursUntilExpiry <= 24) {
      console.log(`${config.business_name} needs refresh - expires in ${Math.round(hoursUntilExpiry)} hours`)
      needsRefresh.push({
        id: config.id,
        ghl_account_id: config.ghl_account_id,
        refresh_token: config.refresh_token,
        token_expires_at: config.token_expires_at,
        business_name: config.business_name
      })
    } else {
      console.log(`${config.business_name} is fine - expires in ${Math.round(hoursUntilExpiry)} hours`)
    }
  }

  console.log(`${needsRefresh.length} configurations need token refresh`)
  return needsRefresh
}

async function refreshTokenForConfiguration(config: ConfigurationToRefresh): Promise<{
  success: boolean
  error?: string
  tokenData?: RefreshTokenResponse
}> {
  try {
    console.log(`Refreshing token for ${config.business_name}...`)
    
    const clientId = Deno.env.get('GHL_MARKETPLACE_CLIENT_ID')
    const clientSecret = Deno.env.get('GHL_MARKETPLACE_CLIENT_SECRET')
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'

    if (!clientId || !clientSecret) {
      throw new Error('GHL_MARKETPLACE_CLIENT_ID and GHL_MARKETPLACE_CLIENT_SECRET must be set')
    }

    const tokenUrl = `${apiDomain}/oauth/token`
    
    // Prepare refresh token request
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token
    })

    console.log(`Making refresh token request to: ${tokenUrl}`)

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Token refresh failed for ${config.business_name}:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      
      // Handle specific error cases
      if (response.status === 400) {
        return {
          success: false,
          error: `Invalid refresh token - may need to reinstall app`
        }
      } else if (response.status === 401) {
        return {
          success: false,
          error: `Unauthorized - refresh token may be expired`
        }
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`
        }
      }
    }

    const tokenData: RefreshTokenResponse = await response.json()
    
    console.log(`Token refresh successful for ${config.business_name}`)
    console.log(`New token expires in ${tokenData.expires_in} seconds`)
    
    return {
      success: true,
      tokenData
    }

  } catch (error) {
    console.error(`Token refresh error for ${config.business_name}:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}

async function updateConfigurationTokens(
  supabase: any, 
  configId: string, 
  tokenData: RefreshTokenResponse
): Promise<void> {
  console.log(`Updating database with new tokens for config ${configId}`)
  
  // Calculate new expiry time
  const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
  
  const { error } = await supabase
    .from('ghl_configurations')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', configId)

  if (error) {
    console.error(`Failed to update tokens in database for config ${configId}:`, error)
    throw new Error(`Database update failed: ${error.message}`)
  }

  console.log(`Successfully updated tokens in database for config ${configId}`)
}

function calculateHoursUntilExpiry(tokenExpiresAt: string): number {
  const expiryDate = new Date(tokenExpiresAt)
  const now = new Date()
  return Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60))
}