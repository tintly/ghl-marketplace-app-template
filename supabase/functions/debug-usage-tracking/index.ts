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
    console.log('=== DEBUG USAGE TRACKING REQUEST ===')
    
    const requestBody = await req.json()
    const locationId = requestBody.location_id
    const agencyId = requestBody.agency_id
    const conversationId = requestBody.conversation_id
    
    if (!locationId && !agencyId) {
      return new Response(
        JSON.stringify({ 
          error: "Either location_id or agency_id is required",
          example: { 
            location_id: "4beIyWyWrcoPRD7PEN5G",
            days: 30
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

    const days = requestBody.days || 30
    
    console.log('Debugging usage tracking for:', {
      locationId: locationId || 'Not provided',
      agencyId: agencyId || 'Not provided',
      conversationId: conversationId || 'Not provided',
      days
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get date filter
    const dateFilter = new Date()
    dateFilter.setDate(dateFilter.getDate() - days)
    const dateFilterStr = dateFilter.toISOString()

    // Step 1: Get AI usage logs
    console.log('Step 1: Fetching AI usage logs...')
    let usageLogsQuery = supabase
      .from('ai_usage_logs')
      .select('*')
      .gte('created_at', dateFilterStr)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (locationId) {
      usageLogsQuery = usageLogsQuery.eq('location_id', locationId)
    }
    
    if (agencyId) {
      usageLogsQuery = usageLogsQuery.eq('agency_ghl_id', agencyId)
    }
    
    if (conversationId) {
      usageLogsQuery = usageLogsQuery.eq('conversation_id', conversationId)
    }
    
    const { data: usageLogs, error: usageLogsError } = await usageLogsQuery
    
    if (usageLogsError) {
      console.error('Error fetching AI usage logs:', usageLogsError)
      throw new Error(`Failed to fetch AI usage logs: ${usageLogsError.message}`)
    }
    
    console.log(`Found ${usageLogs?.length || 0} AI usage logs`)

    // Step 2: Get usage tracking records
    console.log('Step 2: Fetching usage tracking records...')
    let usageTrackingQuery = supabase
      .from('usage_tracking')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(10)
    
    if (locationId) {
      usageTrackingQuery = usageTrackingQuery.eq('location_id', locationId)
    }
    
    const { data: usageTracking, error: usageTrackingError } = await usageTrackingQuery
    
    if (usageTrackingError) {
      console.error('Error fetching usage tracking:', usageTrackingError)
      throw new Error(`Failed to fetch usage tracking: ${usageTrackingError.message}`)
    }
    
    console.log(`Found ${usageTracking?.length || 0} usage tracking records`)

    // Step 3: Get conversations
    console.log('Step 3: Fetching conversations...')
    let conversationsQuery = supabase
      .from('ghl_conversations')
      .select('*')
      .gte('date_added', dateFilterStr)
      .order('date_added', { ascending: false })
      .limit(20)
    
    if (locationId) {
      conversationsQuery = conversationsQuery.eq('location_id', locationId)
    }
    
    if (conversationId) {
      conversationsQuery = conversationsQuery.eq('conversation_id', conversationId)
    }
    
    const { data: conversations, error: conversationsError } = await conversationsQuery
    
    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError)
      throw new Error(`Failed to fetch conversations: ${conversationsError.message}`)
    }
    
    console.log(`Found ${conversations?.length || 0} conversations`)

    // Step 4: Get agency OpenAI keys if applicable
    let agencyKeys = null
    if (agencyId) {
      console.log('Step 4: Fetching agency OpenAI keys...')
      const { data: keys, error: keysError } = await supabase
        .from('agency_openai_keys')
        .select('id, key_name, is_active, created_at')
        .eq('agency_ghl_id', agencyId)
      
      if (keysError) {
        console.error('Error fetching agency OpenAI keys:', keysError)
      } else {
        agencyKeys = keys
        console.log(`Found ${keys?.length || 0} agency OpenAI keys`)
      }
    }

    // Step 5: Check for database triggers and functions
    console.log('Step 5: Checking database triggers and functions...')
    
    // Check for calculate_customer_cost_trigger
    const { data: triggerData, error: triggerError } = await supabase.rpc(
      'check_trigger_exists',
      { trigger_name: 'calculate_customer_cost_trigger', table_name: 'ai_usage_logs' }
    )
    
    const triggerExists = !triggerError && triggerData
    
    // Check for update_usage_tracking_trigger
    const { data: usageTrackerTriggerData, error: usageTrackerTriggerError } = await supabase.rpc(
      'check_trigger_exists',
      { trigger_name: 'update_usage_tracking_trigger', table_name: 'ai_usage_logs' }
    )
    
    const usageTrackerTriggerExists = !usageTrackerTriggerError && usageTrackerTriggerData

    // Compile debug report
    const debugReport = {
      success: true,
      timestamp: new Date().toISOString(),
      query_parameters: {
        location_id: locationId,
        agency_id: agencyId,
        conversation_id: conversationId,
        days
      },
      summary: {
        ai_usage_logs_count: usageLogs?.length || 0,
        usage_tracking_records_count: usageTracking?.length || 0,
        conversations_count: conversations?.length || 0,
        agency_keys_count: agencyKeys?.length || 0,
        database_triggers: {
          calculate_customer_cost_trigger: triggerExists,
          update_usage_tracking_trigger: usageTrackerTriggerExists
        }
      },
      ai_usage_logs: usageLogs?.map(log => ({
        id: log.id,
        location_id: log.location_id,
        agency_ghl_id: log.agency_ghl_id,
        conversation_id: log.conversation_id,
        model: log.model,
        total_tokens: log.total_tokens,
        cost_estimate: log.cost_estimate,
        customer_cost_estimate: log.customer_cost_estimate,
        success: log.success,
        openai_key_used: log.openai_key_used,
        created_at: log.created_at
      })) || [],
      usage_tracking: usageTracking || [],
      conversations: conversations?.map(conv => ({
        id: conv.id,
        conversation_id: conv.conversation_id,
        location_id: conv.location_id,
        contact_id: conv.contact_id,
        message_type: conv.message_type,
        direction: conv.direction,
        processed: conv.processed,
        date_added: conv.date_added
      })) || [],
      agency_keys: agencyKeys?.map(key => ({
        id: key.id,
        key_name: key.key_name,
        is_active: key.is_active,
        created_at: key.created_at
      })) || [],
      recommendations: generateRecommendations({
        usageLogs: usageLogs || [],
        usageTracking: usageTracking || [],
        conversations: conversations || [],
        agencyKeys: agencyKeys || [],
        triggerExists,
        usageTrackerTriggerExists
      })
    }

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
    console.error("=== DEBUG USAGE TRACKING ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to debug usage tracking: ${error.message}`,
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

// Helper function to generate recommendations based on the data
function generateRecommendations(data: any) {
  const recommendations = []
  
  // Check if we have conversations but no usage logs
  if (data.conversations.length > 0 && data.usageLogs.length === 0) {
    recommendations.push('❌ Conversations exist but no AI usage logs found. This indicates the extraction process may not be completing successfully.')
  }
  
  // Check if we have usage logs but no usage tracking
  if (data.usageLogs.length > 0 && data.usageTracking.length === 0) {
    recommendations.push('❌ AI usage logs exist but no usage tracking records found. The update_usage_tracking_trigger may not be working properly.')
  }
  
  // Check if we have agency keys but no usage logs with custom keys
  if (data.agencyKeys.length > 0 && !data.usageLogs.some(log => log.openai_key_used)) {
    recommendations.push('⚠️ Agency has OpenAI keys configured, but no usage logs show custom key usage. Check if the keys are being properly used.')
  }
  
  // Check for database triggers
  if (!data.triggerExists) {
    recommendations.push('❌ The calculate_customer_cost_trigger is missing. This is needed to calculate costs for usage tracking.')
  }
  
  if (!data.usageTrackerTriggerExists) {
    recommendations.push('❌ The update_usage_tracking_trigger is missing. This is needed to update usage tracking records.')
  }
  
  // Check for processed conversations
  const processedCount = data.conversations.filter(conv => conv.processed).length
  if (data.conversations.length > 0 && processedCount === 0) {
    recommendations.push('⚠️ None of the conversations have been processed. Check if the extraction process is running correctly.')
  }
  
  // If no issues found
  if (recommendations.length === 0) {
    if (data.usageLogs.length > 0) {
      recommendations.push('✅ Usage tracking appears to be working correctly. AI usage logs are being recorded and usage tracking is being updated.')
    } else {
      recommendations.push('ℹ️ No usage data found for the specified parameters. Try sending test messages to generate usage data.')
    }
  }
  
  return recommendations
}

// Helper function to check if a trigger exists
async function checkTriggerExists(supabase: any, triggerName: string, tableName: string) {
  try {
    const { data, error } = await supabase.rpc(
      'check_trigger_exists',
      { trigger_name: triggerName, table_name: tableName }
    )
    
    if (error) {
      console.error(`Error checking if trigger ${triggerName} exists:`, error)
      return false
    }
    
    return !!data
  } catch (error) {
    console.error(`Error checking if trigger ${triggerName} exists:`, error)
    return false
  }
}