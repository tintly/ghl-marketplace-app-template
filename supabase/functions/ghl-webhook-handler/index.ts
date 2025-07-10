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

  try {
    console.log('=== GHL WEBHOOK HANDLER ===')
    
    const webhookData = await req.json()
    
    // Validate webhook data
    if (!webhookData || !webhookData.locationId || !webhookData.conversation) {
      console.error('Invalid webhook data:', webhookData)
      return new Response(
        JSON.stringify({ 
          error: "Invalid webhook data",
          received: webhookData
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

    console.log('Received webhook for location:', webhookData.locationId)
    console.log('Conversation ID:', webhookData.conversation?.id)
    console.log('Message type:', webhookData.type)
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Store the webhook data in the database
    console.log('Storing webhook data in database...')
    const { data: storedMessage, error: storeError } = await supabase
      .from('ghl_conversations')
      .insert({
        location_id: webhookData.locationId,
        conversation_id: webhookData.conversation?.id,
        contact_id: webhookData.contact?.id,
        message_id: webhookData.id,
        message_type: webhookData.type,
        direction: webhookData.direction,
        body: webhookData.body,
        date_added: webhookData.dateAdded || new Date().toISOString(),
        raw_webhook_data: webhookData,
        processed: false
      })
      .select('id')
      .single()

    if (storeError) {
      console.error('Error storing webhook data:', storeError)
      return new Response(
        JSON.stringify({ 
          error: "Failed to store webhook data",
          details: storeError.message
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

    console.log('Webhook data stored successfully with ID:', storedMessage?.id)

    // Only process inbound messages (from customer to business)
    if (webhookData.direction !== 'inbound') {
      console.log('Skipping outbound message (from business to customer)')
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Outbound message stored but not processed",
          stored_id: storedMessage?.id
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

    // Trigger the extraction pipeline
    console.log('Triggering extraction pipeline for conversation:', webhookData.conversation?.id)
    
    try {
      // Call the ai-extraction-payload function
      const extractionResponse = await fetch(`${supabaseUrl}/functions/v1/ai-extraction-payload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ 
          conversation_id: webhookData.conversation?.id
        })
      })

      if (!extractionResponse.ok) {
        const errorText = await extractionResponse.text()
        console.error('Extraction pipeline error:', errorText)
        throw new Error(`Extraction pipeline failed: ${extractionResponse.status} - ${errorText}`)
      }

      const extractionResult = await extractionResponse.json()
      console.log('Extraction pipeline completed successfully')
      console.log('Extracted fields:', Object.keys(extractionResult.extraction_result?.extracted_data || {}))

      // Mark the message as processed
      await supabase
        .from('ghl_conversations')
        .update({
          processed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', storedMessage?.id)

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Webhook processed and extraction completed",
          stored_id: storedMessage?.id,
          extraction_result: extractionResult
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    } catch (extractionError) {
      console.error('Error in extraction pipeline:', extractionError)
      
      // Mark the message as processed with error
      await supabase
        .from('ghl_conversations')
        .update({
          processed: false,
          processing_error: extractionError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', storedMessage?.id)
      
      return new Response(
        JSON.stringify({ 
          success: false,
          message: "Webhook stored but extraction failed",
          stored_id: storedMessage?.id,
          error: extractionError.message
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

  } catch (error) {
    console.error("=== WEBHOOK HANDLER ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Webhook processing failed: ${error.message}`,
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