import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface FieldToExtract {
  name: string
  ghl_key: string
  instructions: string
  type?: string
  options?: string[]
}

interface ConversationMetadata {
  total_messages: number
  location_id: string
  message?: string
}

interface AIExtractionPayload {
  conversation_id: string
  location_id: string
  business_context: {
    name: string
    description: string
  }
  fields_to_extract: FieldToExtract[]
  conversation_history: ConversationMessage[]
  conversation_metadata: ConversationMetadata
  instructions: string
  response_format: {
    type: string
    rules: string[]
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
    console.log('=== AI EXTRACTION PAYLOAD REQUEST ===')
    
    const requestBody = await req.json()
    const conversationId = requestBody.conversation_id || requestBody.conversationId
    
    if (!conversationId) {
      console.error('No conversation_id provided in request')
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

    console.log('Building AI extraction payload for conversation:', conversationId)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
      throw new Error(`Failed to get conversation history: ${conversationResponse.status} - ${errorText}`)
    }

    const conversationData = await conversationResponse.json()
    console.log(`✅ Got conversation history with ${conversationData.messages.length} messages`)

    if (!conversationData.location_id) {
      throw new Error('No location_id found in conversation data')
    }

    // Step 2: Get extraction prompt
    console.log('Step 2: Generating extraction prompt...')
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
    console.log(`✅ Generated extraction prompt for ${promptData.metadata.extractionFieldsCount} fields`)

    // Step 3: Build the structured payload
    console.log('Step 3: Building structured payload...')

    // Extract business context from prompt metadata
    const businessContext = {
      name: promptData.metadata.businessName || `Location ${conversationData.location_id}`,
      description: promptData.metadata.businessDescription || "GoHighLevel location"
    }

    // Extract conversation metadata (excluding messages which are handled separately)
    const conversationMetadata: ConversationMetadata = {
      total_messages: conversationData.total_messages,
      location_id: conversationData.location_id
    }

    // Include optional message if present
    if (conversationData.message) {
      conversationMetadata.message = conversationData.message
    }

    // Convert fields from prompt metadata to extraction format
    const fieldsToExtract: FieldToExtract[] = promptData.metadata.fields.map((field: any) => {
      let instructions = `Extract data for ${field.name} field`
      
      // Add type-specific instructions
      switch (field.type) {
        case 'EMAIL':
          instructions = `Extract valid email addresses mentioned in the conversation. Only extract properly formatted emails.`
          break
        case 'PHONE':
          instructions = `Extract phone numbers mentioned in any format. Include area codes and formatting.`
          break
        case 'DATE':
          instructions = `Extract dates mentioned in the conversation. Format as YYYY-MM-DD.`
          break
        case 'TEXT':
          if (field.name.toLowerCase().includes('name')) {
            if (field.name.toLowerCase().includes('first')) {
              instructions = `Extract the given name from the conversation. Look for introductions or references to their first name.`
            } else if (field.name.toLowerCase().includes('last')) {
              instructions = `Extract the person's surname. Look for full name introductions or formal signatures.`
            } else {
              instructions = `Extract the person's name from the conversation. Look for introductions or signatures.`
            }
          }
          break
        case 'SINGLE_OPTIONS':
          instructions = `Select one option from the available choices based on conversation context.`
          break
        case 'MULTIPLE_OPTIONS':
          instructions = `Select one or more options from the available choices. Use comma separation for multiple selections.`
          break
      }

      // Add specific instructions for known custom fields
      if (field.ghlKey === 'contact.multi_select_dropdown') {
        instructions = `Select one or more from: 'Option 1' (Front doors), 'Option 2' (Back window), 'Option 3' (Sides & Rear). Use comma separation for multiple selections.`
      }

      return {
        name: field.name,
        ghl_key: field.fieldKey || field.ghlKey,
        instructions: instructions,
        type: field.type
      }
    })

    // Create simplified instructions
    const instructions = `You are analyzing a conversation between a customer and ${businessContext.name}. Your goal is to extract structured data from the entire conversation history. Use the field list to determine what to extract. Combine multi-message details, use contextual clues, and format values as specified. Return a valid JSON with the exact field keys. Do not include extra text or markdown.`

    // Build the final payload
    const payload: AIExtractionPayload = {
      conversation_id: conversationId,
      location_id: conversationData.location_id,
      business_context: businessContext,
      fields_to_extract: fieldsToExtract,
      conversation_history: conversationData.messages,
      conversation_metadata: conversationMetadata,
      instructions: instructions,
      response_format: {
        type: "json",
        rules: [
          "Key names must match `ghl_key` values.",
          "Only include fields that have values.",
          "Ensure date fields use YYYY-MM-DD format.",
          "Ensure phone and email fields are valid formats."
        ]
      }
    }

    console.log('✅ AI extraction payload built successfully')
    console.log(`- Conversation ID: ${payload.conversation_id}`)
    console.log(`- Location ID: ${payload.location_id}`)
    console.log(`- Business: ${payload.business_context.name}`)
    console.log(`- Fields to extract: ${payload.fields_to_extract.length}`)
    console.log(`- Conversation messages: ${payload.conversation_history.length}`)
    console.log(`- Conversation metadata: ${JSON.stringify(payload.conversation_metadata)}`)

    // Log field summary
    console.log('Fields to extract:')
    payload.fields_to_extract.forEach((field, index) => {
      console.log(`  ${index + 1}. ${field.name} (${field.ghl_key}) - ${field.type || 'TEXT'}`)
    })

    return new Response(
      JSON.stringify(payload, null, 2),
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
        error: `Failed to build AI extraction payload: ${error.message}`,
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