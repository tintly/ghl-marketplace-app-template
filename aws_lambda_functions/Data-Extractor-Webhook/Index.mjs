import { createClient } from '@supabase/supabase-js'

// Import AWS-related configurations, X-Ray, and utility functions
import {
  AWSXRay,
  loadSecrets,
  invokeDownstreamLambda,
  AI_EXTRACTION_LAMBDA_ARN,
  CALL_PROCESSING_LAMBDA_ARN,
  EMAIL_PROCESSING_LAMBDA_ARN,
} from './awsUtilities.mjs'

// Import webhook processing utilities and constants
import {
  CORS_HEADERS,
  INBOUND_AI_EXTRACTION_MESSAGE_TYPES,
  mapWebhookToConversation,
} from './ghlUtils.mjs'

let cachedSecrets = null; // Cache secrets across warm invocations

// --- Lambda Handler ---
export const handler = async (event) => {
  // Log the entire incoming event for debugging
  console.log('--- FULL INVOCATION EVENT ---', JSON.stringify(event, null, 2));

  let segment = null;
  if (AWSXRay) {
    segment = AWSXRay.getSegment();
  }

  // --- START OF CORRECTION ---
  // Lambda Function URLs (payload format 2.0) place the HTTP method
  // in a different location than API Gateway v1. We extract it here.
  const httpMethod = event.requestContext?.http?.method;
  // --- END OF CORRECTION ---

  if (segment) {
    segment.addAnnotation('httpMethod', httpMethod);
  }

  try {
    if (!cachedSecrets) {
        console.log("Secrets not cached, loading now...");
        cachedSecrets = await loadSecrets();
    } else {
        console.log("Using cached secrets.");
    }
  } catch (error) {
    if (segment) segment.addError(error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
      },
      body: JSON.stringify({
        error: "Failed to load secrets for the function.",
        details: error.message
      })
    };
  }

  // Use the corrected 'httpMethod' variable for all subsequent checks
  if (httpMethod === "OPTIONS") {
    if (segment) segment.addAnnotation('requestType', 'OPTIONS_PREFLIGHT');
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ""
    };
  }

  if (httpMethod !== "POST") {
    if (segment) segment.addAnnotation('requestType', 'METHOD_NOT_ALLOWED');
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
      },
      body: JSON.stringify({
        error: "Method not allowed. Use POST."
      })
    };
  }

  let rawWebhookData;
  try {
    // Ensure event.body exists before trying to parse it
    if (!event.body) {
        throw new Error("Request body is missing.");
    }
    rawWebhookData = JSON.parse(event.body);
    if (segment) {
        segment.addAnnotation('locationId', rawWebhookData.locationId);
        segment.addAnnotation('conversationId', rawWebhookData.conversationId);
        segment.addAnnotation('contactId', rawWebhookData.contactId);
        segment.addAnnotation('webhookType', rawWebhookData.type);
        segment.addAnnotation('messageType', rawWebhookData.messageType);
        segment.addAnnotation('direction', rawWebhookData.direction);
    }
  } catch (e) {
    console.error("Error parsing request body as JSON:", e);
    if (segment) segment.addError(e);
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
      },
      body: JSON.stringify({
        error: "Invalid JSON payload.",
        details: e.message,
        timestamp: new Date().toISOString()
      })
    };
  }

  console.log('=== INCOMING GHL CONVERSATION WEBHOOK ===');
  console.log('Received payload:', JSON.stringify(rawWebhookData, null, 2));

  try {
    const supabase = createClient(cachedSecrets.SUPABASE_PROJECT_URL, cachedSecrets.SUPABASE_SERVICE_ROLE_SECRET);
    const conversationData = mapWebhookToConversation(rawWebhookData);

    let logId = null;
    if (segment && AWSXRay.captureAsyncFunc) {
        await AWSXRay.captureAsyncFunc('SupabaseInsertConversation', async (subsegment) => {
            try {
                subsegment.addAnnotation('table', 'ghl_conversations');
                subsegment.addMetadata('insertData', conversationData);

                const { data, error } = await supabase
                    .from('ghl_conversations')
                    .insert(conversationData)
                    .select('id');

                if (error) {
                    subsegment.addError(error);
                    throw error;
                }
                logId = data ? data[0].id : null;
                subsegment.addAnnotation('logId', logId);
                subsegment.addAnnotation('status', 'success');
            } finally {
                subsegment.close();
            }
        }, segment);
    } else {
        const { data, error } = await supabase
            .from('ghl_conversations')
            .insert(conversationData)
            .select('id');

        if (error) {
            throw error;
        }
        logId = data ? data[0].id : null;
    }

    console.log('✅ GHL conversation logged successfully to Supabase');

    const { message_type, direction, conversation_id, location_id, contact_id } = conversationData;

    const invocationPayload = {
        logId: logId,
        conversation_id: conversation_id,
        location_id: location_id,
        contact_id: contact_id,
        messageType: message_type,
        direction: direction,
    };

    if (direction === 'inbound' && INBOUND_AI_EXTRACTION_MESSAGE_TYPES.includes(message_type)) {
        console.log(`inbound text-based message (${message_type}) detected. Invoking AI Extraction Lambda: ${AI_EXTRACTION_LAMBDA_ARN}`);
        await invokeDownstreamLambda(AI_EXTRACTION_LAMBDA_ARN, invocationPayload, segment);
    } else if (message_type === 'Call' || message_type === 'Voicemail') {
        console.log(`Call/Voicemail detected. Invoking Call Processing Lambda: ${CALL_PROCESSING_LAMBDA_ARN}`);
        await invokeDownstreamLambda(CALL_PROCESSING_LAMBDA_ARN, invocationPayload, segment);
    } else if (message_type === 'Email') {
        console.log(`Email detected. Invoking Email Processing Lambda: ${EMAIL_PROCESSING_LAMBDA_ARN}`);
        await invokeDownstreamLambda(EMAIL_PROCESSING_LAMBDA_ARN, invocationPayload, segment);
    } else {
        console.log(`No specific downstream processing required for message type: ${message_type}, direction: ${direction}`);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
      },
      body: JSON.stringify({
        success: true,
        message: "GHL conversation payload logged successfully.",
        log_id: logId,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error("=== GHL CONVERSATION LOGGING ERROR ===");
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    if (segment) segment.addError(error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
      },
      body: JSON.stringify({
        error: `GHL conversation logging failed: ${error.message}`,
        details: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
};