// index.mjs
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getSupabaseClient, getGHLConfiguration, getExtractionFields, getContextualRules } from './supabaseClient.mjs';
import { getSecrets } from './secrets.mjs'; // Still needed for Supabase keys

// X-Ray SDK import and initialization
let AWSXRay;
try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
} catch (e) {
    console.warn("X-Ray SDK not loaded, continuing without tracing:", e.message);
    AWSXRay = null;
}

// Initialize AWS Lambda client once per Lambda container
let lambdaClient;
if (AWSXRay) {
    lambdaClient = AWSXRay.captureAWSv3Client(new LambdaClient({}));
} else {
    lambdaClient = new LambdaClient({});
}

/**
 * Invokes a downstream Lambda function.
 * @param {string} functionArn - The ARN of the target Lambda function.
 * @param {object} payload - The payload to send to the Lambda function.
 * @param {string} invocationType - 'Event' for async, 'RequestResponse' for sync.
 * @param {string} subsegmentName - Name for the X-Ray subsegment.
 * @returns {Promise<object | void>} - Response payload for RequestResponse, or void for Event.
 */
async function invokeDownstreamLambda(functionArn, payload, invocationType, subsegmentName) {
    const currentSegment = AWSXRay && AWSXRay.getSegment();

    if (!functionArn) {
        console.warn(`Skipping invocation for ${subsegmentName}: ARN is not configured.`);
        // Add annotation for missing ARN if X-Ray is active
        if (currentSegment) {
            currentSegment.addAnnotation(`skipInvoke_${subsegmentName}`, 'ARN_NOT_CONFIGURED');
        }
        return;
    }

    const operation = async (subsegment) => {
        try {
            if (subsegment) { // Ensure subsegment exists before adding to it
                subsegment.addAnnotation('targetLambdaArn', functionArn);
                subsegment.addAnnotation('invocationType', invocationType);
            }

            const command = new InvokeCommand({
                FunctionName: functionArn,
                InvocationType: invocationType,
                Payload: JSON.stringify(payload),
            });

            const { Payload, StatusCode, FunctionError } = await lambdaClient.send(command);

            // Log details for debugging downstream Lambda errors
            if (FunctionError) {
                const errorDetails = Buffer.from(FunctionError).toString();
                console.error(`Downstream Lambda ${functionArn} returned error: ${errorDetails}`);
                // Add error details to subsegment
                if (subsegment) {
                    subsegment.addMetadata('DownstreamLambdaError', errorDetails);
                }
            }

            if (StatusCode !== 200 && StatusCode !== 202) { // 200 for RequestResponse success, 202 for Event success
                const errorDetails = FunctionError ? Buffer.from(FunctionError).toString() : 'Unknown error';
                throw new Error(`Downstream Lambda invocation failed with status ${StatusCode}: ${errorDetails}`);
            }

            if (Payload) {
                const rawResponseFromDownstream = JSON.parse(Buffer.from(Payload).toString());

                // --- START FIX FOR DOWNSTREAM LAMBDA RESPONSE PARSING ---
                let actualPayload;
                // Check if the downstream Lambda returned an API Gateway-like response (with a stringified 'body')
                if (rawResponseFromDownstream.body && typeof rawResponseFromDownstream.body === 'string') {
                    try {
                        actualPayload = JSON.parse(rawResponseFromDownstream.body);
                    } catch (parseError) {
                        console.error(`Failed to parse body of downstream Lambda response from ${functionArn}: ${parseError.message}`, rawResponseFromDownstream.body);
                        if (subsegment) subsegment.addError(parseError);
                        throw new Error(`Malformed response body from downstream Lambda ${functionArn}: ${parseError.message}`);
                    }
                } else {
                    // If no 'body' or it's not a string, assume the raw response IS the actual payload
                    actualPayload = rawResponseFromDownstream;
                }

                if (actualPayload.error) {
                    if (subsegment) subsegment.addError(new Error(actualPayload.error));
                    throw new Error(`Downstream Lambda returned error: ${actualPayload.error}`);
                }
                return actualPayload; // Return the actual parsed payload
                // --- END FIX FOR DOWNSTREAM LAMBDA RESPONSE PARSING ---
            }
            return; // For 'Event' type invocations or no payload
        } catch (e) {
            if (subsegment) subsegment.addError(e);
            throw e;
        } finally {
            if (subsegment) subsegment.close(); // Ensure subsegment is closed
        }
    };

    if (currentSegment && AWSXRay && AWSXRay.captureAsyncFunc) {
        // Pass currentSegment as the parent for the subsegment
        return AWSXRay.captureAsyncFunc(subsegmentName, operation, currentSegment);
    } else {
        return operation(null); // No X-Ray segment if SDK not loaded
    }
}


