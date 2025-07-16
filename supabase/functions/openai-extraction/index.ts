import { createClient } from 'npm:@supabase/supabase-js@2';
import OpenAI from 'npm:openai';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method not allowed. Use POST."
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }

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
  const startTime = Date.now();

  try {
    console.log('=== OPENAI EXTRACTION REQUEST ===');
    const requestBody = await req.json();
    const { conversation_id, location_id, agency_ghl_id, contact_id, business_context, fields_to_extract, conversation_history, system_prompt, instructions, response_format } = requestBody;

    if (!conversation_id || !location_id || !fields_to_extract || !conversation_history || !system_prompt) {
      throw new Error("Missing required fields in request body.");
    }

    console.log('Extraction request for conversation:', conversation_id);
    console.log('Location ID:', location_id);
    console.log('Contact ID:', contact_id);
    console.log('Agency GHL ID:', agency_ghl_id);
    console.log('Fields to extract count:', fields_to_extract.length);
    console.log('Conversation history messages count:', conversation_history.length);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Determine OpenAI API key to use
    let openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    let openaiOrgId = Deno.env.get('OPENAI_ORG_ID');
    let openaiModel = 'gpt-4o-mini'; // Default model
    let useAgencyKey = false;

    if (agency_ghl_id) {
      console.log('Checking for agency-specific OpenAI key...');
      const { data: agencyKeyData, error: agencyKeyError } = await supabaseClient
        .from('agency_openai_keys')
        .select('encrypted_openai_api_key, openai_org_id, openai_model')
        .eq('agency_ghl_id', agency_ghl_id)
        .eq('is_active', true)
        .maybeSingle();

      if (agencyKeyError) {
        console.warn('Error fetching agency OpenAI key:', agencyKeyError.message);
      } else if (agencyKeyData && agencyKeyData.encrypted_openai_api_key) {
        console.log('Using agency-specific OpenAI key.');
        openaiApiKey = await decryptApiKey(agencyKeyData.encrypted_openai_api_key);
        openaiOrgId = agencyKeyData.openai_org_id;
        openaiModel = agencyKeyData.openai_model || openaiModel;
        console.log(`Using agency-selected model: ${openaiModel}`);
        useAgencyKey = true;
        openaiKeyUsed = agencyKeyData.encrypted_openai_api_key.substring(0, 10) + '...'; // Log a snippet
      } else {
        console.log('No active agency-specific OpenAI key found, falling back to default.');
      }
    }

    if (!openaiApiKey) {
      throw new Error("OpenAI API key is not configured.");
    }

    openai = new OpenAI({
      apiKey: openaiApiKey,
      organization: openaiOrgId || undefined
    });

    // Construct messages for OpenAI API
    const messages = [
      {
        role: "system",
        content: system_prompt
      },
      ...conversation_history.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // Log initial usage record
    const { data: logData, error: logError } = await supabaseClient
      .from('ai_usage_logs')
      .insert({
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
        extraction_type: 'data_extraction',
        model_used: openaiModel // Store the model we're actually using
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Error creating usage log:', logError);
      throw new Error(`Failed to create usage log: ${logError.message}`);
    }

    usageLogId = logData.id;
    console.log('Usage log created with ID:', usageLogId);

    // Call OpenAI API
    console.log(`Calling OpenAI Chat Completions API with model: ${openaiModel}...`);
    const chatCompletion = await openai.chat.completions.create({
      model: openaiModel,
      messages: messages,
      response_format: {
        type: "json_object"
      },
      temperature: 0.1
    });

    responseTimeMs = Date.now() - startTime;
    modelUsed = chatCompletion.model;
    inputTokens = chatCompletion.usage?.prompt_tokens || 0;
    outputTokens = chatCompletion.usage?.completion_tokens || 0;
    totalTokens = chatCompletion.usage?.total_tokens || 0;

    console.log('OpenAI API call successful.');
    console.log('Model:', modelUsed);
    console.log('Tokens:', {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens
    });
    console.log('Response time:', responseTimeMs, 'ms');

    // Calculate cost estimate based on model and token usage
    try {
      const { data: pricingData, error: pricingError } = await supabaseClient
        .from('openai_model_pricing')
        .select('input_price_per_million, output_price_per_million')
        .eq('model_id', modelUsed)
        .maybeSingle();

      if (pricingError) {
        console.warn('Error fetching model pricing:', pricingError.message);
        // Use default pricing if we can't get specific pricing
        costEstimate = (inputTokens / 1000000 * 0.5) + (outputTokens / 1000000 * 1.5);
      } else if (pricingData) {
        // Calculate cost using the pricing data
        const inputCost = (inputTokens / 1000000) * pricingData.input_price_per_million;
        const outputCost = (outputTokens / 1000000) * pricingData.output_price_per_million;
        costEstimate = inputCost + outputCost;
        console.log('Cost calculation:', {
          model: modelUsed,
          inputPrice: pricingData.input_price_per_million,
          outputPrice: pricingData.output_price_per_million,
          inputCost,
          outputCost,
          totalCost: costEstimate
        });
      } else {
        console.warn('No pricing data found for model:', modelUsed);
        // Use fallback pricing based on model family
        if (modelUsed.includes('gpt-4o-mini')) {
          costEstimate = (inputTokens / 1000000 * 0.15) + (outputTokens / 1000000 * 0.60);
        } else if (modelUsed.includes('gpt-4o')) {
          costEstimate = (inputTokens / 1000000 * 2.50) + (outputTokens / 1000000 * 10.00);
        } else if (modelUsed.includes('gpt-4.1-mini')) {
          costEstimate = (inputTokens / 1000000 * 0.40) + (outputTokens / 1000000 * 1.60);
        } else if (modelUsed.includes('gpt-4.1')) {
          costEstimate = (inputTokens / 1000000 * 2.00) + (outputTokens / 1000000 * 8.00);
        } else {
          // Default fallback pricing
          costEstimate = (inputTokens / 1000000 * 1.00) + (outputTokens / 1000000 * 3.00);
        }
      }
    } catch (costError) {
      console.error('Error calculating cost:', costError);
      // Simple fallback calculation
      costEstimate = (totalTokens / 1000) * 0.002; // $0.002 per 1K tokens as a fallback
    }

    // Set platform and customer cost estimates
    platformCostEstimate = costEstimate;
    customerCostEstimate = useAgencyKey ? 0 : costEstimate * 1.5; // 50% markup for platform users

    console.log('Cost estimates:', {
      costEstimate,
      platformCostEstimate,
      customerCostEstimate,
      useAgencyKey
    });

    const extractedDataString = chatCompletion.choices[0].message.content;
    let extractedData = {};

    if (extractedDataString) {
      try {
        extractedData = JSON.parse(extractedDataString);
        extractionSuccess = true;
      } catch (parseError) {
        console.error('Error parsing extracted data JSON:', parseError);
        errorMessage = `Failed to parse AI response: ${parseError.message}`;
        extractionSuccess = false;
      }
    } else {
      errorMessage = "AI returned no content.";
      extractionSuccess = false;
    }

    // Update GHL contact with extracted data
    if (extractionSuccess && Object.keys(extractedData).length > 0) {
      console.log('Updating GHL contact with extracted data...');
      const updateContactResponse = await fetch(`${supabaseUrl}/functions/v1/update-ghl-contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          ghl_contact_id: contact_id,
          location_id: location_id,
          conversation_id: conversation_id,
          extracted_data: extractedData
        })
      });

      if (!updateContactResponse.ok) {
        const errorText = await updateContactResponse.text();
        console.error('Error updating GHL contact:', errorText);
        errorMessage = `Failed to update GHL contact: ${updateContactResponse.status} - ${errorText}`;
        extractionSuccess = false;
      } else {
        console.log('GHL contact updated successfully.');
      }
    } else if (extractionSuccess && Object.keys(extractedData).length === 0) {
      console.log('No data extracted by AI.');
      errorMessage = "AI extracted no data.";
    }

    // Final update to usage log
    await updateUsageLog(supabaseClient, usageLogId, {
      model: modelUsed,
      model_used: openaiModel, // Store the model we requested (may differ from what OpenAI returned)
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cost_estimate: costEstimate,
      platform_cost_estimate: platformCostEstimate,
      customer_cost_estimate: customerCostEstimate,
      success: extractionSuccess,
      error_message: errorMessage,
      response_time_ms: responseTimeMs,
      openai_key_used: openaiKeyUsed
    });

    return new Response(JSON.stringify({
      success: extractionSuccess,
      extracted_data: extractedData,
      usage: {
        model: modelUsed,
        requested_model: openaiModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_estimate: costEstimate,
        response_time_ms: responseTimeMs
      },
      usage_log_id: usageLogId,
      error: errorMessage
    }), {
      status: extractionSuccess ? 200 : 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error("=== OPENAI EXTRACTION ERROR ===");
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    errorMessage = error.message;

    // Attempt to update usage log with error, if log was created
    if (usageLogId && supabaseClient) {
      await updateUsageLog(supabaseClient, usageLogId, {
        model: modelUsed || 'unknown',
        model_used: openaiModel || 'unknown', // Store the model we attempted to use
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_estimate: costEstimate,
        platform_cost_estimate: platformCostEstimate,
        customer_cost_estimate: customerCostEstimate,
        success: false,
        error_message: errorMessage,
        response_time_ms: responseTimeMs,
        openai_key_used: openaiKeyUsed
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: `OpenAI extraction failed: ${error.message}`,
      details: error.toString(),
      stack: error.stack
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});

// Helper function to decrypt API key (placeholder for actual decryption logic)
async function decryptApiKey(encryptedKey) {
  // This is a placeholder. In a real application, you would use a secure key management system.
  // For now, assuming it's base64 encoded for simplicity.
  try {
    return atob(encryptedKey);
  } catch (e) {
    console.error('Failed to base64 decode API key:', e);
    return encryptedKey; // Return as is if not base64
  }
}

async function updateUsageLog(supabase, logId, updates) {
  const { error } = await supabase.from('ai_usage_logs').update(updates).eq('id', logId);
  if (error) {
    console.error('Failed to update usage log:', error);
  } else {
    console.log('Usage log updated successfully.');
  }
}