import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface GHLContact {
  id: string
  name?: string
  locationId: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  companyName?: string
  address1?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  website?: string
  timezone?: string
  tags?: string[]
  dateOfBirth?: string
  customFields?: Array<{
    id: string
    value: any
  }>
  [key: string]: any
}

interface FieldAnalysis {
  fieldKey: string
  fieldName: string
  fieldType: string
  currentValue: any
  hasValue: boolean
  isEmpty: boolean
  isOverwritable: boolean
  reason: string
}

interface ContactAnalysis {
  contact: GHLContact
  fieldAnalysis: FieldAnalysis[]
  summary: {
    totalFields: number
    fieldsWithValues: number
    emptyFields: number
    overwritableFields: number
    protectedFields: number
  }
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
    console.log('=== GET GHL CONTACT REQUEST ===')
    
    const requestBody = await req.json()
    
    // Validate required fields
    if (!requestBody.ghl_contact_id || !requestBody.location_id) {
      return new Response(
        JSON.stringify({ 
          error: "ghl_contact_id and location_id are required",
          example: {
            ghl_contact_id: "ocQHyuzHvysMo5N5VsXc",
            location_id: "4beIyWyWrcoPRD7PEN5G",
            overwrite_policy: "never" // optional
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

    const { ghl_contact_id, location_id, overwrite_policy = "ask" } = requestBody

    console.log('Fetching GHL contact:', {
      ghl_contact_id,
      location_id,
      overwrite_policy
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get GHL configuration for the location
    console.log('Step 1: Fetching GHL configuration...')
    const ghlConfig = await getGHLConfiguration(supabase, location_id)
    
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({
          error: "No GHL configuration found for this location",
          locationId: location_id
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

    // Step 2: Validate and refresh token if needed
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
      
      ghlConfig.access_token = refreshResult.accessToken
    }

    // Step 3: Get extraction fields configuration for this location
    console.log('Step 3: Fetching extraction fields configuration...')
    const extractionFields = await getExtractionFields(supabase, ghlConfig.id)

    // Step 4: Fetch the contact from GoHighLevel
    console.log('Step 4: Fetching contact from GHL...')
    const contact = await getGHLContact(ghlConfig.access_token, ghl_contact_id)
    
    if (!contact) {
      return new Response(
        JSON.stringify({
          error: `Contact with ID ${ghl_contact_id} not found in GoHighLevel`
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

    // Step 5: Analyze fields for overwrite policy
    console.log('Step 5: Analyzing fields for overwrite policy...')
    const analysis = analyzeContactFields(contact, extractionFields, overwrite_policy)

    console.log('✅ Contact analysis completed')
    console.log(`- Total fields: ${analysis.summary.totalFields}`)
    console.log(`- Fields with values: ${analysis.summary.fieldsWithValues}`)
    console.log(`- Overwritable fields: ${analysis.summary.overwritableFields}`)
    console.log(`- Protected fields: ${analysis.summary.protectedFields}`)

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: ghl_contact_id,
        location_id: location_id,
        overwrite_policy: overwrite_policy,
        contact: analysis.contact,
        field_analysis: analysis.fieldAnalysis,
        summary: analysis.summary,
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
    console.error("=== GET GHL CONTACT ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to get GHL contact: ${error.message}`,
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

// Helper Functions

async function getGHLConfiguration(supabase: any, locationId: string) {
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

function validateTokenExpiry(config: any) {
  if (!config.token_expires_at) {
    console.warn('No token_expires_at found. Skipping expiry check.')
    return { needsRefresh: false }
  }

  const expiryDate = new Date(config.token_expires_at)
  const now = new Date()
  const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  console.log(`Token expires in ${Math.round(hoursUntilExpiry)} hours`)

  return {
    needsRefresh: hoursUntilExpiry <= 1,
    hoursUntilExpiry: Math.round(hoursUntilExpiry)
  }
}

async function refreshAccessToken(supabase: any, config: any) {
  try {
    const clientId = Deno.env.get('GHL_MARKETPLACE_CLIENT_ID')
    const clientSecret = Deno.env.get('GHL_MARKETPLACE_CLIENT_SECRET')
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'

    if (!clientId || !clientSecret) {
      throw new Error('GHL client credentials not configured')
    }

    if (!config.refresh_token) {
      throw new Error('Refresh token is missing from GHL configuration')
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

async function getExtractionFields(supabase: any, configId: string) {
  console.log('Fetching extraction fields for config:', configId)
  
  const { data, error } = await supabase
    .from('data_extraction_fields')
    .select(`
      id,
      field_name,
      target_ghl_key,
      field_type,
      is_required,
      overwrite_policy
    `)
    .eq('config_id', configId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching extraction fields:', error)
    throw new Error(`Failed to fetch extraction fields: ${error.message}`)
  }

  const fields = data || []
  console.log(`✅ Found ${fields.length} extraction fields`)
  
  return fields
}

async function getGHLContact(accessToken: string, contactId: string): Promise<GHLContact | null> {
  const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'
  const url = `${apiDomain}/contacts/${contactId}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    })

    if (response.status === 404) {
      console.log(`Contact ${contactId} not found in GHL`)
      return null
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch contact: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    return responseData.contact || responseData

  } catch (error) {
    console.error('Error fetching contact:', error)
    throw error
  }
}

function analyzeContactFields(
  contact: GHLContact, 
  extractionFields: any[], 
  globalOverwritePolicy: string
): ContactAnalysis {
  const fieldAnalysis: FieldAnalysis[] = []
  let fieldsWithValues = 0
  let emptyFields = 0
  let overwritableFields = 0
  let protectedFields = 0

  // Create a map of custom fields for quick lookup
  const customFieldsMap = new Map()
  if (contact.customFields) {
    contact.customFields.forEach(cf => {
      customFieldsMap.set(cf.id, cf.value)
    })
  }

  extractionFields.forEach(field => {
    let currentValue: any = null
    let hasValue = false
    let isEmpty = true

    // Determine current value based on field type
    if (field.target_ghl_key.includes('.')) {
      // Standard field (e.g., contact.firstName)
      const fieldKey = field.target_ghl_key.split('.')[1]
      currentValue = contact[fieldKey]
    } else {
      // Custom field (GHL field ID)
      currentValue = customFieldsMap.get(field.target_ghl_key)
    }

    // Analyze the current value
    if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
      hasValue = true
      isEmpty = false
      fieldsWithValues++
      
      // For arrays (like tags), check if not empty
      if (Array.isArray(currentValue) && currentValue.length === 0) {
        isEmpty = true
        hasValue = false
        fieldsWithValues--
        emptyFields++
      }
    } else {
      emptyFields++
    }

    // Determine overwrite policy for this field
    const fieldOverwritePolicy = field.overwrite_policy || globalOverwritePolicy
    let isOverwritable = true
    let reason = ''

    switch (fieldOverwritePolicy) {
      case 'never':
        isOverwritable = false
        reason = 'Field policy set to never overwrite'
        protectedFields++
        break
      
      case 'only_empty':
        isOverwritable = isEmpty
        reason = isEmpty ? 'Field is empty, can be filled' : 'Field has value, protected from overwrite'
        if (!isEmpty) protectedFields++
        else overwritableFields++
        break
      
      case 'always':
        isOverwritable = true
        reason = 'Field policy set to always overwrite'
        overwritableFields++
        break
      
      case 'ask':
      default:
        isOverwritable = true
        reason = hasValue ? 'Field has value, user should confirm overwrite' : 'Field is empty, safe to fill'
        overwritableFields++
        break
    }

    fieldAnalysis.push({
      fieldKey: field.target_ghl_key,
      fieldName: field.field_name,
      fieldType: field.field_type,
      currentValue,
      hasValue,
      isEmpty,
      isOverwritable,
      reason
    })
  })

  return {
    contact,
    fieldAnalysis,
    summary: {
      totalFields: extractionFields.length,
      fieldsWithValues,
      emptyFields,
      overwritableFields,
      protectedFields
    }
  }
}