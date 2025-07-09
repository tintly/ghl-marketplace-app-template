import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
  userType: string
  locationId?: string
  companyId?: string
  approvedLocations?: string[]
  userId?: string
  planId?: string
  isBulkInstallation?: string
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
    console.log('Processing OAuth token exchange...')
    
    const { code, state } = await req.json()
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: "Authorization code is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Exchange authorization code for access token
    console.log('Exchanging code for access token...')
    const tokenResponse = await exchangeCodeForToken(code)
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Save configuration to database using the userId from token response
    console.log('Saving configuration to database...')
    const savedConfig = await saveGHLConfiguration(supabase, tokenResponse, state)

    console.log('OAuth exchange completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: "Installation completed successfully",
        userType: tokenResponse.userType,
        locationId: tokenResponse.locationId,
        companyId: tokenResponse.companyId,
        userId: tokenResponse.userId,
        configId: savedConfig?.id,
        approvedLocations: tokenResponse.approvedLocations
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
    console.error("OAuth exchange error:", error)
    return new Response(
      JSON.stringify({ 
        error: `OAuth exchange failed: ${error.message}`,
        details: error.toString()
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }
})

async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const clientId = Deno.env.get('GHL_MARKETPLACE_CLIENT_ID')
  const clientSecret = Deno.env.get('GHL_MARKETPLACE_CLIENT_SECRET')
  const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'

  if (!clientId || !clientSecret) {
    throw new Error('GHL_MARKETPLACE_CLIENT_ID and GHL_MARKETPLACE_CLIENT_SECRET must be set')
  }

  const tokenUrl = `${apiDomain}/oauth/token`
  
  // Get the current request URL to build the redirect URI
  const currentUrl = new URL(Deno.env.get('SUPABASE_URL') || 'http://localhost:3000')
  const redirectUri = `${currentUrl.origin}/oauth/callback`
  
  // Prepare form data as URLSearchParams (application/x-www-form-urlencoded)
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri
  })

  console.log('Making token exchange request to:', tokenUrl)
  console.log('Using redirect_uri:', redirectUri)
  console.log('Using client_id:', clientId)

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
    console.error('Token exchange failed:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      redirectUri: redirectUri
    })
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`)
  }

  const tokenData = await response.json()
  console.log('Token exchange successful:', { 
    userType: tokenData.userType,
    locationId: tokenData.locationId,
    companyId: tokenData.companyId,
    userId: tokenData.userId,
    hasRefreshToken: !!tokenData.refresh_token,
    approvedLocations: tokenData.approvedLocations?.length || 0
  })
  
  return tokenData
}

async function saveGHLConfiguration(supabase: any, tokenData: TokenResponse, state: string | null) {
  // Use locationId as primary identifier, fallback to companyId
  const resourceId = tokenData.locationId || tokenData.companyId!
  
  // Use userId from token response - this is the key fix!
  const userId = tokenData.userId
  
  console.log('=== SAVING CONFIGURATION ===')
  console.log('Resource ID:', resourceId)
  console.log('User ID from token:', userId)
  console.log('User Type:', tokenData.userType)

  // Calculate token expiration time
  const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()

  // Prepare configuration data with the userId from the token response
  const configData = {
    user_id: userId, // Use the userId from GHL token response
    ghl_account_id: resourceId,
    client_id: Deno.env.get('GHL_MARKETPLACE_CLIENT_ID'),
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: expiresAt,
    business_name: `GHL ${tokenData.userType} - ${resourceId}`,
    business_description: 'OAuth installation with real GHL access tokens',
    ghl_company_id: tokenData.companyId,
    ghl_user_type: tokenData.userType,
    is_active: true,
    created_by: userId
  }

  console.log('Configuration data prepared:', {
    user_id: configData.user_id,
    ghl_account_id: configData.ghl_account_id,
    business_name: configData.business_name,
    hasAccessToken: !!configData.access_token,
    hasRefreshToken: !!configData.refresh_token
  })

  // Check if configuration already exists
  const { data: existingConfig, error: checkError } = await supabase
    .from('ghl_configurations')
    .select('*')
    .eq('ghl_account_id', resourceId)
    .maybeSingle()

  if (checkError) {
    console.error('Error checking existing config:', checkError)
    throw new Error(`Failed to check existing configuration: ${checkError.message}`)
  }

  if (existingConfig) {
    console.log('Updating existing configuration with new OAuth tokens')
    console.log('Existing config user_id:', existingConfig.user_id)
    console.log('New user_id from token:', userId)
    
    // Update existing configuration with new tokens and proper user linking
    const { data: updatedConfig, error: updateError } = await supabase
      .from('ghl_configurations')
      .update({
        user_id: userId, // Always update with the userId from token
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        client_id: Deno.env.get('GHL_MARKETPLACE_CLIENT_ID'),
        business_description: 'OAuth installation with real GHL access tokens - updated',
        ghl_company_id: tokenData.companyId,
        ghl_user_type: tokenData.userType,
        updated_at: new Date().toISOString(),
        created_by: userId
      })
      .eq('ghl_account_id', resourceId)
      .select()
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      throw new Error(`Failed to update configuration: ${updateError.message}`)
    }

    console.log('Configuration updated successfully:', {
      id: updatedConfig.id,
      user_id: updatedConfig.user_id,
      ghl_account_id: updatedConfig.ghl_account_id
    })
    
    return updatedConfig
  } else {
    // Insert new configuration
    console.log('Creating new configuration')
    
    const { data: newConfig, error: insertError } = await supabase
      .from('ghl_configurations')
      .insert(configData)
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      throw new Error(`Failed to save configuration: ${insertError.message}`)
    }

    console.log('New configuration saved successfully:', {
      id: newConfig.id,
      user_id: newConfig.user_id,
      ghl_account_id: newConfig.ghl_account_id
    })
    
    return newConfig
  }
}