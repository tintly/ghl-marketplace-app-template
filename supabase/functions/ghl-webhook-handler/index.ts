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
  messageType: 'SMS' | 'CALL' | 'Email' | 'GMB' | 'FB' | 'IG' | 'Live Chat' | string
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

// Message types that should trigger AI extraction
const EXTRACTION_MESSAGE_TYPES = ['SMS', 'GMB', 'FB', 'IG', 'Live Chat'];

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
    console.log('Contact ID:', webhookData.contactId || 'Not provided')
    console.log('Message ID:', webhookData.messageId || 'Not provided')
    console.log('Message body:', webhookData.body ? webhookData.body.substring(0, 100) + (webhookData.body.length > 100 ? '...' : '') : 'No body')
    
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
      console.log('Checking for duplicate message:', webhookData.messageId)
      const { data: existingMessage } = await supabase
        .from('ghl_conversations')
        .select('id, processed, processing_error')
        .eq('message_id', webhookData.messageId)
        .maybeSingle()

      if (existingMessage) {
        console.log('Message already exists, skipping:', webhookData.messageId)
        console.log('Previous processing status:', existingMessage.processed ? 'Processed' : 'Not processed')
        if (existingMessage.processing_error) {
          console.log('Previous processing error:', existingMessage.processing_error)
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Message already processed",
            messageId: webhookData.messageId,
            previousRecord: {
              id: existingMessage.id,
              processed: existingMessage.processed,
              hasError: !!existingMessage.processing_error
            }
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

    // Check if this message type should trigger AI extraction
    const shouldExtract = EXTRACTION_MESSAGE_TYPES.includes(webhookData.messageType);
    
    if (shouldExtract) {
      console.log(`📝 Message type ${webhookData.messageType} qualifies for AI extraction, triggering process...`)
      
      try {
        // Call the ai-extraction-payload function
        console.log('Calling ai-extraction-payload with conversation_id:', webhookData.conversationId)
        const extractionResponse = await fetch(`${supabaseUrl}/functions/v1/ai-extraction-payload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ 
            conversation_id: webhookData.conversationId,
            auto_extract: true // Enable automatic extraction
          })
        })
        
        console.log('Extraction response status:', extractionResponse.status)
        
        if (!extractionResponse.ok) {
          const errorText = await extractionResponse.text()
          console.error('AI extraction failed:', errorText)
          
          // Update the conversation record to mark as processed with error
          await supabase
            .from('ghl_conversations')
            .update({
              processed: true,
              processing_error: `AI extraction failed: ${extractionResponse.status} - ${errorText}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', insertedRecord.id)
            
          return new Response(
            JSON.stringify({
              success: true,
              message: "Webhook processed but extraction failed",
              recordId: insertedRecord.id,
              messageId: insertedRecord.message_id,
              conversationId: insertedRecord.conversation_id,
              extractionError: errorText
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
        
        const extractionResult = await extractionResponse.json()
        console.log('✅ AI extraction completed successfully')
        console.log('Extraction result success:', extractionResult.success)
        console.log('Extracted fields:', Object.keys(extractionResult.extraction_result?.extracted_data || {}).length)
        
        if (extractionResult.extraction_result?.usage) {
          console.log('Model used:', extractionResult.extraction_result.usage.model)
          console.log('Total tokens:', extractionResult.extraction_result.usage.total_tokens)
          console.log('Cost estimate:', `$${extractionResult.extraction_result.usage.cost_estimate}`)
        }
        
        // Update the conversation record to mark as processed
        await supabase
          .from('ghl_conversations')
          .update({
            processed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', insertedRecord.id)
        
        return new Response(
          JSON.stringify({
            success: true,
            message: "Webhook processed and extraction completed",
            recordId: insertedRecord.id,
            messageId: insertedRecord.message_id,
            conversationId: insertedRecord.conversation_id,
            extractionResult: {
              success: extractionResult.success,
              extracted_fields: Object.keys(extractionResult.extraction_result?.extracted_data || {}).length
            }
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
        console.error('Error triggering extraction:', extractionError)
        console.error('Error details:', extractionError.stack || 'No stack trace available')
        
        // Update the conversation record to mark as processed with error
        await supabase
          .from('ghl_conversations')
          .update({
            processed: true,
            processing_error: `Error triggering extraction: ${extractionError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', insertedRecord.id)
      }
    } else {
      console.log(`📝 Message type ${webhookData.messageType} does not qualify for AI extraction, skipping`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        recordId: insertedRecord.id,
        messageId: insertedRecord.message_id,
        conversationId: insertedRecord.conversation_id,
        extractionTriggered: shouldExtract
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