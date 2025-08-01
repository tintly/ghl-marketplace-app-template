// Path: index.mjs (for update-ghl-contact Lambda)

// Removed: import { createResponse } from './response.mjs'; // Not needed for direct invocation
import { getSupabaseClient } from './supabaseClient.mjs';
import {
  getGHLConfiguration,
  getExtractionFields,
  getGHLContact,
  updateGHLContact
} from './ghlService.mjs';
import { prepareUpdatePayload } from './contactUpdateLogic.mjs';

// --- CRITICAL CHANGE FOR X-RAY SDK IMPORT ---
let AWSXRay;
try {
  const xrayModule = await import('aws-xray-sdk-core');
  AWSXRay = xrayModule.default || xrayModule;
  console.log("X-Ray SDK loaded successfully in index.mjs.");
} catch (e) {
  console.error("Failed to load AWS X-Ray SDK in index.mjs:", e);
  AWSXRay = {}; // Fallback to an empty object to prevent errors
}
// --- END CRITICAL CHANGE ---

/**
 * @typedef {Object} GHLContact
 * @property {string} id
 * @property {string} [name]
 * @property {string} locationId
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [companyName]
 * @property {string} [address1]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [country]
 * @property {string} [postalCode]
 * @property {string} [website]
 * @property {string} [timezone]
 * @property {string[]} [tags]
 * @property {string} [dateOfBirth]
 * @property {Array<{id: string, value: any}>} [customFields]
 * @property {any} [key: string]
 */

/**
 * @typedef {Object} ExtractionField
 * @property {string} id
 * @property {string} field_name
 * @property {string} target_ghl_key
 * @property {string} [field_key]
 * @property {string} field_type
 * @property {string} [overwrite_policy]
 * @property {Object} [original_ghl_field_data]
 */

/**
 * Main Lambda handler for updating GHL contact data.
 * This function is designed to be called directly by another Lambda (e.g., openai-extraction-lambda).
 * @param {Object} event - The Lambda event object (the payload passed by the invoking Lambda).
 * @returns {Promise<Object>} A structured success or error object.
 */
