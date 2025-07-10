import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface UpdateRequest {
  ghl_contact_id: string
  location_id: string
  extracted_data: Record<string, any>
  force_overwrite?: string[]
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
    
    const requestBody: UpdateRequest = await req.json()
    
    // Validate required fields
    if (!requestBody.ghl_contact_id || !requestBody.location_id || !requestBody.extracted_data) {
      return new Response(
        JSON.stringify({
          error: "ghl_contact_id, location_id, and extracted_data are required.",
          example: {
            ghl_contact_id: "ocQHyuzHvysMo5N5VsXc",
            location_id: "4beIyWyWrcoPRD7PEN5G",
            extracted_data: {
              "contact.firstName": "John",
              "contact.email": "john.doe@example.com",
              "custom_field_id": "Some value"
            }
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

    console.log('Processing update for contact:', {
      ghl_contact_id: requestBody.ghl_contact_id,
      location_id: requestBody.location_id,
      extracted_data_keys: Object.keys(requestBody.extracted_data)
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          console.log(`✅ Will update standard field ${ghlStandardKey}: ${JSON.stringify(currentValue)} → ${JSON.stringify(newValue)}`)

    // Step 1: Get GHL configuration
    console.log('Step 1: Fetching GHL configuration...')
      if (fieldKey.startsWith('contact.')) {
        customFieldId = fieldKey.split('.')[1]
        console.log(`Extracted custom field ID from ${fieldKey}: ${customFieldId}`)
    const ghlConfig = await getGHLConfiguration(supabase, requestBody.location_id)
      
      // Check if this is a direct custom field ID (no contact. prefix)
      if (field && field.target_ghl_key) {
        customFieldId = field.target_ghl_key
        console.log(`Using target_ghl_key as custom field ID: ${customFieldId}`)
      }
      
      // Add to customFields array
      const errorText = await conversationResponse.text()
      throw new Error(`Failed to fetch conversation history: ${conversationResponse.status} - ${errorText}`)
    }

    const conversationData = await conversationResponse.json()
    console.log('Conversation data retrieved:', {
      messages: conversationData.messages.length,
      location_id: conversationData.location_id,
      contact_id: conversationData.contact_id
    })

    if (!conversationData.location_id) {
      throw new Error('No location ID found in conversation data')
    }

    // Step 2: Get GHL configuration for this location
    console.log('Step 2: Fetching GHL configuration...')
    const ghlConfig = await getGHLConfiguration(supabase, conversationData.location_id)
    
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({
          error: "No GHL configuration found for this location",
          locationId: conversationData.location_id
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

    // Step 3: Get extraction fields for this location
    console.log('Step 3: Fetching extraction fields...')
    const extractionFields = await getExtractionFields(supabase, ghlConfig.id)
    console.log(`Found ${extractionFields.length} extraction fields`)

    // Step 4: Get contextual rules and business context
    console.log('Step 4: Fetching contextual rules...')
    const contextualRules = await getContextualRules(supabase, ghlConfig.id)
    console.log(`Found ${contextualRules.length} contextual rules`)

    // Step 5: Generate extraction prompt
    console.log('Step 5: Generating extraction prompt...')
    const promptResponse = await fetch(`${supabaseUrl}/functions/v1/generate-extraction-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ locationId: conversationData.location_id })
    })

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text()
      throw new Error(`Failed to generate extraction prompt: ${promptResponse.status} - ${errorText}`)
    }

    const promptData = await promptResponse.json()
    console.log('Extraction prompt generated successfully')

    // Step 6: Build the final extraction payload
    console.log('Step 6: Building final extraction payload...')
    
    // Prepare fields to extract
    const fieldsToExtract = extractionFields.map(field => ({
      name: field.field_name,
      ghl_key: field.target_ghl_key,
      instructions: field.description,
      type: field.field_type,
      required: field.is_required || false,
      options: field.picklist_options || []
    }))

    // Build business context
    const businessContext = {
      name: ghlConfig.business_name || `Business ${conversationData.location_id}`,
      description: ghlConfig.business_description || '',
      services: ghlConfig.services_offered || '',
      context: ghlConfig.business_context || ''
    }

    // Build the final payload
    const extractionPayload = {
      conversation_id: requestBody.conversation_id,
      location_id: conversationData.location_id,
      contact_id: conversationData.contact_id,
      business_context: businessContext,
      fields_to_extract: fieldsToExtract,
      conversation_history: conversationData.messages,
      system_prompt: promptData.prompt,
      instructions: "Extract all relevant information from the conversation",
      response_format: {
        type: "json_object",
        rules: [
          "Use exact field keys as specified",
          "Only include fields with extractable values",
          "Format dates as YYYY-MM-DD",
          "Return valid JSON only"
        ]
      }
    }

    console.log('✅ Extraction payload built successfully')
    console.log('Payload summary:', {
      conversation_id: extractionPayload.conversation_id,
      location_id: extractionPayload.location_id,
      contact_id: extractionPayload.contact_id || 'Not available',
      fields_count: extractionPayload.fields_to_extract.length,
      messages_count: extractionPayload.conversation_history.length
    })

    return new Response(
      JSON.stringify(extractionPayload),
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
        error: `Failed to build extraction payload: ${error.message}`,
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

async function getContextualRules(supabase: any, configId: string) {
  const { data, error } = await supabase
    .from('contextual_rules')
    .select('rule_name, rule_description, rule_type, rule_value, is_active')
    .eq('config_id', configId)
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to fetch contextual rules: ${error.message}`)
  }

  return data || []
}

async function getGHLConfiguration(supabase: any, locationId: string) {
  const { data, error } = await supabase
    .from('ghl_configurations')
    .select(`
      id,
      access_token,
      refresh_token,
      token_expires_at,
      ghl_account_id,
      business_name,
      business_description,
      business_context,
      target_audience,
      services_offered
    `)
    .eq('ghl_account_id', locationId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch configuration: ${error.message}`)
  }

  return data
}

function validateTokenExpiry(config: any) {
  if (!config.token_expires_at) {
    return { needsRefresh: false }
  }

  const expiryDate = new Date(config.token_expires_at)
  const now = new Date()
  const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)

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

    const params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
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
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
    
    await supabase
      .from('ghl_configurations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id)

    return {
      success: true,
      accessToken: tokenData.access_token
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function getExtractionFields(supabase: any, configId: string) {
  const { data, error } = await supabase
    .from('data_extraction_fields')
    .select(`
      id,
      field_name,
      description,
      target_ghl_key,
      field_type,
      picklist_options,
      placeholder,
      is_required,
      sort_order,
      overwrite_policy,
      original_ghl_field_data
    `)
    .eq('config_id', configId)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch extraction fields: ${error.message}`)
  }

  return data || []