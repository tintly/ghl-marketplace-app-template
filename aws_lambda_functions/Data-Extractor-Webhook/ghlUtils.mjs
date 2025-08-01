// --- CORS Headers ---
export const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  
  // Define the message types that should trigger AI extraction for inbound messages
  export const INBOUND_AI_EXTRACTION_MESSAGE_TYPES = [
      'SMS',
      'WhatsApp',
      'IG', // Instagram
      'FB', // Facebook Messenger
      'Custom',
      'Live_Chat'
  ];
  
  /**
   * Maps an incoming GoHighLevel webhook payload to the ghl_conversations table schema.
   * @param {object} webhookPayload - The parsed JSON payload from the GHL webhook.
   * @returns {object} An object formatted for insertion into the ghl_conversations table.
   */
  export function mapWebhookToConversation(webhookPayload) {
    const mappedData = {
      location_id: webhookPayload.locationId || null,
      conversation_id: webhookPayload.conversationId || null,
      contact_id: webhookPayload.contactId || null,
      direction: webhookPayload.direction || null,
      date_added: webhookPayload.dateAdded ? new Date(webhookPayload.dateAdded).toISOString() : null,
      raw_webhook_data: webhookPayload,
      webhook_received_at: new Date().toISOString(),
      processed: false,
      processing_error: null,
  
      message_id: null,
      message_type: null,
      body: null,
      attachments: null,
      status: null,
      call_duration: null,
      call_status: null,
      email_message_id: null,
      email_thread_id: null,
      email_from: null,
      email_to: null,
      email_cc: null,
      email_bcc: null,
      email_subject: null,
      user_id: null,
      conversation_provider_id: null,
    };
  
    const webhookType = webhookPayload.type;
    const messageType = webhookPayload.messageType;
  
    if (webhookType === "OutboundMessage" || webhookType === "InboundMessage") {
      mappedData.message_id = webhookPayload.messageId || null;
      mappedData.message_type = messageType || null;
      mappedData.body = webhookPayload.body || null;
      mappedData.attachments = webhookPayload.attachments || [];
      mappedData.status = webhookPayload.status || null;
    } else if (webhookType === "Call") {
      mappedData.message_type = messageType || 'Call';
      mappedData.call_duration = webhookPayload.callDuration || null;
      mappedData.call_status = webhookPayload.callStatus || null;
      mappedData.user_id = webhookPayload.userId || null;
      if (webhookPayload.recordingUrl) {
          mappedData.attachments = [{ type: 'audio', url: webhookPayload.recordingUrl }];
      }
    } else if (webhookType === "Email") {
      mappedData.message_type = messageType || 'Email';
      mappedData.email_message_id = webhookPayload.emailMessageId || null;
      mappedData.email_thread_id = webhookPayload.emailThreadId || null;
      mappedData.email_from = webhookPayload.emailFrom || null;
      mappedData.email_to = webhookPayload.emailTo || null;
      mappedData.email_cc = webhookPayload.emailCc || null;
      mappedData.email_bcc = webhookPayload.emailBcc || null;
      mappedData.email_subject = webhookPayload.emailSubject || null;
      mappedData.body = webhookPayload.body || null;
      mappedData.attachments = webhookPayload.attachments || [];
    }
  
    mappedData.conversation_provider_id = webhookPayload.conversationProviderId || null;
  
    return mappedData;
  }