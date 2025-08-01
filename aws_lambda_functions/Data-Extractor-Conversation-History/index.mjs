// Path: index.mjs (for get-conversation-history Lambda)

import { getSupabaseClient } from './supabaseClient.mjs';

// --- CRITICAL CHANGE FOR X-RAY SDK IMPORT ---
let AWSXRay;
try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
    console.log("X-Ray SDK loaded successfully using dynamic import.");
} catch (e) {
    console.error("Failed to load AWS X-Ray SDK:", e);
    AWSXRay = {};
}
// --- END CRITICAL CHANGE ---


// Helper to create a standard Lambda response with CORS headers
const createResponse = (statusCode, body) => {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization"
        },
        body: JSON.stringify(body),
    };
};

// Define the core logic of your handler in a separate function
const _handler = async (event) => {
    // Handle CORS preflight requests for testing from a browser (if exposed via API Gateway)
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(204, {});
    }

    console.log('=== GET CONVERSATION HISTORY: START ===');
    
    try {
        let requestBody;
        // FIX: Determine the request body based on invocation type
        if (event.body) { // If invoked via API Gateway (or similar HTTP proxy)
            requestBody = JSON.parse(event.body);
            console.log("Invoked via API Gateway, parsing event.body.");
        } else { // If invoked directly by another Lambda (like the orchestrator)
            requestBody = event; // The event itself is the payload
            console.log("Invoked directly by Lambda, using event as payload.");
        }

        const conversationId = requestBody.conversation_id || requestBody.conversationId;
        const locationIdFromEvent = requestBody.location_id || requestBody.locationId; // Capture location_id if passed

        // --- X-Ray: Add Annotations for Searchability ---
        const segment = AWSXRay.getSegment ? AWSXRay.getSegment() : null; 
        if (segment) { 
            segment.addAnnotation('conversationId', conversationId);
            if (locationIdFromEvent) segment.addAnnotation('locationIdFromEvent', locationIdFromEvent);
        } else {
            console.warn("X-Ray segment not available for annotations.");
        }
        // --- End X-Ray Annotations ---

        if (!conversationId) {
            return createResponse(400, {
                success: false,
                error: "conversation_id is required in the request body.",
                example: { "conversation_id": "your_conversation_id_here" }
            });
        }

        console.log(`Fetching history for conversation_id: ${conversationId}`);
        if (locationIdFromEvent) {
            console.log(`Filtering by location_id: ${locationIdFromEvent}`);
        }

        const supabase = await getSupabaseClient();

        let messages;
        let error;

        // --- X-Ray: Create a custom subsegment for the Supabase query ---
        if (segment && AWSXRay.captureAsyncFunc) { 
            await AWSXRay.captureAsyncFunc('SupabaseQuery_ghl_conversations', async (subsegment) => {
                try {
                    let query = supabase
                        .from('ghl_conversations')
                        .select('direction, body, date_added, location_id, contact_id')
                        .eq('conversation_id', conversationId)
                        .not('body', 'is', null)
                        .order('date_added', { ascending: true })
                        .limit(50);
                    
                    // FIX: Add location_id to the query if available
                    if (locationIdFromEvent) {
                        query = query.eq('location_id', locationIdFromEvent);
                    }

                    const result = await query;
                    
                    messages = result.data;
                    error = result.error;

                    if (error) {
                        subsegment.addError(error);
                    }
                } catch (e) {
                    subsegment.addError(e);
                    throw e;
                } finally {
                    if (subsegment) {
                        subsegment.close(); 
                    }
                }
            }, segment);
        } else {
            console.warn("X-Ray tracing for Supabase query skipped (segment or captureAsyncFunc not available).");
            let query = supabase
                .from('ghl_conversations')
                .select('direction, body, date_added, location_id, contact_id')
                .eq('conversation_id', conversationId)
                .not('body', 'is', null)
                .order('date_added', { ascending: true })
                .limit(50);
            
            // FIX: Add location_id to the query if available
            if (locationIdFromEvent) {
                query = query.eq('location_id', locationIdFromEvent);
            }
            const result = await query;
            messages = result.data;
            error = result.error;
        }
        // --- End X-Ray Subsegment ---

        if (error) {
            console.error('Supabase query error:', error);
            throw new Error(`Database error: ${error.message}`);
        }

        if (!messages || messages.length === 0) {
            console.log(`No messages found for conversation_id: ${conversationId}`);
            return createResponse(200, {
                success: true,
                message: "No messages found for this conversation.",
                conversation_id: conversationId,
                messages: [],
                transcript: "",
                total_messages: 0,
                location_id: locationIdFromEvent, // Return the location_id that was passed
                contact_id: null // Contact ID might not be known if no messages
            });
        }

        console.log(`Found ${messages.length} messages.`);

        const formattedMessages = messages.map(msg => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.body || ''
        }));
        
        const transcript = formattedMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');

        // Use the location_id from the first message if available, otherwise from the event
        const locationId = messages[0]?.location_id || locationIdFromEvent || null;
        const contactId = messages[0]?.contact_id || null;

        // --- X-Ray: Add more Annotations once data is available ---
        if (segment) {
            segment.addAnnotation('locationId', locationId);
            segment.addAnnotation('contactId', contactId);
            segment.addMetadata('totalMessages', formattedMessages.length);
        }
        // --- End X-Ray Annotations ---

        const responsePayload = {
            success: true,
            conversation_id: conversationId,
            location_id: locationId,
            contact_id: contactId,
            total_messages: formattedMessages.length,
            messages: formattedMessages,
            transcript: transcript,
        };

        console.log('✅ GET CONVERSATION HISTORY: SUCCESS ===');
        return createResponse(200, responsePayload);

    } catch (error) {
        console.error("=== GET CONVERSATION HISTORY: ERROR ===");
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);
        
        const segment = AWSXRay.getSegment ? AWSXRay.getSegment() : null;
        if (segment) {
            segment.addError(error);
        } else {
            console.warn("X-Ray segment not available to capture error.");
        }

        return createResponse(500, {
            success: false,
            error: `An internal server error occurred: ${error.message}`
        });
    }
};

export const handler = AWSXRay.captureAWSLambda ? AWSXRay.captureAWSLambda(_handler) : _handler;