import { createClient } from 'npm:@supabase/supabase-js@2'

// Function to check if a location has reached its message limit
async function checkMessageLimit(supabase: any, locationId: string) {
  try {
    const { data, error } = await supabase
      .rpc('check_location_message_limit', {
        p_location_id: locationId
      })

    if (error) {
      console.error('Error checking message limit:', error)
      return { limitReached: false, error: error.message }
    }

    return { 
      limitReached: data.limit_reached, 
      plan: data.plan,
      currentUsage: data.current_usage,
      messagesRemaining: data.messages_remaining
    }
  } catch (error) {
    console.error('Error checking message limit:', error)
    return { limitReached: false, error: error.message }
  }
}

// Function to increment message usage
async function incrementMessageUsage(supabase: any, locationId: string, tokensUsed: number, costEstimate: number) {
  try {
    const { data, error } = await supabase
      .rpc('increment_location_message_usage', {
        p_location_id: locationId,
        p_messages_count: 1,
        p_tokens_used: tokensUsed,
        p_cost_estimate: costEstimate
      })

    if (error) {
      console.error('Error incrementing message usage:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Error incrementing message usage:', error)
    return { success: false, error: error.message }
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface ExtractionPayload {
  conversation_id: string
  location_id: string
  contact_id?: string
  business_context: {
    name: string
    description: string
  }
  fields_to_extract: Array<{
    name: string
    ghl_key: string
    instructions: string
    type: string
  }>
  conversation_history: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    message_type?: string
    message_id?: string
  }>
  instructions: string
  response_format: {
    type: string
    rules: string[]
  }
}

// OpenAI model pricing (per 1K tokens) - Updated with gpt-4o-mini pricing
const MODEL_PRICING = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 }, // Current gpt-4o-mini pricing
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 }
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

  const startTime = Date.now()
  let usageLogId: string | null = null

  try {
    console.log('=== OPENAI EXTRACTION REQUEST ===')
    
    const payload = await req.json()
    
    // Validate required fields
    if (!payload.conversation_id || !payload.location_id) {
      throw new Error('conversation_id and location_id are required')
    }

    console.log('Processing extraction for:', {
      conversation_id: payload.conversation_id,
      location_id: payload.location_id,
      contact_id: payload.contact_id || 'Not available',
      business: payload.business_context?.name,
      fields_count: payload.fields_to_extract?.length || 0,
      messages_count: payload.conversation_history?.length || 0
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1.5: Check if location has reached message limit
    console.log('Step 1.5: Checking message limit for location:', payload.location_id)
    const limitCheck = await checkMessageLimit(supabase, payload.location_id)
    
    if (limitCheck.limitReached) {
      console.log('⚠️ Message limit reached for location:', payload.location_id)
      console.log('Plan:', limitCheck.plan?.plan_name)
      console.log('Current usage:', limitCheck.currentUsage?.messages_used)
      console.log('Messages included:', limitCheck.plan?.messages_included)
      
      return new Response(
        JSON.stringify({ 
          error: "Message limit reached",
          details: "You have reached your monthly message limit. Please upgrade your plan to continue using the service.",
          plan: limitCheck.plan,
          currentUsage: limitCheck.currentUsage
        }),
        {
          status: 402, // Payment Required
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    
    // Check if this location has a custom OpenAI key
    console.log('Checking for agency OpenAI key for location:', payload.location_id)
    const { data: agencyKey, error: keyError } = await supabase
      .from('agency_openai_keys')
      .select('encrypted_openai_api_key, key_name')
      .eq('agency_ghl_id', payload.agency_ghl_id || '')
      .eq('is_active', true)
      .maybeSingle()
    
    let keyToUse = openaiApiKey
    let keySource = 'default'
    
    if (agencyKey && agencyKey.encrypted_openai_api_key) {
      try {
        // In production, this would use proper decryption
        // For now, we're using the encrypted value directly
        keyToUse = agencyKey.encrypted_openai_api_key
        keySource = agencyKey.key_name || 'agency'
        console.log(`Using agency's custom OpenAI key: ${keySource}`)
      } catch (decryptError) {
        console.error('Error decrypting agency OpenAI key:', decryptError)
        console.log('Falling back to default OpenAI key')
      }
    } else {
      console.log('No custom OpenAI key found, using default key')
    }
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }

    // Build the system prompt
    console.log('Building system prompt...')
    console.log('System prompt from payload:', payload.system_prompt ? 'Present' : 'Missing')
    
    const systemPrompt = buildSystemPrompt(payload)
    console.log('System prompt length:', systemPrompt.length, 'characters')
    console.log('=== SYSTEM PROMPT SENT TO OPENAI ===')
    console.log(systemPrompt)
    console.log('=== END SYSTEM PROMPT SENT TO OPENAI ===')

    // Build conversation context
    console.log('Building conversation context...')
    const conversationContext = buildConversationContext(payload.conversation_history)
    console.log('Conversation context length:', conversationContext.length, 'characters')

    // Prepare OpenAI messages
    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `Please analyze this conversation and extract the requested data:\n\n${conversationContext}\n\nReturn only valid JSON with the extracted data using the exact field keys specified.`
      }
    ]
    
    // Log the full messages being sent to OpenAI
    console.log('=== FULL MESSAGES SENT TO OPENAI ===')
    console.log('Number of messages:', messages.length)
    console.log(JSON.stringify(messages, null, 2))
    console.log('=== END FULL MESSAGES SENT TO OPENAI ===')

    // Use gpt-4o-mini as the default model
    const model = 'gpt-4o-mini'
    
    console.log('Calling OpenAI API with model:', model)
    console.log('Using API key:', keyToUse ? `${keyToUse.substring(0, 3)}...${keyToUse.substring(keyToUse.length - 4)}` : 'Not available')
    console.log('Key source:', keySource)

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyToUse}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 1500, // Increased for better extraction coverage
        response_format: { type: "json_object" } // Ensure JSON response
      })
    })
    console.log('OpenAI API response status:', openaiResponse.status)

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
    }

    const openaiData: OpenAIResponse = await openaiResponse.json()
    console.log('OpenAI response received successfully')
    console.log('OpenAI response received:', {
      model: openaiData.model,
      usage: openaiData.usage,
      finish_reason: openaiData.choices[0]?.finish_reason
    })

    // Calculate response time
    const responseTime = Date.now() - startTime

    // Calculate cost estimate
    const costEstimate = calculateCost(model, openaiData.usage)

    // Calculate customer cost based on subscription plan
    console.log('Calculating customer cost...')
    const customerCostEstimate = await calculateCustomerCost(supabase, payload.location_id)

    // Increment message usage
    console.log('Incrementing message usage for location:', payload.location_id)
    await incrementMessageUsage(
      supabase,
      payload.location_id,
      openaiData.usage.total_tokens,
      costEstimate
    )

    // Log usage to database
    console.log('Logging usage to database...')
    usageLogId = await logUsage(supabase, {
      location_id: payload.location_id,
      agency_ghl_id: payload.agency_ghl_id,
      model: openaiData.model,
      input_tokens: openaiData.usage.prompt_tokens,
      output_tokens: openaiData.usage.completion_tokens, 
      total_tokens: openaiData.usage.total_tokens,
      platform_cost_estimate: costEstimate,
      customer_cost_estimate: customerCostEstimate,
      customer_cost_calculated: true,
      conversation_id: payload.conversation_id,
      extraction_type: 'data_extraction',
      openai_key_used: keySource,
      success: true,
      response_time_ms: responseTime
    })

    // Parse the extracted data
    console.log('Parsing extracted data from OpenAI response...')
    let extractedData
    try {
      extractedData = JSON.parse(openaiData.choices[0].message.content)
      console.log('Extracted data:', extractedData)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError)
      console.error('Raw response:', openaiData.choices[0].message.content)
      console.log('Attempting to clean and parse response...')
      throw new Error('OpenAI returned invalid JSON response')
    }

    console.log('✅ Extraction completed successfully')
    console.log('Extracted fields:', Object.keys(extractedData))
    console.log('Usage logged with ID:', usageLogId)
    console.log('Platform cost estimate:', `$${costEstimate}`)
    console.log('Customer cost estimate:', `$${customerCostEstimate}`)

    // Step 5: Automatically call update-ghl-contact if we have contact_id and extracted data
    let contactUpdateResult = null
    if (payload.contact_id && Object.keys(extractedData).length > 0) {
      console.log('Contact ID found, proceeding with contact update...')
      console.log('Step 5: Auto-calling update-ghl-contact...')
     
     // Log the extracted data for debugging
     console.log('Extracted data before sending to update-ghl-contact:')
     Object.entries(extractedData).forEach(([key, value]) => {
       console.log(`- ${key}: ${value}`)
       
       // Check if this is a custom field (doesn't have a dot in the key)
       const isCustomField = !key.includes('.') || !key.startsWith('contact.');
       if (isCustomField) {
         console.log(`  ⚠️ This appears to be a custom field but doesn't have the contact. prefix`)
       }
     })
      
      try {
        const contactUpdateResponse = await fetch(`${supabaseUrl}/functions/v1/update-ghl-contact`, {
          method: 'POST',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            ghl_contact_id: payload.contact_id,
            location_id: payload.location_id,
            extracted_data: extractedData
          })
        })
        console.log('Contact update response status:', contactUpdateResponse.status)

        if (!contactUpdateResponse.ok) {
          const errorText = await contactUpdateResponse.text()
          console.error('Contact update failed:', errorText)
          contactUpdateResult = {
            success: false,
            error: `Contact update failed: ${contactUpdateResponse.status} - ${errorText}`
          }
        } else {
          contactUpdateResult = await contactUpdateResponse.json()
          console.log('✅ Contact updated successfully in GHL')
          console.log('Updated fields:', contactUpdateResult.updated_fields)
          console.log('Skipped fields:', contactUpdateResult.skipped_fields)
        }
      } catch (contactUpdateError) {
        console.error('Error calling update-ghl-contact:', contactUpdateError)
        contactUpdateResult = {
          success: false,
          error: `Contact update error: ${contactUpdateError.message}`
        }
      }
    } else {
      console.log('Skipping contact update - missing contact_id or no extracted data')
      console.log('Contact ID:', payload.contact_id)
      if (!payload.contact_id) {
        console.log('- No contact_id provided in payload')
      }
      if (Object.keys(extractedData).length === 0) {
        console.log('- No data was extracted')
      }
    }

    // Log the agency ID for this location
    console.log('Checking for agency OpenAI key for location:', payload.location_id)
    
    // Get the agency ID for this location
    const { data: locationConfig, error: locationError } = await supabase
      .from('ghl_configurations')
      .select('agency_ghl_id')
      .eq('ghl_account_id', payload.location_id)
      .maybeSingle()
    
    if (!locationError && locationConfig?.agency_ghl_id) {
      console.log('Found agency ID for location:', locationConfig.agency_ghl_id)
      payload.agency_ghl_id = locationConfig.agency_ghl_id
    } else {
      console.log('No agency ID found for location')
    }

    // Return the extraction result with contact update info
    console.log('Returning successful response with extracted data')
    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: payload.conversation_id,
        location_id: payload.location_id,
        contact_id: payload.contact_id,
        extracted_data: extractedData,
        usage: {
          model: openaiData.model,
          input_tokens: openaiData.usage.prompt_tokens,
          output_tokens: openaiData.usage.completion_tokens, 
          total_tokens: openaiData.usage.total_tokens, 
          platform_cost_estimate: costEstimate,
          customer_cost_estimate: customerCostEstimate,
          response_time_ms: responseTime
        },
        usage_log_id: usageLogId,
        contact_update: contactUpdateResult,
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

  } catch (error: any) {
    console.error("=== OPENAI EXTRACTION ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)

    const responseTime = Date.now() - startTime

    // Log failed usage if we have the required info
    if (usageLogId === null) {
      try {
        const payload = await req.json().catch(() => ({}))
        if (payload.location_id) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          const supabase = createClient(supabaseUrl, supabaseServiceKey)

          console.log('Logging error usage for location:', payload.location_id)
          await logUsage(supabase, {
            location_id: payload.location_id,
            model: 'gpt-4o-mini',
            input_tokens: 0, 
            output_tokens: 0,
            total_tokens: 0, 
            platform_cost_estimate: 0,
            customer_cost_estimate: 0,
            conversation_id: payload.conversation_id || null,
            extraction_type: 'data_extraction',
            success: false,
            error_message: error.message,
            response_time_ms: responseTime
          })
        }
      } catch (logError) {
        console.log('Failed to log error usage')
        console.error('Failed to log error usage:', logError)
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: `OpenAI extraction failed: ${error.message}`,
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

function buildSystemPrompt(payload: ExtractionPayload): string {
  let prompt = `You are a data extraction AI analyzing a conversation between a customer and ${payload.business_context?.name || 'a business'}. `
  prompt += `Extract structured data from the conversation and return it as valid JSON.\n\n`
  
  prompt += `EXTRACTION FIELDS:\n`
  payload.fields_to_extract.forEach((field, index) => {
    prompt += `${index + 1}. "${field.ghl_key}": ${field.instructions}\n`
    if (field.type) {
      prompt += `   Type: ${field.type}\n`
    }
  })
  
  prompt += `\nINSTRUCTIONS:\n`
  prompt += `- ${payload.instructions || 'Extract all relevant information from the conversation'}\n`
  prompt += `- Only include fields that have extractable values\n`
  prompt += `- Use exact field keys as JSON property names\n`
  prompt += `- Format dates as YYYY-MM-DD\n`
  prompt += `- Ensure email and phone formats are valid\n`
  prompt += `- Return only valid JSON, no explanations\n`
  prompt += `- Be thorough but only extract data that is clearly present\n`
  
  if (payload.response_format && payload.response_format.rules) {
    prompt += `\nFORMAT RULES:\n`
    payload.response_format.rules.forEach(rule => {
      prompt += `- ${rule}\n`
    })
  }
  
  return prompt
}

function buildConversationContext(messages: any[]): string {
  if (!messages || messages.length === 0) {
    return "No conversation messages available.\n"
  }
  
  let context = "CONVERSATION:\n"
  messages.forEach((msg, index) => {
    const speaker = msg.role === 'user' ? 'Customer' : 'Business'
    const timestamp = new Date(msg.timestamp).toLocaleString()
    context += `${index + 1}. [${speaker}] (${timestamp}): ${msg.content}\n`
  });
  
  return context
}

function calculateCost(model: string, usage: any): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING]
  if (!pricing) {
    console.warn(`No pricing info for model: ${model}, using gpt-4o-mini pricing as fallback`);
    // Use gpt-4o-mini pricing as fallback
    const fallbackPricing = MODEL_PRICING['gpt-4o-mini']
    const inputCost = (usage.prompt_tokens / 1000) * fallbackPricing.input
    const outputCost = (usage.completion_tokens / 1000) * fallbackPricing.output
    return Math.round((inputCost + outputCost) * 1000000) / 1000000
  }
  
  const inputCost = (usage.prompt_tokens / 1000) * pricing.input
  const outputCost = (usage.completion_tokens / 1000) * pricing.output
  console.log(`Cost calculation: (${usage.prompt_tokens}/1000 * ${pricing.input}) + (${usage.completion_tokens}/1000 * ${pricing.output}) = ${inputCost + outputCost}`)
  return Math.round((inputCost + outputCost) * 1000000) / 1000000 // Round to 6 decimal places
}

// Calculate customer cost based on subscription plan
async function calculateCustomerCost(supabase: any, locationId: string): Promise<number> {
  try {
    // Get location's subscription plan
    console.log('Getting subscription plan for location:', locationId)
    const { data, error } = await supabase
      .rpc('get_location_subscription_plan', {
        p_location_id: locationId
      })
    
    if (error) {
      console.error('Error getting subscription plan:', error)
      return 0
    }
    
    console.log('Subscription plan:', data?.plan_name, 'Overage price:', data?.overage_price)
    // Get overage price from plan
    const overagePrice = data?.overage_price || 0.08 // Default to $0.08 if not found
    
    // For simplicity, we'll use 1 message = 1 API call
    // In a real implementation, you might have a more complex formula
    return overagePrice
  } catch (error) {
    console.error('Error calculating customer cost:', error)
    return 0
  }
}

async function logUsage(supabase: any, usageData: any): Promise<string> {
  try {
    console.log('Logging AI usage to database:', usageData.model, usageData.total_tokens, 'tokens')
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .insert(usageData)
      .select('id')
      .single()

    if (error) {
      console.error('Failed to log usage:', error)
      throw error
    }

    console.log('Usage logged successfully:', data.id)
    return data.id || 'unknown'
  } catch (error) {
    console.error('Error logging usage:', error)
    throw error
  }
}