import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  companyId?: string
  locationId?: string
}

serve(async (req: Request) => {
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

    // Get user information from GHL API
    console.log('Fetching user information...')
    const userInfo = await getUserInfo(tokenResponse.access_token, tokenResponse.locationId || tokenResponse.companyId!)
    
    // Save configuration to database
    console.log('Saving configuration to database...')
    await saveGHLConfiguration(supabase, tokenResponse, userInfo, state)

    console.log('OAuth exchange completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: "Installation completed successfully",
        userType: tokenResponse.userType,
        locationId: tokenResponse.locationId,
        companyId: tokenResponse.companyId
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
  const clientId = Deno.env.get('GHL_APP_CLIENT_ID')
  const clientSecret = Deno.env.get('GHL_APP_CLIENT_SECRET')
  const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'

  if (!clientId || !clientSecret) {
    throw new Error('GHL_APP_CLIENT_ID and GHL_APP_CLIENT_SECRET must be set')
  }

  const tokenUrl = `${apiDomain}/oauth/token`
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: code
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Token exchange failed:', errorText)
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`)
  }

  const tokenData = await response.json()
  console.log('Token exchange successful:', { 
    userType: tokenData.userType, 
    hasRefreshToken: !!tokenData.refresh_token 
  })
  
  return tokenData
}

async function getUserInfo(accessToken: string, resourceId: string) {
  const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'
  
  try {
    // Try to get user info - this endpoint works for both company and location tokens
    const response = await fetch(`${apiDomain}/users/search?companyId=${resourceId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28'
      }
    })

    if (response.ok) {
      const userData = await response.json()
      console.log('User info retrieved successfully')
      return userData
    } else {
      console.log('Could not fetch user info, using basic data')
      return { users: [] }
    }
  } catch (error) {
    console.log('Error fetching user info:', error.message)
    return { users: [] }
  }
}

async function saveGHLConfiguration(supabase: any, tokenData: TokenResponse, userInfo: any, state: string | null) {
  const resourceId = tokenData.locationId || tokenData.companyId!
  
  // Parse state parameter if it contains user information
  let userId = null
  if (state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(state))
      userId = stateData.userId
    } catch (error) {
      console.log('Could not parse state parameter:', error.message)
    }
  }

  // Prepare configuration data
  const configData = {
    user_id: userId, // This might be null if we don't have user context
    ghl_account_id: resourceId,
    client_id: Deno.env.get('GHL_APP_CLIENT_ID'),
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
    business_name: 'GoHighLevel Business', // Default name, can be updated later
    is_active: true,
    created_by: userId
  }

  // Insert or update configuration
  const { data, error } = await supabase
    .from('ghl_configurations')
    .upsert(configData, {
      onConflict: 'ghl_account_id',
      ignoreDuplicates: false
    })
    .select()

  if (error) {
    console.error('Database error:', error)
    throw new Error(`Failed to save configuration: ${error.message}`)
  }

  console.log('Configuration saved successfully:', data)
  return data
}