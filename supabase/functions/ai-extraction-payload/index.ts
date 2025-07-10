import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
Deno.serve(async (req)=>{
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
  try {
    console.log('=== AI EXTRACTION PAYLOAD REQUEST ===');
    const requestBody = await req.json();
    const conversationId = requestBody.conversation_id || requestBody.conversationId;
    const autoExtract = requestBody.auto_extract !== false // Default to true unless explicitly set to false
    ;
    if (!conversationId) {
      console.error('No conversation_id provided in request');
      return new Response(JSON.stringify({
        error: "conversation_id is required",
        example: {
          conversation_id: "abc123"
        }
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log('Building AI extraction payload for conversation:', conversationId);
    console.log('Auto-extract enabled:', autoExtract);
    // Initialize Supabase client (not strictly needed here as we're calling functions, but good for consistency)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Step 1: Get conversation history
    console.log('Step 1: Fetching conversation history...');
    const conversationResponse = await fetch(`${supabaseUrl}/functions/v1/get-conversation-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        conversation_id: conversationId
      })
    });
    if (!conversationResponse.ok) {
      const errorText = await conversationResponse.text();
      throw new Error(`Failed to get conversation history: ${conversationResponse.status} - ${errorText}`);
    }
    const conversationData = await conversationResponse.json();
    console.log(`✅ Got conversation history with ${conversationData.messages.length} messages`);

    if (!conversationData.location_id) {
      throw new Error('No location_id found in conversation data');
    }

    // Step 2: Get extraction prompt
    console.log('Step 2: Generating extraction prompt...');
    const promptResponse = await fetch(`${supabaseUrl}/functions/v1/generate-extraction-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        locationId: conversationData.location_id
      })
    });
    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      throw new Error(`Failed to generate extraction prompt: ${promptResponse.status} - ${errorText}`);
    }
    const promptData = await promptResponse.json();
    console.log(`✅ Generated extraction prompt for ${promptData.metadata.extractionFieldsCount} fields`);

    // Log the full prompt
    console.log('=== FULL EXTRACTION PROMPT (FROM GENERATION SERVICE) ===');
    console.log(promptData.prompt);
    console.log('=== END FULL EXTRACTION PROMPT ===');

    // Step 3: Build the structured payload
    console.log('Step 3: Building structured payload...');

    // Extract business context from prompt metadata (now properly populated)
    const businessContext = {
      name: promptData.metadata.businessName || `Location ${conversationData.location_id}`,
      description: promptData.metadata.businessDescription || "A GoHighLevel location",
      context: promptData.metadata.businessContext,
      services: promptData.metadata.servicesOffered,
    };

    // Extract conversation metadata (including contact_id)
    const conversationMetadata = {
      total_messages: conversationData.total_messages,
      location_id: conversationData.location_id,
      contact_id: conversationData.contact_id,
    };
    // Include optional message if present
    if (conversationData.message) {
      conversationMetadata.message = conversationData.message;
    }

    // Convert fields from prompt metadata to extraction format
    // We now mostly just pass the field definition, as the main prompt handles the instructions
    const fieldsToExtract = promptData.metadata.fields.map((field)=>{
      // Determine if this is a custom field (no dot in the target_ghl_key or not starting with contact.)
      const isCustomField = !field.ghlKey.includes('.') || !field.ghlKey.startsWith('contact.');
      
      return {
        id: field.id, // Keep the original ID for traceability
        name: field.name,
        ghl_key: field.fieldKey, // Use fieldKey as that's what the AI should output
        is_custom_field: isCustomField, // Flag to indicate if this is a custom field
        type: field.type,
        description: field.description, // Pass the field's description
        required: field.required,
        picklistOptions: field.picklistOptions, // Pass picklist options for AI to use
      };
    });

    // The primary instructions for the LLM are now the full prompt generated by the other function.
    const systemPromptForLLM = promptData.prompt;

    // Build the final payload
    const payload = {
      conversation_id: conversationId,
      location_id: conversationData.location_id,
      contact_id: conversationData.contact_id,
      business_context: businessContext || { name: "Business" },
      fields_to_extract: fieldsToExtract, // Simplified, but rich with metadata
      conversation_history: conversationData.messages,
      conversation_metadata: conversationMetadata,
      metadata: promptData.metadata, // Keep the full metadata from prompt generation
      system_prompt: systemPromptForLLM, // This is the crucial change: pass the full prompt
      response_format: { // Still useful to pass these as separate instructions to LLM if needed
        type: "json",
        rules: [
          "Key names must match exactly the `ghl_key` values defined in the system prompt.",
          "Only include fields that have values. Do not include empty fields.",
          "Ensure date fields use YYYY-MM-DD format.",
          "Ensure phone and email fields are valid formats."
        ]
      }
    };

    console.log('✅ AI extraction payload built successfully');
    console.log(`- Conversation ID: ${payload.conversation_id || 'Not available'}`);
    console.log(`- Location ID: ${payload.location_id}`);
    console.log(`- Contact ID: ${payload.contact_id || 'Not available'}`);
    console.log(`- Business: ${payload.business_context.name}`);
    console.log(`- Fields to extract count: ${payload.fields_to_extract.length}`);
    console.log(`- Conversation messages count: ${payload.conversation_history.length}`);
    console.log(`- System prompt length: ${payload.system_prompt.length} characters`);

    // Log field types for debugging
    // Step 4: Auto-invoke OpenAI extraction if enabled
    if (autoExtract) {
      console.log('Step 4: Auto-invoking OpenAI extraction...');
      
      // Log the full payload being sent to OpenAI extraction
      console.log('=== FULL PAYLOAD SENT TO OPENAI EXTRACTION ===');
      console.log(JSON.stringify({
        conversation_id: payload.conversation_id || 'Not available',
        location_id: payload.location_id,
        contact_id: payload.contact_id,
        business_context: payload.business_context,
        fields_to_extract: payload.fields_to_extract.length,
        conversation_history: payload.conversation_history.length,
        system_prompt_length: payload.system_prompt.length
      }, null, 2));
      
      // Log field types for better debugging
      console.log('Field types:');
      payload.fields_to_extract.forEach(field => {
        console.log(`- ${field.name} (${field.ghl_key}): ${field.is_custom_field ? 'CUSTOM' : 'STANDARD'}`);
      });
      
      // Log the first few messages of conversation history
      console.log('First few messages:', payload.conversation_history.slice(0, 2));
      console.log('=== END FULL PAYLOAD SENT TO OPENAI EXTRACTION ===');
      
      try {
        // The system prompt to be sent to OpenAI is now directly from promptData.prompt
        console.log('=== SYSTEM PROMPT SENT TO OPENAI ===');
        console.log(payload.system_prompt);
        console.log('=== END SYSTEM PROMPT SENT TO OPENAI ===');
        console.log('Calling OpenAI extraction function...');

        const extractionResponse = await fetch(`${supabaseUrl}/functions/v1/openai-extraction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify(payload) // Send the full payload
        });
        console.log('OpenAI extraction response status:', extractionResponse.status);

        if (!extractionResponse.ok) {
          const errorText = await extractionResponse.text();
          console.error('OpenAI extraction failed:', errorText);
          // Return payload with extraction error info, keeping status 200 for internal errors
          return new Response(JSON.stringify({
            success: false,
            payload: payload,
            extraction_error: {
              status: extractionResponse.status,
              message: errorText
            },
            message: "Payload built successfully but OpenAI extraction failed"
          }), {
            status: 200, // Still 200 as requested for this type of error handling
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }

        const extractionResult = await extractionResponse.json();
        console.log('✅ OpenAI extraction completed successfully with model:', extractionResult.usage?.model);
        console.log('Extracted fields:', Object.keys(extractionResult.extracted_data || {}));
        console.log('Usage cost:', `$${extractionResult.usage?.cost_estimate || 0}`);

        // Return combined result with both payload and extraction
        return new Response(JSON.stringify({
          success: true,
          payload: payload,
          extraction_result: extractionResult || {},
          message: "Payload built and extraction completed successfully"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });

      } catch (extractionError) {
        console.error('Error during auto-extraction:', extractionError.message, extractionError.stack);
        // Return payload with extraction error
        return new Response(JSON.stringify({
          success: false,
          payload: payload,
          extraction_error: {
            message: extractionError.message,
            details: extractionError.toString()
          }, 
          timestamp: new Date().toISOString(),
          message: "Payload built successfully but auto-extraction failed"
        }), {
          status: 200, // Still 200 as requested for this type of error handling
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
    } else {
      // Return just the payload if auto-extract is disabled
      console.log('Auto-extract disabled, returning payload only');
      return new Response(JSON.stringify({
        success: true,
        payload: payload,
        message: "Payload built successfully (auto-extract disabled)",
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
  } catch (error: any) {
    console.error("=== AI EXTRACTION PAYLOAD ERROR ===");
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    return new Response(JSON.stringify({
      error: `Failed to build AI extraction payload: ${error.message}`,
      details: error.toString()
    }), {
      status: 500, 
      timestamp: new Date().toISOString(),
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});