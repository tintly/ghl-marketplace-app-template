import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    console.log('=== AI EXTRACTION PAYLOAD REQUEST ===')
    
    const requestBody = await req.json()
    const conversationId = requestBody.conversation_id
    
    if (!conversationId) {
      return new Response(
        JSON.stringify({ 
          error: "conversation_id is required",
          example: { conversation_id: "abc123" }
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

    console.log('Building extraction payload for conversation:', conversationId)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get conversation history
    console.log('Step 1: Fetching conversation history...')
    const conversationResponse = await fetch(`${supabaseUrl}/functions/v1/get-conversation-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ conversation_id: conversationId })
    })

    if (!conversationResponse.ok) {
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
      conversation_id: conversationId,
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

    // Step 7: Call OpenAI extraction function
    console.log('Step 7: Calling OpenAI extraction function...')
    const extractionResponse = await fetch(`${supabaseUrl}/functions/v1/openai-extraction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(extractionPayload)
    })

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text()
      throw new Error(`OpenAI extraction failed: ${extractionResponse.status} - ${errorText}`)
    }

    const extractionResult = await extractionResponse.json()
    console.log('✅ OpenAI extraction completed successfully')
    console.log('Extracted fields:', Object.keys(extractionResult.extracted_data || {}))

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: conversationId,
        location_id: conversationData.location_id,
        contact_id: conversationData.contact_id,
        extraction_result: extractionResult,
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
    console.error("=== AI EXTRACTION PAYLOAD ERROR ===")
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
}