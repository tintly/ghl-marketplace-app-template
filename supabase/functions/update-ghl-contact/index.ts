import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface CustomFieldUpdate {
  id: string
  key: string
  field_value: string | number | boolean | string[]
}

interface ContactUpdateRequest {
  contactId: string
  locationId: string
  customFields: CustomFieldUpdate[]
  standardFields?: {
    firstName?: string
    lastName?: string
    name?: string
    email?: string
    phone?: string
    address1?: string
    city?: string
    state?: string
    postalCode?: string
    website?: string
    timezone?: string
    country?: string
    source?: string
    assignedTo?: string
    tags?: string[]
  }
}

interface GHLConfiguration {
  id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  ghl_account_id: string
  business_name: string
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
      JSON.stringify({ error: "Method not allowed. Use POST." }),
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
    console.log('=== GHL CONTACT UPDATE REQUEST ===')
    
    const requestBody: ContactUpdateRequest = await req.json()
    
    // Validate required fields
    if (!requestBody.contactId || !requestBody.locationId) {
      return new Response(
        JSON.stringify({ 
          error: "contactId and locationId are required",
          example: {
            contactId: "ocQHyuzHvysMo5N5VsXc",
            locationId: "4beIyWyWrcoPRD7PEN5G",
            customFields: [
              {
                id: "6dvNaf7VhkQ9snc5vnjJ",
                key: "my_custom_field",
                field_value: "9039160788"
              }
            ]
          }
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

    if (!requestBody.customFields && !requestBody.standardFields) {
      return new Response(
        JSON.stringify({ 
          error: "Either customFields or standardFields must be provided"
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

    console.log('Updating contact:', {
      contactId: requestBody.contactId,
      locationId: requestBody.locationId,
      customFieldsCount: requestBody.customFields?.length || 0,
      hasStandardFields: !!requestBody.standardFields
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get GHL configuration for the location
    console.log('Step 1: Fetching GHL configuration...')
    const ghlConfig = await getGHLConfiguration(supabase, requestBody.locationId)
    
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ 
          error: "No GHL configuration found for this location",
          locationId: requestBody.locationId
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

    // Step 2: Check if token needs refresh
    console.log('Step 2: Validating access token...')
    const tokenValidation = validateTokenExpiry(ghlConfig)
    
    if (tokenValidation.needsRefresh) {
      console.log('Token needs refresh, attempting to refresh...')
      const refreshResult = await refreshAccessToken(supabase, ghlConfig)
      
      if (!refreshResult.success) {
        return new Response(
          JSON.stringify({ 
            error: "Failed to refresh access token",
            details: refreshResult.error
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        )
      }
      
      // Update the config with new token
      ghlConfig.access_token = refreshResult.accessToken!
    }

    // Step 3: Update the contact in GHL
    console.log('Step 3: Updating contact in GHL...')
    const updateResult = await updateGHLContact(
      ghlConfig.access_token,
      requestBody.contactId,
      requestBody.customFields || [],
      requestBody.standardFields
    )

    if (!updateResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to update contact in GHL",
          details: updateResult.error,
          ghlResponse: updateResult.ghlResponse
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

    console.log('✅ Contact updated successfully')

    return new Response(
      JSON.stringify({
        success: true,
        contactId: requestBody.contactId,
        locationId: requestBody.locationId,
        updatedFields: {
          customFields: requestBody.customFields?.length || 0,
          standardFields: requestBody.standardFields ? Object.keys(requestBody.standardFields).length : 0
        },
        ghlResponse: updateResult.ghlResponse,
        timestamp: new Date().toISOString()
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
    console.error("=== CONTACT UPDATE ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Contact update failed: ${error.message}`,
        details: error.toString(),
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

async function getGHLConfiguration(supabase: any, locationId: string): Promise<GHLConfiguration | null> {
  console.log('Fetching GHL configuration for location:', locationId)
  
  const { data, error } = await supabase
    .from('ghl_configurations')
    .select(`
      id,
      access_token,
      refresh_token,
      token_expires_at,
      ghl_account_id,
      business_name
    `)
    .eq('ghl_account_id', locationId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error fetching GHL configuration:', error)
    throw new Error(`Failed to fetch configuration: ${error.message}`)
  }

  if (!data) {
    console.log('No configuration found for location:', locationId)
    return null
  }

  console.log('✅ Found configuration:', {
    id: data.id,
    business_name: data.business_name,
    hasAccessToken: !!data.access_token
  })
  
  return data
}

function validateTokenExpiry(config: GHLConfiguration): { needsRefresh: boolean; hoursUntilExpiry?: number } {
  if (!config.token_expires_at) {
    return { needsRefresh: false }
  }

  const expiryDate = new Date(config.token_expires_at)
  const now = new Date()
  const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  console.log(`Token expires in ${Math.round(hoursUntilExpiry)} hours`)

  return {
    needsRefresh: hoursUntilExpiry <= 1, // Refresh if expires within 1 hour
    hoursUntilExpiry: Math.round(hoursUntilExpiry)
  }
}

async function refreshAccessToken(supabase: any, config: GHLConfiguration): Promise<{
  success: boolean
  accessToken?: string
  error?: string
}> {
  try {
    const clientId = Deno.env.get('GHL_MARKETPLACE_CLIENT_ID')
    const clientSecret = Deno.env.get('GHL_MARKETPLACE_CLIENT_SECRET')
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'

    if (!clientId || !clientSecret) {
      throw new Error('GHL client credentials not configured')
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token
    })

    const response = await fetch(`${apiDomain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`)
    }

    const tokenData = await response.json()
    
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
      console.error('Failed to update tokens in database:', updateError)
    }

    console.log('✅ Access token refreshed successfully')
    return {
      success: true,
      accessToken: tokenData.access_token
    }

  } catch (error) {
    console.error('Token refresh error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

async function updateGHLContact(
  accessToken: string,
  contactId: string,
  customFields: CustomFieldUpdate[],
  standardFields?: any
): Promise<{
  success: boolean
  error?: string
  ghlResponse?: any
}> {
  try {
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'
    const url = `${apiDomain}/contacts/${contactId}`

    // Build the payload
    const payload: any = {}

    // Add standard fields if provided
    if (standardFields) {
      Object.assign(payload, standardFields)
    }

    // Add custom fields if provided
    if (customFields && customFields.length > 0) {
      payload.customFields = customFields.map(field => ({
        id: field.id,
        key: field.key,
        field_value: field.field_value
      }))
    }

    console.log('Updating contact with payload:', {
      contactId,
      customFieldsCount: customFields.length,
      standardFieldsCount: standardFields ? Object.keys(standardFields).length : 0
    })

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('GHL API error:', {
        status: response.status,
        statusText: response.statusText,
        response: responseData
      })
      
      return {
        success: false,
        error: `GHL API error: ${response.status} - ${response.statusText}`,
        ghlResponse: responseData
      }
    }

    console.log('✅ Contact updated successfully in GHL')
    return {
      success: true,
      ghlResponse: responseData
    }

  } catch (error) {
    console.error('Error updating contact:', error)
    return {
      success: false,
      error: error.message
    }
  }
}