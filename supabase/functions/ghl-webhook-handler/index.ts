import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface GHLWebhookPayload {
  type: 'InboundMessage' | 'OutboundMessage'
  locationId: string
  attachments?: string[]
  body?: string
  contactId?: string
  contentType?: string
  conversationId: string
  dateAdded: string
  direction: 'inbound' | 'outbound'
  messageType: 'SMS' | 'CALL' | 'Email' | string
  status?: string
  conversationProviderId?: string
  messageId?: string
  userId?: string
  
  // Call-specific fields
  callDuration?: number
  callStatus?: string
  
  // Email-specific fields
  emailMessageId?: string
  threadId?: string
  from?: string
  to?: string[]
  cc?: string[]
  bcc?: string[]
  subject?: string
  provider?: string
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
      JSON.stringify({ error: "Method not allowed" }),
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
    console.log('=== GHL WEBHOOK RECEIVED ===')
    
    // Parse the webhook payload
    const webhookData: GHLWebhookPayload = await req.json()
    
    console.log('Webhook type:', webhookData.type)
    console.log('Location ID:', webhookData.locationId)
    console.log('Message type:', webhookData.messageType)
    console.log('Direction:', webhookData.direction)
    console.log('Conversation ID:', webhookData.conversationId)
    
    // Validate required fields
    if (!webhookData.locationId || !webhookData.conversationId || !webhookData.dateAdded) {
      console.error('Missing required fields:', {
        locationId: !!webhookData.locationId,
        conversationId: !!webhookData.conversationId,
        dateAdded: !!webhookData.dateAdded
      })
      
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: locationId, conversationId, and dateAdded are required" 
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

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if this message already exists (deduplication)
    if (webhookData.messageId) {
      const { data: existingMessage } = await supabase
        .from('ghl_conversations')
        .select('id')
        .eq('message_id', webhookData.messageId)
        .maybeSingle()

      if (existingMessage) {
        console.log('Message already exists, skipping:', webhookData.messageId)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Message already processed",
            messageId: webhookData.messageId
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
    }

    // Prepare conversation record
    const conversationRecord = {
      location_id: webhookData.locationId,
      conversation_id: webhookData.conversationId,
      contact_id: webhookData.contactId || null,
      message_id: webhookData.messageId || null,
      message_type: webhookData.messageType,
      direction: webhookData.direction,
      body: webhookData.body || null,
      attachments: webhookData.attachments || [],
      status: webhookData.status || null,
      date_added: webhookData.dateAdded,
      webhook_received_at: new Date().toISOString(),
      raw_webhook_data: webhookData,
      processed: false,
      
      // Call-specific fields
      call_duration: webhookData.callDuration || null,
      call_status: webhookData.callStatus || null,
      
      // Email-specific fields
      email_message_id: webhookData.emailMessageId || null,
      email_thread_id: webhookData.threadId || null,
      email_from: webhookData.from || null,
      email_to: webhookData.to || null,
      email_cc: webhookData.cc || null,
      email_bcc: webhookData.bcc || null,
      email_subject: webhookData.subject || null,
      
      // User and provider info
      user_id: webhookData.userId || null,
      conversation_provider_id: webhookData.conversationProviderId || null
    }

    console.log('Inserting conversation record...')
    
    // Insert the conversation record
    const { data: insertedRecord, error: insertError } = await supabase
      .from('ghl_conversations')
      .insert(conversationRecord)
      .select('id, message_id, conversation_id')
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      throw new Error(`Failed to insert conversation record: ${insertError.message}`)
    }

    console.log('✅ Conversation record inserted successfully:', {
      id: insertedRecord.id,
      messageId: insertedRecord.message_id,
      conversationId: insertedRecord.conversation_id
    })

    // TODO: Trigger data extraction processing here
    // This is where you would queue the message for AI processing
    console.log('📝 Message queued for future data extraction processing')

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        recordId: insertedRecord.id,
        messageId: insertedRecord.message_id,
        conversationId: insertedRecord.conversation_id
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
    console.error("=== WEBHOOK PROCESSING ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Webhook processing failed: ${error.message}`,
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