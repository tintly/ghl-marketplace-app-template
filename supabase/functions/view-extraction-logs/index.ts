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
    console.log('=== EXTRACTION LOGS REQUEST ===')
    
    const requestBody = await req.json()
    const contactId = requestBody.contact_id
    const conversationId = requestBody.conversation_id
    const fetchRecent = requestBody.recent === true
    const limit = requestBody.limit || 10
    const locationId = requestBody.location_id
    
    // SECURITY: location_id is now REQUIRED to prevent cross-agency data access
    if (!locationId) {
      return new Response(
        JSON.stringify({ 
          error: "location_id is required for security",
          message: "Must specify location_id to prevent cross-agency data access"
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
    
    if (!contactId && !conversationId && !fetchRecent) {
      return new Response(
        JSON.stringify({ 
          error: "Either contact_id, conversation_id, or recent=true is required",
          example: { 
            contact_id: "3eEkzpdKeXk19ndqBHNd",
            location_id: "4beIyWyWrcoPRD7PEN5G",
            recent: true,
            limit: 10
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

    console.log('Fetching extraction logs for:', {
      contactId: contactId || 'Not provided',
      conversationId: conversationId || 'Not provided',
      fetchRecent: fetchRecent,
      locationId,
      limit
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get conversation records
    console.log('Step 1: Fetching conversation records...')
    // SECURITY: Always filter by location_id to prevent cross-agency access
    let conversationQuery = supabase
      .from('ghl_conversations')
      .select('*')
      .eq('location_id', locationId)
      .order('date_added', { ascending: false })
      .limit(limit)
    
    // Apply additional filters if provided
    if (contactId) {
      conversationQuery = conversationQuery.eq('contact_id', contactId)
    }
    
    if (conversationId) {
      conversationQuery = conversationQuery.eq('conversation_id', conversationId)
    }
    
    const { data: conversations, error: conversationsError } = await conversationQuery
    
    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError)
      throw new Error(`Failed to fetch conversations: ${conversationsError.message}`)
    }
    
    console.log(`Found ${conversations?.length || 0} conversation records`)
    
    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No conversation records found",
          conversations: [],
          usage_logs: []
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
    
    // Get all conversation IDs
    const conversationIds = conversations.map(c => c.conversation_id)
    
    // Step 2: Get AI usage logs for these conversations
    console.log('Step 2: Fetching AI usage logs...')
    const { data: usageLogs, error: usageError } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
    
    if (usageError) {
      console.error('Error fetching usage logs:', usageError)
      throw new Error(`Failed to fetch usage logs: ${usageError.message}`)
    }
    
    console.log(`Found ${usageLogs?.length || 0} AI usage logs`)
    
    // Step 3: Combine the data
    const result = {
      success: true,
      contact_id: contactId,
      conversation_id: conversationId,
      conversations: conversations.map(conv => ({
        id: conv.id,
        conversation_id: conv.conversation_id,
        contact_id: conv.contact_id,
        message_id: conv.message_id,
        message_type: conv.message_type,
        direction: conv.direction,
        body: conv.body,
        date_added: conv.date_added,
        processed: conv.processed,
        processing_error: conv.processing_error,
        webhook_received_at: conv.webhook_received_at
      })),
      usage_logs: usageLogs?.map(log => ({
        id: log.id,
        conversation_id: log.conversation_id,
        model: log.model,
        input_tokens: log.input_tokens,
        output_tokens: log.output_tokens,
        total_tokens: log.total_tokens,
        cost_estimate: log.cost_estimate,
        success: log.success,
        error_message: log.error_message,
        response_time_ms: log.response_time_ms,
        created_at: log.created_at
      })) || [],
      timestamp: new Date().toISOString()
    }
    
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )

  } catch (error) {
    console.error("=== EXTRACTION LOGS ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to fetch extraction logs: ${error.message}`,
        details: error.toString(),
        stack: error.stack
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