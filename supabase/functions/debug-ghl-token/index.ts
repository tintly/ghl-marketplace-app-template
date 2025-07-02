import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface TokenValidationResult {
  isValid: boolean
  tokenInfo?: any
  error?: string
  httpStatus?: number
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ 
        error: "Method not allowed. Use POST.",
        method_received: req.method,
        expected: "POST"
      }),
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
    console.log('=== GHL TOKEN DEBUG REQUEST ===')
    console.log('Request method:', req.method)
    console.log('Request URL:', req.url)
    
    const requestBody = await req.json()
    console.log('Request body:', requestBody)
    
    const locationId = requestBody.locationId || requestBody.location_id
    
    if (!locationId) {
      return new Response(
        JSON.stringify({ 
          error: "locationId is required",
          received_body: requestBody,
          example: { locationId: "3lkoUn4O7jExzrkx3shg" }
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

    console.log('Debugging GHL token for location:', locationId)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get configuration from database
    console.log('Step 1: Fetching configuration from database...')
    const { data: config, error: configError } = await supabase
      .from('ghl_configurations')
      .select('*')
      .eq('ghl_account_id', locationId)
      .eq('is_active', true)
      .single()

    if (configError || !config) {
      console.error('Configuration not found:', configError)
      return new Response(
        JSON.stringify({
          error: "Configuration not found for location",
          locationId,
          details: configError?.message,
          debug_info: {
            supabase_url: supabaseUrl ? 'present' : 'missing',
            service_key: supabaseServiceKey ? 'present' : 'missing'
          }
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    console.log('✅ Configuration found:', {
      id: config.id,
      business_name: config.business_name,
      has_access_token: !!config.access_token,
      has_refresh_token: !!config.refresh_token,
      token_expires_at: config.token_expires_at,
      created_at: config.created_at,
      updated_at: config.updated_at
    })

    // Step 2: Validate token format
    console.log('Step 2: Validating token format...')
    const tokenValidation = validateTokenFormat(config)
    console.log('Token format validation:', tokenValidation)

    // Step 3: Test token with GHL API
    console.log('Step 3: Testing token with GHL API...')
    const apiValidation = await testTokenWithGHLAPI(config.access_token, locationId)
    console.log('GHL API validation:', apiValidation)

    // Step 4: Check if token needs refresh
    console.log('Step 4: Checking token expiry...')
    const expiryCheck = checkTokenExpiry(config)
    console.log('Token expiry check:', expiryCheck)

    // Step 5: If token is expired, try to refresh it
    let refreshResult = null
    if (expiryCheck.needsRefresh && config.refresh_token) {
      console.log('Step 5: Attempting token refresh...')
      refreshResult = await attemptTokenRefresh(config, supabase)
      console.log('Token refresh result:', refreshResult)
    }

    // Compile debug report
    const debugReport = {
      success: true,
      locationId,
      timestamp: new Date().toISOString(),
      configuration: {
        found: true,
        id: config.id,
        business_name: config.business_name,
        created_at: config.created_at,
        updated_at: config.updated_at
      },
      token_format: tokenValidation,
      api_validation: apiValidation,
      expiry_check: expiryCheck,
      refresh_attempt: refreshResult,
      recommendations: generateRecommendations(tokenValidation, apiValidation, expiryCheck, refreshResult)
    }

    console.log('✅ Debug report generated successfully')

    return new Response(
      JSON.stringify(debugReport, null, 2),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )

  } catch (error) {
    console.error("=== TOKEN DEBUG ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Token debug failed: ${error.message}`,
        details: error.toString(),
        stack: error.stack,
        timestamp: new Date().toISOString()
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

function validateTokenFormat(config: any) {
  const validation = {
    has_access_token: !!config.access_token,
    has_refresh_token: !!config.refresh_token,
    access_token_length: config.access_token?.length || 0,
    refresh_token_length: config.refresh_token?.length || 0,
    is_dev_token: false,
    token_prefix: '',
    issues: [] as string[]
  }

  if (!config.access_token) {
    validation.issues.push('Missing access token')
  } else {
    validation.token_prefix = config.access_token.substring(0, 10) + '...'
    
    if (config.access_token.startsWith('dev-') || 
        config.access_token.startsWith('test-') || 
        config.access_token.startsWith('temp-')) {
      validation.is_dev_token = true
      validation.issues.push('Using development/test token')
    }

    if (config.access_token.length < 20) {
      validation.issues.push('Access token appears too short')
    }
  }

  if (!config.refresh_token) {
    validation.issues.push('Missing refresh token')
  }

  return validation
}

async function testTokenWithGHLAPI(accessToken: string, locationId: string): Promise<TokenValidationResult> {
  try {
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'
    
    console.log(`Testing token with ${apiDomain}/locations/${locationId}`)
    
    // Test with a simple API call to get location info
    const response = await fetch(`${apiDomain}/locations/${locationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    })

    const responseText = await response.text()
    console.log(`GHL API response: ${response.status} - ${responseText.substring(0, 200)}`)
    
    if (response.ok) {
      let locationData
      try {
        locationData = JSON.parse(responseText)
      } catch (e) {
        locationData = { raw: responseText }
      }
      
      return {
        isValid: true,
        tokenInfo: {
          httpStatus: response.status,
          locationName: locationData.location?.name || locationData.name,
          locationId: locationData.location?.id || locationData.id
        }
      }
    } else {
      return {
        isValid: false,
        error: responseText,
        httpStatus: response.status
      }
    }
  } catch (error) {
    console.error('GHL API test error:', error)
    return {
      isValid: false,
      error: error.message,
      httpStatus: 0
    }
  }
}

function checkTokenExpiry(config: any) {
  const check = {
    has_expiry: !!config.token_expires_at,
    expires_at: config.token_expires_at,
    is_expired: false,
    expires_in_hours: null as number | null,
    needsRefresh: false
  }

  if (config.token_expires_at) {
    const expiryDate = new Date(config.token_expires_at)
    const now = new Date()
    const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    check.expires_in_hours = Math.round(hoursUntilExpiry * 100) / 100
    check.is_expired = hoursUntilExpiry <= 0
    check.needsRefresh = hoursUntilExpiry <= 24 // Refresh if expires within 24 hours
  }

  return check
}

async function attemptTokenRefresh(config: any, supabase: any) {
  try {
    const clientId = Deno.env.get('GHL_MARKETPLACE_CLIENT_ID')
    const clientSecret = Deno.env.get('GHL_MARKETPLACE_CLIENT_SECRET')
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: 'Missing GHL client credentials in environment variables'
      }
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token
    })

    console.log(`Attempting token refresh with ${apiDomain}/oauth/token`)

    const response = await fetch(`${apiDomain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })

    const responseText = await response.text()
    console.log(`Token refresh response: ${response.status} - ${responseText.substring(0, 200)}`)

    if (response.ok) {
      const tokenData = JSON.parse(responseText)
      
      // Update the database with new tokens
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
      
      const { error: updateError } = await supabase
        .from('ghl_configurations')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id)

      if (updateError) {
        return {
          success: false,
          error: `Failed to update database: ${updateError.message}`,
          new_tokens_received: true
        }
      }

      return {
        success: true,
        new_access_token_prefix: tokenData.access_token.substring(0, 10) + '...',
        expires_in_seconds: tokenData.expires_in,
        updated_database: true
      }
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`,
        http_status: response.status
      }
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

function generateRecommendations(tokenValidation: any, apiValidation: any, expiryCheck: any, refreshResult: any) {
  const recommendations = []

  if (!tokenValidation.has_access_token) {
    recommendations.push('❌ CRITICAL: No access token found. Reinstall the app via OAuth.')
  } else if (tokenValidation.is_dev_token) {
    recommendations.push('⚠️ WARNING: Using development token. Install via OAuth for production access.')
  } else if (!apiValidation.isValid) {
    if (apiValidation.httpStatus === 401) {
      recommendations.push('❌ CRITICAL: Token is invalid or expired. Try refreshing or reinstalling.')
    } else if (apiValidation.httpStatus === 403) {
      recommendations.push('❌ CRITICAL: Token lacks required permissions. Reinstall with proper scopes.')
    } else {
      recommendations.push(`❌ ERROR: API call failed with status ${apiValidation.httpStatus}. Check token and permissions.`)
    }
  } else {
    recommendations.push('✅ SUCCESS: Token is valid and working with GHL API.')
  }

  if (expiryCheck.is_expired) {
    if (refreshResult?.success) {
      recommendations.push('✅ SUCCESS: Expired token was successfully refreshed.')
    } else {
      recommendations.push('❌ CRITICAL: Token is expired and refresh failed. Reinstall required.')
    }
  } else if (expiryCheck.needsRefresh) {
    recommendations.push(`⚠️ WARNING: Token expires in ${expiryCheck.expires_in_hours} hours. Consider refreshing soon.`)
  }

  if (!tokenValidation.has_refresh_token) {
    recommendations.push('⚠️ WARNING: No refresh token found. Cannot auto-refresh when expired.')
  }

  return recommendations
}