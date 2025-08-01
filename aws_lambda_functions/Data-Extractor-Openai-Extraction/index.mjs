// Path: index.mjs (for openai-extraction-lambda)
import { getSupabaseClient } from './supabaseClient.mjs';
import { getOpenAISecrets, getSupabaseSecrets } from './secrets.mjs';
import { decryptApiKey, updateUsageLog } from './helpers.mjs';
import * as ghlWalletService from './ghlWalletService.mjs';
import OpenAI from 'openai';
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda"; // Keep this import

// X-Ray SDK import and initialization
let AWSXRay;
try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
} catch (e) {
    console.warn("X-Ray SDK not loaded for openai-extraction-lambda.mjs:", e.message);
    AWSXRay = null;
}

// Initialize AWS Lambda client for cross-Lambda invocation
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGIONS || "us-east-2" });

/**
 * Main Lambda handler for OpenAI data extraction.
 * It receives a pre-assembled payload from the orchestrator.
 * It determines the OpenAI model, calls OpenAI, and logs usage.
 * @param {object} event - The payload from Data-Extractor-Prompt-Orchestrator.
 *                         Expected to match the `extractionPayload` structure.
 * @returns {Promise<object>} - A structured success or error response.
 */
export const handler = async (event) => {
    const currentSegment = AWSXRay && AWSXRay.getSegment();
    if (currentSegment) {
        currentSegment.addAnnotation('handler', 'openai-extraction-lambda');
        currentSegment.addAnnotation('invocationType', 'RequestResponse');
    }

    console.log('=== OPENAI EXTRACTION LAMBDA REQUEST ===');
    console.log('Received event:', JSON.stringify(event));

    // Destructure the event payload directly. No HTTP request object parsing needed.
    const {
        conversation_id,
        location_id,
        agency_ghl_id,
        contact_id,
        business_context,
        fields_to_extract,
        conversation_history,
        system_prompt,
        instructions,
        response_format,
        // Billing entity information for metered pricing
        billing_entity_id,
        billing_access_token,
        billing_refresh_token,
        billing_token_expires_at,
        billing_user_id,
        billing_company_id,
        // Removed overwrite_policy from here, as it's not directly used by this lambda's core logic
        // but would be passed to the update-ghl-contact lambda if needed there.
        // The original Deno function didn't use it in prepareUpdatePayload, it used field-specific policies.
    } = event;

    // Input validation (now operates directly on the 'event' payload)
    if (!conversation_id || !location_id || !fields_to_extract || !conversation_history || !system_prompt) {
        const error = new Error("Missing required fields in request body.");
        if (currentSegment) currentSegment.addError(error);
        console.error(error.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }

    // Initialize variables for logging and tracking
    let supabaseClient;
    let openai;
    let usageLogId = null;
    let extractionSuccess = false;
    let errorMessage = null;
    let responseTimeMs = null;
    let modelUsed = null;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let costEstimate = 0;
    let platformCostEstimate = 0;
    let customerCostEstimate = 0;
    let openaiKeyUsed = null;
    let ghlChargeId = null; // NEW: To store the GHL Wallet charge ID
    let isOverage = false;
    let meterId = '';
    let unitsToCharge = 0;
    let currentBillingAccessToken = billing_access_token; // Track current token for refreshes
    let ghlUpdateResult = null; // NEW: To store the result from the update Lambda

    const startTime = Date.now();

    try {
        // Retrieve Supabase secrets
        const supabaseSecrets = await getSupabaseSecrets();
        const supabaseUrl = supabaseSecrets.SUPABASE_PROJECT_URL;
        const supabaseServiceKey = supabaseSecrets.SUPABASE_SERVICE_ROLE_SECRET;

        // Retrieve OpenAI secrets
        const openaiSecrets = await getOpenAISecrets();
        let openaiApiKey = openaiSecrets.OPENAI_API_KEY;
        let openaiOrgId = openaiSecrets.OPENAI_ORG_ID;
        let openaiModel = 'gpt-4o-mini'; // Default model

        // Initialize Supabase client
        supabaseClient = await getSupabaseClient();

        // Step 0.5: Validate and refresh billing entity tokens if needed
        console.log('Step 0.5: Validating billing entity tokens...');
        if (billing_token_expires_at) {
            const expiryDate = new Date(billing_token_expires_at);
            const now = new Date();
            const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            console.log(`Billing token expires in ${hoursUntilExpiry.toFixed(2)} hours`);
            
            // Refresh if token expires within 1 hour
            if (hoursUntilExpiry <= 1) {
                console.log('Billing token needs refresh...');
                try {
                    const clientId = process.env.GHL_MARKETPLACE_CLIENT_ID;
                    const clientSecret = process.env.GHL_MARKETPLACE_CLIENT_SECRET;
                    
                    if (!clientId || !clientSecret) {
                        throw new Error('GHL client credentials not configured for token refresh');
                    }
                    
                    const refreshResult = await ghlWalletService.refreshAccessToken(
                        billing_refresh_token,
                        clientId,
                        clientSecret
                    );
                    
                    // Update the current token
                    currentBillingAccessToken = refreshResult.access_token;
                    
                    // Update the database with new tokens
                    const newExpiresAt = new Date(Date.now() + (refreshResult.expires_in * 1000)).toISOString();
                    
                    const { error: updateError } = await supabaseClient
                        .from('ghl_configurations')
                        .update({
                            access_token: refreshResult.access_token,
                            refresh_token: refreshResult.refresh_token,
                            token_expires_at: newExpiresAt,
                            updated_at: new Date().toISOString()
                        })
                        .eq('ghl_account_id', billing_entity_id);
                    
                    if (updateError) {
                        console.warn('Failed to update refreshed tokens in database:', updateError);
                    } else {
                        console.log('✅ Billing tokens refreshed and updated in database');
                    }
                    
                } catch (refreshError) {
                    console.error('Failed to refresh billing tokens:', refreshError);
                    errorMessage = `Failed to refresh billing tokens: ${refreshError.message}`;
                    extractionSuccess = false;
                    
                    // Update usage log with error and return early
                    if (usageLogId && supabaseClient) {
                        await updateUsageLog(supabaseClient, usageLogId, {
                            success: false,
                            error_message: errorMessage,
                            response_time_ms: Date.now() - startTime
                        }, currentSegment);
                    }
                    
                    return {
                        statusCode: 401,
                        body: JSON.stringify({
                            success: false,
                            error: errorMessage
                        }),
                    };
                }
            }
        }

        // Step 0.6: Determine if this extraction will be an overage and check funds
        console.log('Step 0.6: Checking for overage and funds...');
        // Determine if this is a call extraction based on the extraction type or conversation data
        isCallExtraction = event.extraction_type === 'call_extraction' || 
                          event.is_call_extraction === true ||
                          (event.conversation_history && event.conversation_history.some(msg => 
                              msg.message_type === 'Call' || msg.message_type === 'Voicemail'
                          ));
        
        // For call extractions, calculate minutes used (this would come from the call duration)
        if (isCallExtraction) {
            callMinutesUsed = event.call_duration_minutes || event.call_minutes || 1; // Default to 1 minute if not provided
            console.log(`Call extraction detected. Minutes to charge: ${callMinutesUsed}`);
        }

        try {
            // Get current usage for this location
            const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
            
            const { data: usageData, error: usageError } = await supabaseClient
                .from('usage_tracking')
                .select('messages_used')
                .eq('location_id', location_id)
                .eq('month_year', currentMonth)
                .maybeSingle();
            
            if (usageError && usageError.code !== 'PGRST116') {
                console.warn('Error fetching usage data:', usageError);
            }
            
            // Get subscription plan limits
            const { data: subscriptionData, error: subscriptionError } = await supabaseClient
                .from('location_subscriptions')
                .select(`
                    subscription_plans (
                        messages_included,
                        overage_price
                    )
                `)
                .eq('location_id', location_id)
                .eq('is_active', true)
                .maybeSingle();
            
            if (subscriptionError && subscriptionError.code !== 'PGRST116') {
                console.warn('Error fetching subscription data:', subscriptionError);
            }
            
            const currentMessagesUsed = usageData?.messages_used || 0;
            const messagesIncluded = subscriptionData?.subscription_plans?.messages_included || 500; // Default to 500 if no plan
            
            console.log('Usage check:', {
                currentMessagesUsed,
                messagesIncluded,
                isOverage: currentMessagesUsed >= messagesIncluded
            });
            
            // Determine if this extraction will be an overage
            if (currentMessagesUsed >= messagesIncluded) {
                isOverage = true;
                unitsToCharge = 1; // Charging per message
                
                // Determine Meter ID based on account type
                if (agency_ghl_id && agency_ghl_id !== location_id) {
                    // It's an agency sub-account
                    meterId = process.env.GHL_METER_ID_AGENCY_OVERAGE; // Use GHL-generated Meter ID for agency overage
                    console.log('Agency sub-account overage detected. Using agency meter ID.');
                } else {
                    // It's a direct account
                    meterId = process.env.GHL_METER_ID_DIRECT_OVERAGE; // Use GHL-generated Meter ID for direct account overage
                    console.log('Direct account overage detected. Using direct meter ID.');
                }
                
                console.log(`Overage will be charged: Meter ID: ${meterId}, Units: ${unitsToCharge}`);
                
                // Check funds before proceeding with OpenAI call
                console.log('Checking funds for billing entity:', billing_entity_id);
                const fundsCheck = await ghlWalletService.checkFunds(currentBillingAccessToken, billing_entity_id);
                
                if (!fundsCheck.hasFunds) {
                    errorMessage = `Insufficient funds in GHL Wallet for ${billing_entity_id}. Extraction aborted.`;
                    extractionSuccess = false;
                    console.error(errorMessage);
                    
                    // Update usage log with error and return early
                    if (usageLogId && supabaseClient) {
                        await updateUsageLog(supabaseClient, usageLogId, {
                            success: false,
                            error_message: errorMessage,
                            response_time_ms: Date.now() - startTime,
                            model_used: openaiModel
                        }, currentSegment);
                    }
                    
                    return {
                        statusCode: 402, // Payment Required
                        body: JSON.stringify({
                            success: false,
                            error: errorMessage,
                            billing_entity_id: billing_entity_id
                        }),
                    };
                }
                
                console.log('✅ Sufficient funds available for overage charge');
            } else {
                console.log('✅ Within free tier. No overage charge required.');
            }
            
        } catch (billingCheckError) {
            console.error('Error during billing check:', billingCheckError);
            // Continue with extraction but log the error
            console.warn('Proceeding with extraction despite billing check error');
        }
        // Determine OpenAI API key and model to use (agency-specific logic)
        if (agency_ghl_id) {
            console.log('Checking for agency-specific OpenAI key...');
            const { data: agencyKeyData, error: agencyKeyError } = await (async () => {
                if (AWSXRay && AWSXRay.captureAsyncFunc) {
                    return AWSXRay.captureAsyncFunc('Supabase - getAgencyOpenAIKey', async (subsegment) => {
                        const result = await supabaseClient.from('agency_openai_keys')
                            .select('encrypted_openai_api_key, openai_org_id, openai_model')
                            .eq('agency_ghl_id', agency_ghl_id)
                            .eq('is_active', true)
                            .maybeSingle();
                        if (subsegment) subsegment.addAnnotation('agencyGhlId', agency_ghl_id);
                        if (result.error) { if (subsegment) subsegment.addError(result.error); }
                        return result;
                    }, currentSegment);
                } else {
                    return await supabaseClient.from('agency_openai_keys')
                        .select('encrypted_openai_api_key, openai_org_id, openai_model')
                        .eq('agency_ghl_id', agency_ghl_id)
                        .eq('is_active', true)
                        .maybeSingle();
                }
            })();

            if (agencyKeyError) {
                console.warn('Error fetching agency OpenAI key:', agencyKeyError.message);
                if (currentSegment) currentSegment.addError(agencyKeyError, true);
            } else if (agencyKeyData && agencyKeyData.encrypted_openai_api_key) {
                console.log('Using agency-specific OpenAI key.');
                openaiApiKey = await decryptApiKey(agencyKeyData.encrypted_openai_api_key);
                openaiOrgId = agencyKeyData.openai_org_id || openaiOrgId;
                openaiModel = agencyKeyData.openai_model || openaiModel;
                console.log(`Using agency-selected model: ${openaiModel}`);
                openaiKeyUsed = agencyKeyData.encrypted_openai_api_key.substring(0, 10) + '...';
                if (currentSegment) {
                    currentSegment.addAnnotation('openaiKeySource', 'agency');
                    currentSegment.addAnnotation('agencyModelUsed', openaiModel);
                }
            } else {
                console.log('No active agency-specific OpenAI key found, falling back to default.');
                if (currentSegment) currentSegment.addAnnotation('openaiKeySource', 'default_fallback');
            }
        } else {
            console.log('No agency_ghl_id provided in event, using default OpenAI key and model.');
            if (currentSegment) currentSegment.addAnnotation('openaiKeySource', 'default');
        }

        if (!openaiApiKey) {
            throw new Error("OpenAI API key is not configured. Check secrets and agency keys.");
        }

        // Initialize OpenAI client
        openai = new OpenAI({
            apiKey: openaiApiKey,
            organization: openaiOrgId || undefined,
        });

        // Construct messages for OpenAI API
        const messages = [
            { role: "system", content: system_prompt },
            ...conversation_history.map((msg) => ({ role: msg.role, content: msg.content }))
        ];

        // Log initial usage record
        const { data: logData, error: logError } = await (async () => {
            if (AWSXRay && AWSXRay.captureAsyncFunc) {
                return AWSXRay.captureAsyncFunc('Supabase - createUsageLog', async (subsegment) => {
                    const result = await supabaseClient.from('ai_usage_logs').insert({
                        location_id: location_id,
                        agency_ghl_id: agency_ghl_id,
                        conversation_id: conversation_id,
                        model: openaiModel,
                        input_tokens: 0,
                        output_tokens: 0,
                        total_tokens: 0,
                        cost_estimate: 0,
                        platform_cost_estimate: 0,
                        customer_cost_estimate: 0,
                        success: false,
                        openai_key_used: openaiKeyUsed,
                        extraction_type: 'data_extraction'
                    }).select('id').single();
                    if (result.error) { if (subsegment) subsegment.addError(result.error); }
                    return result;
                }, currentSegment);
            } else {
                return await supabaseClient.from('ai_usage_logs').insert({
                    location_id: location_id,
                    agency_ghl_id: agency_ghl_id,
                    conversation_id: conversation_id,
                    model: openaiModel,
                    input_tokens: 0,
                    output_tokens: 0,
                    total_tokens: 0,
                    cost_estimate: 0,
                    platform_cost_estimate: 0,
                    customer_cost_estimate: 0,
                    success: false,
                    openai_key_used: openaiKeyUsed,
                    extraction_type: 'data_extraction'
                }).select('id').single();
            }
        })();

        if (logError) {
            console.error('Error creating usage log:', logError);
            throw new Error(`Failed to create usage log: ${logError.message}`);
        }
        usageLogId = logData.id;
        console.log('Usage log created with ID:', usageLogId);
        if (currentSegment) currentSegment.addAnnotation('usageLogId', usageLogId);

        // Call OpenAI API
        console.log('Calling OpenAI Chat Completions API...');
        const chatCompletion = await (async () => {
            if (AWSXRay && AWSXRay.captureAsyncFunc) {
                return AWSXRay.captureAsyncFunc('OpenAI - chatCompletions.create', async (subsegment) => {
                    if (subsegment) subsegment.addAnnotation('model', openaiModel);
                    const result = await openai.chat.completions.create({
                        model: openaiModel,
                        messages: messages,
                        response_format: { type: "json_object" },
                        temperature: 0.1
                    });
                    if (subsegment) {
                        subsegment.addAnnotation('inputTokens', result.usage?.prompt_tokens || 0);
                        subsegment.addAnnotation('outputTokens', result.usage?.completion_tokens || 0);
                        subsegment.addAnnotation('totalTokens', result.usage?.total_tokens || 0);
                    }
                    return result;
                }, currentSegment);
            } else {
                return await openai.chat.completions.create({
                    model: openaiModel,
                    messages: messages,
                    response_format: { type: "json_object" },
                    temperature: 0.1
                });
            }
        })();

        responseTimeMs = Date.now() - startTime;
        modelUsed = chatCompletion.model;
        inputTokens = chatCompletion.usage?.prompt_tokens || 0;
        outputTokens = chatCompletion.usage?.completion_tokens || 0;
        totalTokens = chatCompletion.usage?.total_tokens || 0;

        console.log('OpenAI API call successful.');
        console.log('Model:', modelUsed);
        console.log('Tokens:', { input: inputTokens, output: outputTokens, total: totalTokens });
        console.log('Response time:', responseTimeMs, 'ms');
        if (currentSegment) {
            currentSegment.addAnnotation('modelUsed', modelUsed);
            currentSegment.addAnnotation('totalTokens', totalTokens);
            currentSegment.addAnnotation('responseTimeMs', responseTimeMs);
        }

        const extractedDataString = chatCompletion.choices[0].message.content;
        let extractedData = {};
        if (extractedDataString) {
            try {
                extractedData = JSON.parse(extractedDataString);
                extractionSuccess = true;
                if (currentSegment) currentSegment.addAnnotation('jsonParseSuccess', true);
            } catch (parseError) {
                console.error('Error parsing extracted data JSON:', parseError);
                errorMessage = `Failed to parse AI response: ${parseError.message}`;
                extractionSuccess = false;
                if (currentSegment) currentSegment.addError(parseError, true);
                if (currentSegment) currentSegment.addAnnotation('jsonParseSuccess', false);
            }
        } else {
            errorMessage = "AI returned no content.";
            extractionSuccess = false;
            if (currentSegment) currentSegment.addAnnotation('noAiContent', true);
        }

        // NEW STEP: Invoke the update-ghl-contact Lambda function
        if (extractionSuccess && Object.keys(extractedData).length > 0) {
            console.log('Invoking update-ghl-contact Lambda...');
            const updateContactLambdaName = process.env.UPDATE_GHL_CONTACT_LAMBDA_NAME; // Lambda function name/ARN from env var

            if (!updateContactLambdaName) {
                console.warn("UPDATE_GHL_CONTACT_LAMBDA_NAME environment variable not set. Skipping GHL contact update invocation.");
                errorMessage = "GHL update Lambda name not configured.";
                extractionSuccess = false; // Mark overall process as failed if GHL update is critical
            } else {
                try {
                    const invokePayload = {
                        ghl_contact_id: contact_id,
                        location_id: location_id,
                        conversation_id: conversation_id,
                        extracted_data: extractedData
                    };

                    const invokeCommand = new InvokeCommand({
                        FunctionName: updateContactLambdaName,
                        InvocationType: 'RequestResponse', // Synchronous invocation
                        Payload: JSON.stringify(invokePayload),
                    });

                    const invokeResult = await (async () => {
                        if (AWSXRay && AWSXRay.captureAsyncFunc) {
                            return AWSXRay.captureAsyncFunc('LambdaInvoke - update-ghl-contact-lambda', async (subsegment) => {
                                if (subsegment) subsegment.addAnnotation('invokedLambda', updateContactLambdaName);
                                if (subsegment) subsegment.addMetadata('invokePayload', invokePayload);
                                const result = await lambdaClient.send(invokeCommand);
                                if (subsegment) subsegment.addAnnotation('invokeStatusCode', result.StatusCode);
                                return result;
                            }, currentSegment);
                        } else {
                            return await lambdaClient.send(invokeCommand);
                        }
                    })();

                    if (invokeResult.Payload) {
                        ghlUpdateResult = JSON.parse(Buffer.from(invokeResult.Payload).toString());
                        if (!ghlUpdateResult.success) {
                            console.error('Error response from update-ghl-contact-lambda:', ghlUpdateResult.error);
                            errorMessage = `GHL update Lambda failed: ${ghlUpdateResult.error}`;
                            extractionSuccess = false; // Mark overall process as failed
                            if (currentSegment) currentSegment.addError(new Error(errorMessage));
                        } else {
                            console.log('Successfully invoked update-ghl-contact-lambda.');
                            if (currentSegment) currentSegment.addAnnotation('ghlUpdateLambdaSuccess', true);
                            if (currentSegment) currentSegment.addMetadata('ghlUpdateSummary', {
                                updated_fields: ghlUpdateResult.updated_fields,
                                skipped_fields: ghlUpdateResult.skipped_fields
                            });
                        }
                    } else {
                        console.warn('No payload received from update-ghl-contact-lambda.');
                        errorMessage = "No response payload from GHL update Lambda.";
                        extractionSuccess = false;
                        if (currentSegment) currentSegment.addAnnotation('ghlUpdateLambdaNoPayload', true);
                    }
                } catch (invokeError) {
                    console.error('Failed to invoke update-ghl-contact-lambda:', invokeError);
                    errorMessage = `Failed to invoke GHL update Lambda: ${invokeError.message}`;
                    extractionSuccess = false;
                    if (currentSegment) currentSegment.addError(invokeError);
                }
            }
        } else if (extractionSuccess && Object.keys(extractedData).length === 0) {
            console.log('No data extracted by AI, skipping GHL update.');
            errorMessage = "AI extracted no data.";
            // extractionSuccess remains true if no data was extracted but the AI call itself was successful
            if (currentSegment) currentSegment.addAnnotation('noDataExtractedByAi', true);
        }

        // NEW STEP: Create GHL Wallet charge if this is an overage
        if (isOverage && extractionSuccess) {
            console.log('Creating GHL Wallet charge for overage...');
            try {
                const chargePayload = {
                    appId: process.env.GHL_APP_ID, // Ensure this environment variable is set
                    meterId: meterId,
                    eventId: usageLogId, // Link to usage log record
                    userId: billing_user_id || contact_id, // Use billing user ID or fallback to contact
                    locationId: location_id, // Where the usage occurred
                    companyId: billing_company_id || billing_entity_id, // Entity being billed
                    description: `AI Message Overage - ${totalTokens} tokens`,
                    units: unitsToCharge,
                    eventTime: new Date().toISOString()
                };
                
                console.log('Charge payload:', {
                    appId: chargePayload.appId,
                    meterId: chargePayload.meterId,
                    units: chargePayload.units,
                    companyId: chargePayload.companyId,
                    description: chargePayload.description
                });
                
                const chargeResponse = await ghlWalletService.createCharge(currentBillingAccessToken, chargePayload);
                ghlChargeId = chargeResponse.chargeId;
                
                console.log('✅ GHL Wallet charge created successfully. Charge ID:', ghlChargeId);
                
                // Calculate actual customer cost based on meter ID
                if (meterId === 'message_overage_agency_account') {
                    customerCostEstimate = unitsToCharge * 0.002; // $0.002 per message for agencies
                } else if (meterId === 'message_overage_direct_account') {
                    customerCostEstimate = unitsToCharge * 0.005; // $0.005 per message for direct accounts
                }
                
                if (currentSegment) {
                    currentSegment.addAnnotation('ghlChargeCreated', true);
                    currentSegment.addAnnotation('ghlChargeId', ghlChargeId);
                    currentSegment.addAnnotation('customerCostEstimate', customerCostEstimate);
                }
                
            } catch (chargeError) {
                console.error('Failed to create GHL Wallet charge:', chargeError);
                errorMessage = `AI extraction successful but failed to charge GHL Wallet: ${chargeError.message}`;
                extractionSuccess = false; // Mark extraction as failed if billing fails
                
                if (currentSegment) {
                    currentSegment.addError(chargeError);
                    currentSegment.addAnnotation('ghlChargeFailed', true);
                }
            }
        } else if (isOverage && !extractionSuccess) {
            console.log('Extraction failed, skipping GHL Wallet charge');
        } else {
            console.log('Within free tier, no GHL Wallet charge required');
            customerCostEstimate = 0; // No charge for free tier usage
        }

        // Final update to usage log
        await updateUsageLog(supabaseClient, usageLogId, {
            model: modelUsed,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens,
            cost_estimate: costEstimate,
            platform_cost_estimate: platformCostEstimate,
            customer_cost_estimate: customerCostEstimate,
            customer_cost_calculated: true,
            ghl_charge_id: ghlChargeId,
            success: extractionSuccess,
            error_message: errorMessage,
            response_time_ms: responseTimeMs,
            openai_key_used: openaiKeyUsed
        }, currentSegment);

        // Return structured Lambda response
        return {
            statusCode: extractionSuccess ? 200 : 400,
            body: JSON.stringify({
                success: extractionSuccess,
                extracted_data: extractedData,
                usage: {
                    model: modelUsed,
                    input_tokens: inputTokens,
                    output_tokens: outputTokens,
                    total_tokens: totalTokens,
                    cost_estimate: costEstimate,
                    response_time_ms: responseTimeMs
                },
                usage_log_id: usageLogId,
                error: errorMessage,
                billing: {
                    is_overage: isOverage,
                    meter_id: meterId,
                    units_charged: unitsToCharge,
                    ghl_charge_id: ghlChargeId,
                    customer_cost_estimate: customerCostEstimate,
                    billing_entity_id: billing_entity_id
                },
                ghl_update_result: ghlUpdateResult // NEW: Include the GHL update result
            }),
        };

    } catch (error) {
        console.error("=== OPENAI EXTRACTION LAMBDA ERROR ===");
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);
        errorMessage = error.message;

        if (currentSegment) {
            currentSegment.addError(error);
            currentSegment.addAnnotation('errorName', error.name);
            currentSegment.addAnnotation('errorMessage', error.message);
        }

        // Attempt to update usage log with error, if log was created
        if (usageLogId && supabaseClient) {
            await updateUsageLog(supabaseClient, usageLogId, {
                model: modelUsed || 'unknown',
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                total_tokens: totalTokens,
                cost_estimate: costEstimate,
                platform_cost_estimate: platformCostEstimate,
                customer_cost_estimate: customerCostEstimate,
                customer_cost_calculated: true,
                ghl_charge_id: ghlChargeId,
                success: false,
                error_message: errorMessage,
                response_time_ms: responseTimeMs,
                openai_key_used: openaiKeyUsed
            }, currentSegment);
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: `OpenAI extraction failed: ${error.message}`,
                details: error.toString(),
                stack: error.stack,
            }),
        };
    }
};