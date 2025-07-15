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
    
    // Parse the webhook payload
    const payload = await req.json()
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2))
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Extract relevant data from the webhook
    const eventType = payload.event || 'unknown'
    const locationId = payload.locationId || payload.companyId || null
    
    console.log(`Processing ${eventType} event for location ${locationId}`)
    
    // Process based on event type
    if (eventType === 'conversation.message.created') {
      await processConversationMessage(supabase, payload)
    } else {
      console.log(`Ignoring unsupported event type: ${eventType}`)
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook received and processed",
        event: eventType,
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
    console.error("=== WEBHOOK ERROR ===")
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

async function processConversationMessage(supabase: any, payload: any) {
  try {
    console.log('Processing conversation message')
    
    // Extract message data
    const message = payload.message || {}
    const conversation = payload.conversation || {}
    const contact = payload.contact || {}
    
    // Extract required fields
    const locationId = payload.locationId || conversation.locationId || null
    const conversationId = conversation.id || message.conversationId || null
    const contactId = contact.id || conversation.contactId || null
    const messageId = message.id || null
    const messageType = message.type || 'unknown'
    const direction = message.direction || 'unknown'
    const body = message.body || null
    const dateAdded = message.dateAdded || message.createdAt || new Date().toISOString()
    
    // Validate required fields
    if (!locationId || !conversationId) {
      throw new Error('Missing required fields: locationId and conversationId')
    }
    
    console.log('Extracted message data:', {
      locationId,
      conversationId,
      contactId,
      messageId,
      messageType,
      direction,
      body: body ? body.substring(0, 50) + '...' : null,
      dateAdded
    })
    
    // Prepare record for insertion
    const record = {
      location_id: locationId,
      conversation_id: conversationId,
      contact_id: contactId,
      message_id: messageId,
      message_type: messageType,
      direction,
      body,
      date_added: dateAdded,
      webhook_received_at: new Date().toISOString(),
      raw_webhook_data: payload,
      processed: false
    }
    
    // Add message-type specific fields
    if (messageType === 'EMAIL') {
      record.email_message_id = message.emailMessageId || null
      record.email_thread_id = message.emailThreadId || null
      record.email_from = message.from || null
      record.email_to = message.to || null
      record.email_cc = message.cc || null
      record.email_bcc = message.bcc || null
      record.email_subject = message.subject || null
    } else if (messageType === 'CALL') {
      record.call_duration = message.duration || null
      record.call_status = message.status || null
    }
    
    // Insert into database
    console.log('Inserting message into database')
    const { data, error } = await supabase
      .from('ghl_conversations')
      .insert(record)
      .select()
    
    if (error) {
      console.error('Error inserting message:', error)
      throw new Error(`Database insertion failed: ${error.message}`)
    }
    
    console.log('✅ Message inserted successfully:', data?.[0]?.id || 'unknown ID')
    
    // If this is an inbound message, trigger extraction
    if (direction === 'inbound') {
      console.log('Inbound message detected, triggering extraction')
      await triggerExtraction(supabase, conversationId, locationId, contactId)
    } else {
      console.log('Outbound message, skipping extraction')
    }
    
    return true
  } catch (error) {
    console.error('Error processing conversation message:', error)
    throw error
  }
}

async function triggerExtraction(supabase: any, conversationId: string, locationId: string, contactId: string | null) {
  try {
    console.log('Triggering extraction for conversation:', conversationId)
    
    // Get the Supabase URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Call the AI extraction payload function
    const extractionResponse = await fetch(`${supabaseUrl}/functions/v1/ai-extraction-payload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        location_id: locationId,
        contact_id: contactId
      })
    })
    
    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text()
      console.error('Extraction failed:', errorText)
      
      // Update the conversation record to mark as processed with error
      await supabase
        .from('ghl_conversations')
        .update({
          processed: true,
          processing_error: `Extraction failed: ${extractionResponse.status} - ${errorText.substring(0, 200)}`,
          updated_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
        .eq('message_id', messageId)
      
      return false
    }
    
    console.log('✅ Extraction triggered successfully')
    return true
  } catch (error) {
    console.error('Error triggering extraction:', error)
    
    // Try to update the conversation record with the error
    try {
      await supabase
        .from('ghl_conversations')
        .update({
          processed: true,
          processing_error: `Error triggering extraction: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
      
      console.log('Updated conversation record with error')
    } catch (updateError) {
      console.error('Failed to update conversation record with error:', updateError)
    }
    
    return false
  }
}