const _handler = async (event) => {
  console.log('=== GHL CONTACT UPDATE REQUEST: START ===');
  console.log('Received event:', JSON.stringify(event));

  const currentSegment = AWSXRay && AWSXRay.getSegment();

  try {
    // For direct Lambda invocation, the event itself is the payload
    const requestBody = event;

    const { ghl_contact_id, location_id, conversation_id, extracted_data } = requestBody;

    // --- X-Ray: Add Annotations for Searchability ---
    if (currentSegment) {
      currentSegment.addAnnotation('ghlContactId', ghl_contact_id);
      currentSegment.addAnnotation('locationId', location_id);
      if (conversation_id) currentSegment.addAnnotation('conversationId', conversation_id);
      currentSegment.addMetadata('extractedDataKeys', Object.keys(extracted_data || {}));
    } else {
      console.warn("X-Ray segment not available for annotations.");
    }
    // --- End X-Ray Annotations ---

    // Validate required fields
    if (!ghl_contact_id || !location_id || !extracted_data) {
      console.error("Validation Error: Missing required fields.");
      return {
        success: false,
        error: "ghl_contact_id, location_id, and extracted_data are required.",
        example: {
          ghl_contact_id: "ocQHyuzHvysMo5N5VsXc",
          location_id: "4beIyWyWrcoPRD7PEN5G",
          conversation_id: "s5QLyA8BsRzGman0LYAw",
          extracted_data: {
            "contact.firstName": "John",
            "contact.email": "john.doe@example.com",
            "custom_field_id": "Some value"
          }
        }
      };
    }

    console.log('Processing update for contact:', {
      ghl_contact_id,
      location_id,
      conversation_id: conversation_id || 'Not provided',
      extracted_data_keys: Object.keys(extracted_data)
    });

    // Initialize Supabase client
    const supabase = await getSupabaseClient();

    // Step 1: Get GHL configuration
    console.log('Step 1: Fetching GHL configuration...');
    /** @type {import('./ghlService.mjs').GHLConfiguration} */
    const ghlConfig = await getGHLConfiguration(supabase, location_id);

    if (!ghlConfig) {
      console.error("GHL Configuration Error: No GHL configuration found.");
      return {
        success: false,
        error: "No GHL configuration found for this location",
        locationId: location_id
      };
    }

    // Removed Step 2: Validate and refresh token if needed (as per requirement)
    // The access_token from ghlConfig is assumed to be valid and active.

    // Step 3: Get extraction fields configuration for this location
    console.log('Step 3: Fetching extraction fields configuration...');
    /** @type {ExtractionField[]} */
    const extractionFields = await getExtractionFields(supabase, ghlConfig.id);

    // Step 4: Get existing contact from GoHighLevel
    console.log('Step 4: Fetching existing contact from GHL...');
    /** @type {GHLContact | null} */
    const existingContact = await getGHLContact(ghlConfig.access_token, ghl_contact_id);

    if (!existingContact) {
      console.error("GHL Contact Error: Contact not found.");
      return {
        success: false,
        error: `Contact with ID ${ghl_contact_id} not found in GoHighLevel`
      };
    }

    // Step 5: Prepare update payload
    console.log('Step 5: Preparing update payload...');
    const updateResult = prepareUpdatePayload(existingContact, extracted_data, extractionFields);

    if (Object.keys(updateResult.updatePayload).length === 0) {
      console.log('No fields were determined to be updated based on policies.');
      return {
        success: true,
        message: "No fields were updated due to overwrite policies",
        contact_id: ghl_contact_id,
        location_id: location_id,
        skipped_fields: updateResult.skippedFields,
        updated_fields: []
      };
    }

    // Step 6: Update the contact in GHL
    console.log('Step 6: Sending update to GHL...');
    console.log('Fields to update:', Object.keys(updateResult.updatePayload));

    // Mark conversation as processed in database if conversation_id is provided
    if (conversation_id) {
      try {
        console.log('Marking conversation as processed:', conversation_id);
        if (currentSegment && AWSXRay.captureAsyncFunc) {
          await AWSXRay.captureAsyncFunc('SupabaseUpdate_MarkConversationProcessed', async (subsegment) => {
            const { error: markError } = await supabase.from('ghl_conversations').update({
              processed: true,
              updated_at: new Date().toISOString()
            }).eq('conversation_id', conversation_id);
            if (markError) {
              subsegment.addError(markError);
              console.warn('Failed to mark conversation as processed:', markError);
            } else {
              console.log('✅ Conversation marked as processed successfully');
            }
          }, currentSegment);
        } else {
          console.warn("X-Ray tracing for Supabase conversation update skipped.");
          const { error: markError } = await supabase.from('ghl_conversations').update({
            processed: true,
            updated_at: new Date().toISOString()
          }).eq('conversation_id', conversation_id);
          if (markError) {
            console.warn('Failed to mark conversation as processed:', markError);
          } else {
            console.log('✅ Conversation marked as processed successfully');
          }
        }
      } catch (markError) {
        console.warn('Error marking conversation as processed:', markError);
      }
    }

    const ghlUpdateResult = await updateGHLContact(ghlConfig.access_token, ghl_contact_id, updateResult.updatePayload);

    if (!ghlUpdateResult.success) {
      console.error("GHL Update Error: Failed to update contact in GHL.");
      return {
        success: false,
        error: "Failed to update contact in GHL",
        details: ghlUpdateResult.error,
        ghlResponse: ghlUpdateResult.ghlResponse
      };
    }

    console.log('✅ Contact updated successfully');
    return {
      success: true,
      contact_id: ghl_contact_id,
      location_id: location_id,
      updated_fields: updateResult.updatedFields,
      skipped_fields: updateResult.skippedFields,
      ghl_response: ghlUpdateResult.ghlResponse,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error("=== CONTACT UPDATE ERROR ===");
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);

    if (currentSegment) {
      currentSegment.addError(error);
      currentSegment.addAnnotation('errorName', error.name);
      currentSegment.addAnnotation('errorMessage', error.message);
    }

    return {
      success: false,
      error: `Contact update failed: ${error.message}`,
      details: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
};

// Export the handler, wrapped with X-Ray if available
export const handler = AWSXRay.captureAWSLambda ? AWSXRay.captureAWSLambda(_handler) : _handler;