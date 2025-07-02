import { createClient } from 'npm:@supabase/supabase-js@2'

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
    
    const payload: ExtractionPayload = await req.json()
    
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

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }

    // Build the system prompt
    const systemPrompt = buildSystemPrompt(payload)
    console.log('System prompt length:', systemPrompt.length, 'characters')

    // Build conversation context
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

    // Use gpt-4o-mini as the default model
    const model = 'gpt-4o-mini'
    
    console.log('Calling OpenAI API with model:', model)

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
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

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
    }

    const openaiData: OpenAIResponse = await openaiResponse.json()
    console.log('OpenAI response received:', {
      model: openaiData.model,
      usage: openaiData.usage,
      finish_reason: openaiData.choices[0]?.finish_reason
    })

    // Calculate response time
    const responseTime = Date.now() - startTime

    // Calculate cost estimate
    const costEstimate = calculateCost(model, openaiData.usage)

    // Log usage to database
    usageLogId = await logUsage(supabase, {
      location_id: payload.location_id,
      model: openaiData.model,
      input_tokens: openaiData.usage.prompt_tokens,
      output_tokens: openaiData.usage.completion_tokens,
      total_tokens: openaiData.usage.total_tokens,
      cost_estimate: costEstimate,
      conversation_id: payload.conversation_id,
      extraction_type: 'data_extraction',
      success: true,
      response_time_ms: responseTime
    })

    // Parse the extracted data
    let extractedData
    try {
      extractedData = JSON.parse(openaiData.choices[0].message.content)
      console.log('Extracted data:', extractedData)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError)
      console.error('Raw response:', openaiData.choices[0].message.content)
      throw new Error('OpenAI returned invalid JSON response')
    }

    console.log('✅ Extraction completed successfully')
    console.log('Extracted fields:', Object.keys(extractedData))
    console.log('Usage logged with ID:', usageLogId)
    console.log('Cost estimate:', `$${costEstimate}`)

    // Step 5: Automatically call update-ghl-contact if we have contact_id and extracted data
    let contactUpdateResult = null
    if (payload.contact_id && Object.keys(extractedData).length > 0) {
      console.log('Step 5: Auto-calling update-ghl-contact...')
      
      try {
        const contactUpdateResponse = await fetch(`${supabaseUrl}/functions/v1/update-ghl-contact`, {
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

        if (contactUpdateResponse.ok) {
          contactUpdateResult = await contactUpdateResponse.json()
          console.log('✅ Contact updated successfully in GHL')
          console.log('Updated fields:', contactUpdateResult.updated_fields)
        } else {
          const errorText = await contactUpdateResponse.text()
          console.error('Contact update failed:', errorText)
          contactUpdateResult = {
            success: false,
            error: `Contact update failed: ${contactUpdateResponse.status} - ${errorText}`
          }
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
      if (!payload.contact_id) {
        console.log('- No contact_id provided in payload')
      }
      if (Object.keys(extractedData).length === 0) {
        console.log('- No data was extracted')
      }
    }

    // Return the extraction result with contact update info
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
          cost_estimate: costEstimate,
          response_time_ms: responseTime
        },
        usage_log_id: usageLogId,
        contact_update: contactUpdateResult, // Include contact update result
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

          await logUsage(supabase, {
            location_id: payload.location_id,
            model: 'gpt-4o-mini',
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost_estimate: 0,
            conversation_id: payload.conversation_id || null,
            extraction_type: 'data_extraction',
            success: false,
            error_message: error.message,
            response_time_ms: responseTime
          })
        }
      } catch (logError) {
        console.error('Failed to log error usage:', logError)
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: `OpenAI extraction failed: ${error.message}`,
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

function buildSystemPrompt(payload: ExtractionPayload): string {
  let prompt = `You are a data extraction AI analyzing a conversation between a customer and ${payload.business_context.name}. `
  prompt += `Extract structured data from the conversation and return it as valid JSON.\n\n`
  
  prompt += `EXTRACTION FIELDS:\n`
  payload.fields_to_extract.forEach((field, index) => {
    prompt += `${index + 1}. "${field.ghl_key}": ${field.instructions}\n`
    if (field.type) {
      prompt += `   Type: ${field.type}\n`
    }
  })
  
  prompt += `\nINSTRUCTIONS:\n`
  prompt += `- ${payload.instructions}\n`
  prompt += `- Only include fields that have extractable values\n`
  prompt += `- Use exact field keys as JSON property names\n`
  prompt += `- Format dates as YYYY-MM-DD\n`
  prompt += `- Ensure email and phone formats are valid\n`
  prompt += `- Return only valid JSON, no explanations\n`
  prompt += `- Be thorough but only extract data that is clearly present\n`
  
  if (payload.response_format?.rules) {
    prompt += `\nFORMAT RULES:\n`
    payload.response_format.rules.forEach(rule => {
      prompt += `- ${rule}\n`
    })
  }
  
  return prompt
}

function buildConversationContext(messages: any[]): string {
  if (!messages || messages.length === 0) {
    return "No conversation messages available."
  }
  
  let context = "CONVERSATION:\n"
  messages.forEach((msg, index) => {
    const speaker = msg.role === 'user' ? 'Customer' : 'Business'
    const timestamp = new Date(msg.timestamp).toLocaleString()
    context += `${index + 1}. [${speaker}] (${timestamp}): ${msg.content}\n`
  })
  
  return context
}

function calculateCost(model: string, usage: any): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING]
  if (!pricing) {
    console.warn(`No pricing info for model: ${model}, using gpt-4o-mini pricing as fallback`)
    // Use gpt-4o-mini pricing as fallback
    const fallbackPricing = MODEL_PRICING['gpt-4o-mini']
    const inputCost = (usage.prompt_tokens / 1000) * fallbackPricing.input
    const outputCost = (usage.completion_tokens / 1000) * fallbackPricing.output
    return Math.round((inputCost + outputCost) * 1000000) / 1000000
  }
  
  const inputCost = (usage.prompt_tokens / 1000) * pricing.input
  const outputCost = (usage.completion_tokens / 1000) * pricing.output
  
  return Math.round((inputCost + outputCost) * 1000000) / 1000000 // Round to 6 decimal places
}

async function logUsage(supabase: any, usageData: any): Promise<string> {
  try {
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
    return data.id
  } catch (error) {
    console.error('Error logging usage:', error)
    throw error
  }
}