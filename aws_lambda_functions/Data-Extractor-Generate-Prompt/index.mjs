// index.mjs (for ai-prompt-generator-lambda)

import {
  getGHLConfiguration,
  getExtractionFields,
  getContextualRules,
  getStopTriggers,
  getSupabaseClient // <-- Ensure getSupabaseClient is exported
} from './supabaseClient.mjs'; // Updated import if getSupabaseClient isn't directly exposed by default
import {
  generatePromptWithSeparatedFields,
  isStandardField,
  separateFieldTypes,
  getProperFieldKey
} from './promptGenerator.mjs';
// import { corsHeaders } from './utils.mjs'; // --- REMOVED: Not needed for direct Lambda invocation

// --- AWS X-Ray Integration ---
let AWSXRay;
try {
  const xrayModule = await import('aws-xray-sdk-core');
  AWSXRay = xrayModule.default || xrayModule;
} catch (e) {
  console.warn("AWS X-Ray SDK not loaded. Tracing will be disabled.", e);
  AWSXRay = null;
}

// --- Lambda Handler ---
export const handler = async (event) => {
  const segment = AWSXRay && AWSXRay.getSegment();

  if (segment) {
    segment.addAnnotation('handler', 'ai-prompt-generator');
    // We remove event.httpMethod as it's no longer relevant for direct invocations
  }

  // --- REMOVED: Load secrets from secrets.mjs, as getSupabaseClient and other modules will handle this
  // The secrets.mjs module handles caching internally, so no need to explicitly call loadSecrets here.
  // The secrets will be fetched when getSupabaseSecrets or getOpenAISecrets is first called.

  // --- REMOVED: HTTP OPTIONS/POST method checks and CORS headers ---
  // These are not applicable for direct Lambda-to-Lambda invocation.
  // The 'event' is directly the JSON payload from the orchestrator.

  try {
    console.log('=== AI PROMPT GENERATION REQUEST ===');
    console.log('Received payload:', JSON.stringify(event));

    // The 'event' object itself is the payload from the orchestrator.
    // No JSON.parse(event.body) needed.
    const {
        locationId,
        ghlConfig: ghlConfigFromPayload,
        extractionFields: extractionFieldsFromPayload,
        contextualRules: contextualRulesFromPayload,
        stopTriggers: stopTriggersFromPayload
    } = event; // 'event' is directly the payload

    if (!locationId) {
      console.error('No locationId found in payload:', event);
      if (segment) segment.addAnnotation('validationError', 'missingLocationId');
      // Return a standard JSON object, not an API Gateway proxy response
      return {
        success: false,
        error: "locationId is required in the payload.",
        receivedPayload: event
      };
    }

    if (segment) {
        segment.addAnnotation('locationId', locationId);
    }

    console.log('Generating extraction prompt for location:', locationId);

    // Use the data passed directly from the orchestrator if available
    let ghlConfig = ghlConfigFromPayload;
    let extractionFields = extractionFieldsFromPayload;
    let contextualRules = contextualRulesFromPayload;
    let stopTriggers = stopTriggersFromPayload;

    // --- Conditional Fetching (if not provided by orchestrator, fetch from Supabase) ---
    // Initialize Supabase client if needed (e.g., if data is not passed via event)
    // IMPORTANT: The orchestrator *should* be passing ghlConfig, extractionFields, etc.
    // If not, this fallback will fetch from Supabase.
    let supabase;
    if (!ghlConfig || !extractionFields || !contextualRules || !stopTriggers) {
        supabase = await getSupabaseClient(); // Await the async getSupabaseClient
    }

    // Step 1: Fetching GHL configuration...
    if (!ghlConfig) {
      console.log('Step 1: GHL config not in payload, fetching from Supabase...');
      if (segment && AWSXRay.captureAsyncFunc) {
          ghlConfig = await AWSXRay.captureAsyncFunc('GetGHLConfiguration', async (subsegment) => {
              subsegment.addAnnotation('locationId', locationId);
              // Pass supabase client to getGHLConfiguration as it requires it
              const config = await getGHLConfiguration(supabase, locationId);
              if (!config) subsegment.addAnnotation('status', 'not_found');
              return config;
          }, segment);
      } else {
          ghlConfig = await getGHLConfiguration(supabase, locationId);
      }
    } else {
        console.log('Step 1: Using GHL config from payload.');
    }

    if (!ghlConfig) {
      if (segment) segment.addAnnotation('configStatus', 'not_found');
      // Return a standard JSON object
      return {
        success: false,
        error: "No configuration found for this location",
        locationId,
        message: "Please ensure the app is properly installed and configured for this location"
      };
    }
    if (segment) segment.addAnnotation('configId', ghlConfig.id);

    // Step 2: Fetching extraction fields...
    if (!extractionFields) {
      console.log('Step 2: Extraction fields not in payload, fetching from Supabase...');
      if (segment && AWSXRay.captureAsyncFunc) {
          extractionFields = await AWSXRay.captureAsyncFunc('GetExtractionFields', async (subsegment) => {
              subsegment.addAnnotation('configId', ghlConfig.id);
              // Pass supabase client to getExtractionFields as it requires it
              const fields = await getExtractionFields(supabase, ghlConfig.id);
              subsegment.addAnnotation('count', fields.length);
              return fields;
          }, segment);
      } else {
          extractionFields = await getExtractionFields(supabase, ghlConfig.id);
      }
    } else {
        console.log('Step 2: Using extraction fields from payload.');
    }
    console.log(`Found ${extractionFields.length} extraction fields`);


    // Step 3: Fetching contextual rules...
    if (!contextualRules) {
      console.log('Step 3: Contextual rules not in payload, fetching from Supabase...');
      if (segment && AWSXRay.captureAsyncFunc) {
          contextualRules = await AWSXRay.captureAsyncFunc('GetContextualRules', async (subsegment) => {
              subsegment.addAnnotation('configId', ghlConfig.id);
              // Pass supabase client to getContextualRules as it requires it
              const rules = await getContextualRules(supabase, ghlConfig.id);
              subsegment.addAnnotation('count', rules.length);
              return rules;
          }, segment);
      } else {
          contextualRules = await getContextualRules(supabase, ghlConfig.id);
      }
    } else {
        console.log('Step 3: Using contextual rules from payload.');
    }
    console.log(`Found ${contextualRules.length} contextual rules`);

    // Step 4: Fetching stop triggers...
    if (!stopTriggers) {
      console.log('Step 4: Stop triggers not in payload, fetching from Supabase...');
      if (segment && AWSXRay.captureAsyncFunc) {
          stopTriggers = await AWSXRay.captureAsyncFunc('GetStopTriggers', async (subsegment) => {
              subsegment.addAnnotation('configId', ghlConfig.id);
              // Pass supabase client to getStopTriggers as it requires it
              const triggers = await getStopTriggers(supabase, ghlConfig.id);
              subsegment.addAnnotation('count', triggers.length);
              return triggers;
          }, segment);
      } else {
          stopTriggers = await getStopTriggers(supabase, ghlConfig.id);
      }
    } else {
        console.log('Step 4: Using stop triggers from payload.');
    }
    console.log(`Found ${stopTriggers.length} stop triggers`);

    // Step 5: Generating prompt with separated field types...
    console.log('Step 5: Generating prompt with separated field types...');
    let prompt;
    if (segment && AWSXRay.captureAsyncFunc) {
        prompt = await AWSXRay.captureAsyncFunc('GeneratePromptString', async (subsegment) => {
            const generatedPrompt = generatePromptWithSeparatedFields({
                ghlConfig,
                extractionFields,
                contextualRules,
                stopTriggers,
                locationId
            });
            subsegment.addAnnotation('promptLength', generatedPrompt.length);
            return generatedPrompt;
        }, segment);
    } else {
        prompt = generatePromptWithSeparatedFields({
            ghlConfig,
            extractionFields,
            contextualRules,
            stopTriggers,
            locationId
        });
    }

    console.log('✅ AI prompt generated successfully');
    console.log('Prompt length:', prompt.length, 'characters');
    console.log('Summary:');
    console.log('- Business:', ghlConfig.business_name);
    console.log('- Extraction fields:', extractionFields.length);
    console.log('- Contextual rules:', contextualRules.length);
    console.log('- Stop triggers:', stopTriggers.length);

    // Separate fields for logging
    const { standardFields, customFields } = separateFieldTypes(extractionFields);
    console.log(`- Standard fields: ${standardFields.length}`);
    console.log(`- Custom fields: ${customFields.length}`);

    // Add summary annotations to the main segment
    if (segment) {
        segment.addAnnotation('extractionFieldsCount', extractionFields.length);
        segment.addAnnotation('standardFieldsCount', standardFields.length);
        segment.addAnnotation('customFieldsCount', customFields.length);
        segment.addAnnotation('contextualRulesCount', contextualRules.length);
        segment.addAnnotation('stopTriggersCount', stopTriggers.length);
        segment.addAnnotation('finalPromptLength', prompt.length);
    }

    if (extractionFields.length > 0) {
      console.log('Extraction fields details:');
      extractionFields.forEach((field, index)=>{
        const fieldKey = getProperFieldKey(field);
        const fieldType = isStandardField(field) ? 'STANDARD' : 'CUSTOM';
        console.log(`  ${index + 1}. [${fieldType}] ${field.field_name} (${field.field_type}) -> ${fieldKey} [GHL ID: ${field.target_ghl_key}] [Policy: ${field.overwrite_policy || 'always'}]`);
      });
    }

    // Return a plain JSON object as expected by invokeDownstreamLambda
    return {
      success: true,
      locationId,
      prompt,
      metadata: {
        businessName: ghlConfig.business_name,
        businessDescription: ghlConfig.business_description,
        businessContext: ghlConfig.business_context,
        servicesOffered: ghlConfig.services_offered,
        configId: ghlConfig.id,
        extractionFieldsCount: extractionFields.length,
        standardFieldsCount: standardFields.length,
        customFieldsCount: customFields.length,
        contextualRulesCount: contextualRules.length,
        stopTriggersCount: stopTriggers.length,
        promptLength: prompt.length,
        generatedAt: new Date().toISOString(),
        fields: extractionFields.map((f)=>({
            id: f.id,
            name: f.field_name,
            type: f.field_type,
            ghlKey: f.target_ghl_key,
            fieldKey: getProperFieldKey(f),
            required: f.is_required,
            isStandard: isStandardField(f),
            overwritePolicy: f.overwrite_policy || 'always',
            description: f.description,
            picklistOptions: f.picklist_options
          }))
      }
    };

  } catch (error) {
    console.error("=== PROMPT GENERATION ERROR ===");
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    if (segment) segment.addError(error);
    // Return a plain JSON object for errors
    return {
      success: false,
      error: `Prompt generation failed: ${error.message}`,
      details: error.toString(),
      stack: error.stack
    };
  }
};