/**
 * Main Lambda handler for AI Extraction Orchestrator.
 * It coordinates fetching conversation history, generating AI prompts,
 * assembling the payload, and invoking the OpenAI extraction function.
 * @param {object} event - The Lambda event payload from ghl-conversation-logger.
 *                         Expected: { conversation_id: string, location_id: string, contact_id: string }
 * @returns {Promise<object>} - A success or error response.
 */
export const handler = async (event) => { // Directly export the async handler
    const currentSegment = AWSXRay && AWSXRay.getSegment(); // Get the root segment created by Lambda
    if (currentSegment) {
        currentSegment.addAnnotation('handler', 'ai-extraction-orchestrator');
    }

    console.log('AI_EXTRACTION_ORCHESTRATOR received event:', JSON.stringify(event));

    const { conversation_id, location_id, contact_id } = event;

    if (!conversation_id || !location_id) {
        const error = new Error("Missing required parameters: conversation_id or location_id.");
        if (currentSegment) currentSegment.addError(error);
        console.error(error.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message }),
        };
    }

    if (currentSegment) {
        currentSegment.addAnnotation('conversationId', conversation_id);
        currentSegment.addAnnotation('locationId', location_id);
        currentSegment.addAnnotation('contactId', contact_id || 'N/A');
    }

    try {
        // Retrieve Lambda ARNs from environment variables
        const GET_CONVERSATION_HISTORY_LAMBDA_ARN = process.env.GET_CONVERSATION_HISTORY_LAMBDA_ARN;
        const AI_PROMPT_GENERATOR_LAMBDA_ARN = process.env.AI_PROMPT_GENERATOR_LAMBDA_ARN;
        const OPENAI_EXTRACTION_LAMBDA_ARN = process.env.OPENAI_EXTRACTION_LAMBDA_ARN;

        // Verify ARNs are set
        if (!GET_CONVERSATION_HISTORY_LAMBDA_ARN) {
            throw new Error("Environment variable GET_CONVERSATION_HISTORY_LAMBDA_ARN is not set.");
        }
        if (!AI_PROMPT_GENERATOR_LAMBDA_ARN) {
            throw new Error("Environment variable AI_PROMPT_GENERATOR_LAMBDA_ARN is not set.");
        }
        if (!OPENAI_EXTRACTION_LAMBDA_ARN) {
            throw new Error("Environment variable OPENAI_EXTRACTION_LAMBDA_ARN is not set.");
        }

        // It's generally good practice to also cache the Supabase client if secrets are cached.
        // For now, keeping it as is, assuming getSupabaseClient handles its own caching.
        const supabase = await getSupabaseClient(); // This will use secrets.mjs for Supabase keys

        // Step 1: Get conversation history from get-conversation-history Lambda
        console.log('Step 1: Invoking get-conversation-history Lambda...');
        const conversationData = await invokeDownstreamLambda(
            GET_CONVERSATION_HISTORY_LAMBDA_ARN,
            { conversation_id: conversation_id, location_id: location_id }, // Pass location_id too if get-conversation-history needs it
            'RequestResponse',
            'Invoke_get-conversation-history'
        );

        // The conversationData object should now directly contain 'success' and 'messages'
        if (!conversationData || !conversationData.success || !conversationData.messages) {
            // Log the malformed data for debugging
            console.error('Malformed conversation data received:', JSON.stringify(conversationData, null, 2));
            throw new Error(`Failed to retrieve conversation history or data is malformed: ${JSON.stringify(conversationData)}`);
        }
        if (currentSegment) currentSegment.addAnnotation('messagesCount', conversationData.messages.length);
        console.log('Conversation data retrieved:', {
            messages: conversationData.messages.length,
            location_id: conversationData.location_id, // Assuming it returns this
            contact_id: conversationData.contact_id // Assuming it returns this
        });

        // Step 2, 3, 4: Get GHL configuration, extraction fields, and contextual rules from Supabase directly
        console.log('Step 2: Fetching GHL configuration...');
        const ghlConfig = await getGHLConfiguration(supabase, conversationData.location_id);
        if (!ghlConfig) {
            throw new Error(`No GHL configuration found for location: ${conversationData.location_id}`);
        }
        console.log('Step 3: Fetching extraction fields...');
        const extractionFields = await getExtractionFields(supabase, ghlConfig.id);
        console.log(`Found ${extractionFields.length} extraction fields`);
        console.log('Step 4: Fetching contextual rules...');
        const contextualRules = await getContextualRules(supabase, ghlConfig.id);
        console.log(`Found ${contextualRules.length} contextual rules`);

        // Step 5: Generate extraction prompt from ai-prompt-generator Lambda
        console.log('Step 5: Invoking ai-prompt-generator Lambda...');
        // Ensure prompt generator gets all necessary context
        const promptGeneratorPayload = {
            locationId: conversationData.location_id,
            ghlConfig: ghlConfig,
            extractionFields: extractionFields,
            contextualRules: contextualRules
            // Pass the conversation history if the prompt generator needs to consider it
            // conversationHistory: conversationData.messages
        };
        const promptData = await invokeDownstreamLambda(
            AI_PROMPT_GENERATOR_LAMBDA_ARN,
            promptGeneratorPayload,
            'RequestResponse',
            'Invoke_ai-prompt-generator'
        );

        if (!promptData || !promptData.success || !promptData.prompt) {
            console.error('Malformed prompt data received:', JSON.stringify(promptData, null, 2));
            throw new Error(`Failed to generate extraction prompt or data is malformed: ${JSON.stringify(promptData)}`);
        }
        if (currentSegment) currentSegment.addAnnotation('promptLength', promptData.prompt.length);
        console.log('Extraction prompt generated successfully');

        // Step 6: Build the final extraction payload
        console.log('Step 6: Building final extraction payload...');
        const fieldsToExtract = extractionFields.map((field) => ({
            name: field.field_name,
            ghl_key: field.target_ghl_key,
            instructions: field.description,
            type: field.field_type,
            required: field.is_required || false,
            options: field.picklist_options || []
        }));

        const businessContext = {
            name: ghlConfig.business_name || `Business ${conversationData.location_id}`,
            description: ghlConfig.business_description || '',
            services: ghlConfig.services_offered || '',
            context: ghlConfig.business_context || ''
        };

        const extractionPayload = {
            conversation_id: conversation_id,
            location_id: conversationData.location_id,
            contact_id: conversationData.contact_id,
            agency_ghl_id: ghlConfig.agency_ghl_id, // <--- ADDED THIS LINE
            business_context: businessContext,
            fields_to_extract: fieldsToExtract,
            conversation_history: conversationData.messages,
            system_prompt: promptData.prompt, // Use the generated prompt
            instructions: "Extract all relevant information from the conversation",
            response_format: {
                type: "json_object",
                rules: [
                    "Use exact field keys as specified",
                    "Only include fields with extractable values",
                    "Format dates as YYYY-MM-DD",
                    "Return valid JSON only"
                ]
            }
        };

        if (currentSegment) {
            currentSegment.addAnnotation('payloadFieldsCount', extractionPayload.fields_to_extract.length);
            currentSegment.addAnnotation('payloadMessagesCount', extractionPayload.conversation_history.length);
        }
        console.log('✅ Extraction payload built successfully');
        console.log('Payload summary:', {
            conversation_id: extractionPayload.conversation_id,
            location_id: extractionPayload.location_id,
            contact_id: extractionPayload.contact_id || 'Not available',
            agency_ghl_id: extractionPayload.agency_ghl_id || 'Not available', // Added for logging
            fields_count: extractionPayload.fields_to_extract.length,
            messages_count: extractionPayload.conversation_history.length
        });

        // Step 7: Call OpenAI extraction function
        console.log('Step 7: Invoking openai-extraction function...');
        const extractionResult = await invokeDownstreamLambda(
            OPENAI_EXTRACTION_LAMBDA_ARN,
            extractionPayload,
            'RequestResponse',
            'Invoke_openai-extraction'
        );

        if (!extractionResult || !extractionResult.extracted_data) {
            console.error('Malformed OpenAI extraction result received:', JSON.stringify(extractionResult, null, 2));
            throw new Error(`OpenAI extraction failed or returned malformed data: ${JSON.stringify(extractionResult)}`);
        }
        if (currentSegment) currentSegment.addAnnotation('extractedFields', Object.keys(extractionResult.extracted_data).length);
        console.log('✅ OpenAI extraction completed successfully');
        console.log('Extracted fields:', Object.keys(extractionResult.extracted_data || {}));

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                conversation_id: conversation_id,
                location_id: conversationData.location_id,
                contact_id: conversationData.contact_id,
                extraction_result: extractionResult,
                timestamp: new Date().toISOString()
            }),
        };

    } catch (error) {
        console.error("=== AI EXTRACTION ORCHESTRATOR ERROR ===");
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);

        if (currentSegment) {
            currentSegment.addError(error);
            currentSegment.addAnnotation('errorName', error.name);
            currentSegment.addAnnotation('errorMessage', error.message);
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: `Failed to orchestrate AI extraction: ${error.message}`,
                details: error.toString(),
                timestamp: new Date().toISOString()
            }),
        };
    }
};