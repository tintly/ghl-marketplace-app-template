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
    console.log('=== TESTING OPENAI EXTRACTION ===')
    
    const requestBody = await req.json()
    const conversationId = requestBody.conversation_id || 's5QLyA8BsRzGman0LYAw'
    
    console.log('Testing extraction for conversation:', conversationId)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Step 1: Build AI extraction payload
    console.log('Step 1: Building AI extraction payload...')
    const payloadResponse = await fetch(`${supabaseUrl}/functions/v1/ai-extraction-payload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ conversation_id: conversationId })
    })

    if (!payloadResponse.ok) {
      const errorText = await payloadResponse.text()
      throw new Error(`Failed to build payload: ${payloadResponse.status} - ${errorText}`)
    }

    const payload = await payloadResponse.json()
    console.log(`✅ Payload built with ${payload.fields_to_extract.length} fields`)

    // Step 2: Call OpenAI extraction
    console.log('Step 2: Calling OpenAI extraction...')
    const extractionResponse = await fetch(`${supabaseUrl}/functions/v1/openai-extraction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(payload)
    })

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text()
      throw new Error(`Extraction failed: ${extractionResponse.status} - ${errorText}`)
    }

    const extractionResult = await extractionResponse.json()
    console.log('✅ Extraction completed successfully')

    // Step 3: Get usage logs for this location
    console.log('Step 3: Fetching recent usage logs...')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: usageLogs, error: usageError } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('location_id', payload.location_id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (usageError) {
      console.error('Failed to fetch usage logs:', usageError)
    }

   // Step 4: Check if usage is being recorded properly
   console.log('Step 4: Verifying usage tracking...')
   const { data: usageTracking, error: trackingError } = await supabase
     .from('usage_tracking')
     .select('*')
     .eq('location_id', payload.location_id)
     .order('updated_at', { ascending: false })
     .limit(1)
     .single()

   if (trackingError && trackingError.code !== 'PGRST116') {
     console.error('Failed to fetch usage tracking:', trackingError)
   }

   if (usageTracking) {
     console.log('✅ Usage tracking record found:', {
       month_year: usageTracking.month_year,
       messages_used: usageTracking.messages_used,
       tokens_used: usageTracking.tokens_used,
       cost_estimate: usageTracking.cost_estimate,
       custom_key_used: usageTracking.custom_key_used
     })
   } else {
     console.log('⚠️ No usage tracking record found for this location')
   }
    // Compile test results
    const testResults = {
      success: true,
      conversation_id: conversationId,
      location_id: payload.location_id,
      business_name: payload.business_context.name,
      test_steps: {
        payload_generation: {
          success: true,
          fields_count: payload.fields_to_extract.length,
          messages_count: payload.conversation_history.length
        },
        openai_extraction: {
          success: true,
          model: extractionResult.usage.model,
          input_tokens: extractionResult.usage.input_tokens,
          output_tokens: extractionResult.usage.output_tokens,
          total_tokens: extractionResult.usage.total_tokens,
          cost_estimate: extractionResult.usage.cost_estimate,
          response_time_ms: extractionResult.usage.response_time_ms
        },
        usage_logging: {
          success: !usageError,
          usage_log_id: extractionResult.usage_log_id,
          recent_logs_count: usageLogs?.length || 0
        }
       usage_tracking: {
         success: !!usageTracking,
         month_year: usageTracking?.month_year,
         messages_used: usageTracking?.messages_used,
         tokens_used: usageTracking?.tokens_used,
         cost_estimate: usageTracking?.cost_estimate,
         custom_key_used: usageTracking?.custom_key_used
       }
      },
      extracted_data: extractionResult.extracted_data,
      recent_usage_logs: usageLogs || [],
     usage_tracking: usageTracking || null,
      timestamp: new Date().toISOString()
    }

    console.log('✅ Test completed successfully')
    console.log('Extracted fields:', Object.keys(extractionResult.extracted_data))
    console.log('Usage cost:', `$${extractionResult.usage.cost_estimate}`)

    return new Response(
      JSON.stringify(testResults, null, 2),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )

  } catch (error) {
    console.error("=== TEST ERROR ===")
    console.error("Error message:", error.message)
    
    return new Response(
      JSON.stringify({ 
        error: `Test failed: ${error.message}`,
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