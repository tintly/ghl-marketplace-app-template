import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface ConversationMessage {
  id: string
  message_id: string | null
  direction: string
  body: string | null
  message_type: string
  date_added: string
  contact_id: string | null
  user_id: string | null
}

interface FormattedMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  message_type?: string
  message_id?: string
}

interface ConversationHistoryResponse {
  conversation_id: string
  messages: FormattedMessage[]
  total_messages: number
  location_id: string
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
    console.log('=== CONVERSATION HISTORY REQUEST ===')
    
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

    console.log('Building conversation history for:', conversationId)

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch conversation messages
    console.log('Fetching messages from database...')
    const { data: messages, error } = await supabase
      .from('ghl_conversations')
      .select(`
        id,
        message_id,
        direction,
        body,
        message_type,
        date_added,
        contact_id,
        user_id,
        location_id
      `)
      .eq('conversation_id', conversationId)
      .not('body', 'is', null) // Only get messages with actual content
      .order('date_added', { ascending: true }) // Oldest first for chronological order
      .limit(20) // Get last 20 messages

    if (error) {
      console.error('Database error:', error)
      throw new Error(`Failed to fetch conversation messages: ${error.message}`)
    }

    if (!messages || messages.length === 0) {
      console.log('No messages found for conversation:', conversationId)
      return new Response(
        JSON.stringify({
          conversation_id: conversationId,
          messages: [],
          total_messages: 0,
          location_id: null,
          message: "No messages found for this conversation"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    console.log(`Found ${messages.length} messages for conversation`)

    // Get the last 20 messages (if there are more than 20, take the most recent ones)
    const recentMessages = messages.slice(-20)
    
    // Format messages for conversation history
    const formattedMessages: FormattedMessage[] = recentMessages.map((msg: ConversationMessage) => {
      // Determine role based on direction
      // 'inbound' = message TO the business (from customer) = 'user'
      // 'outbound' = message FROM the business (to customer) = 'assistant'
      const role: 'user' | 'assistant' = msg.direction === 'inbound' ? 'user' : 'assistant'
      
      return {
        role,
        content: msg.body || '',
        timestamp: msg.date_added,
        message_type: msg.message_type,
        message_id: msg.message_id || undefined
      }
    })

    // Get location_id from the first message
    const locationId = messages[0]?.location_id || null

    const response: ConversationHistoryResponse = {
      conversation_id: conversationId,
      messages: formattedMessages,
      total_messages: formattedMessages.length,
      location_id: locationId
    }

    console.log('✅ Conversation history built successfully')
    console.log(`- Conversation ID: ${conversationId}`)
    console.log(`- Total messages: ${formattedMessages.length}`)
    console.log(`- Location ID: ${locationId}`)
    console.log(`- Message types: ${[...new Set(formattedMessages.map(m => m.message_type))].join(', ')}`)

    // Log a sample of the conversation for debugging
    if (formattedMessages.length > 0) {
      console.log('Sample messages:')
      formattedMessages.slice(0, 3).forEach((msg, index) => {
        console.log(`  ${index + 1}. [${msg.role}] ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`)
      })
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )

  } catch (error) {
    console.error("=== CONVERSATION HISTORY ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to build conversation history: ${error.message}`,
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