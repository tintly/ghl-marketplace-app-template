// Path: ghlService.mjs

import { getSupabaseClient } from './supabaseClient.mjs'; // Adjusted path

// --- CRITICAL CHANGE FOR X-RAY SDK IMPORT ---
let AWSXRay;
try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
    console.log("X-Ray SDK loaded successfully in ghlService.");
} catch (e) {
    console.error("Failed to load AWS X-Ray SDK in ghlService:", e);
    AWSXRay = {}; // Fallback to an empty object to prevent errors
}
// --- END CRITICAL CHANGE ---

const GHL_API_DOMAIN = process.env.GHL_API_DOMAIN || 'https://services.leadconnectorhq.com';

/**
 * @typedef {Object} GHLConfiguration
 * @property {string} id
 * @property {string} access_token
 * @property {string} ghl_account_id
 * @property {string} business_name
 */

/**
 * Fetches GHL configuration from Supabase for a given location ID.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - The Supabase client instance.
 * @param {string} locationId - The GHL location ID.
 * @returns {Promise<GHLConfiguration | null>} The GHL configuration or null if not found.
 */
export async function getGHLConfiguration(supabase, locationId) {
  console.log('Fetching GHL configuration for location:', locationId);

  const segment = AWSXRay.getSegment ? AWSXRay.getSegment() : null;
  let data, error;

  if (segment && AWSXRay.captureAsyncFunc) {
    await AWSXRay.captureAsyncFunc('SupabaseQuery_getGHLConfiguration', async (subsegment) => {
      try {
        const result = await supabase
          .from('ghl_configurations')
          .select(`
            id,
            access_token,
            ghl_account_id,
            business_name
          `) // Removed refresh_token, token_expires_at as they are not used
          .eq('ghl_account_id', locationId)
          .eq('is_active', true)
          .maybeSingle();

        data = result.data;
        error = result.error;

        if (error) subsegment.addError(error);
      } catch (e) {
        subsegment.addError(e);
        throw e;
      } finally {
        if (subsegment) subsegment.close();
      }
    }, segment);
  } else {
    console.warn("X-Ray tracing for getGHLConfiguration Supabase query skipped.");
    const result = await supabase
      .from('ghl_configurations')
      .select(`
        id,
        access_token,
        ghl_account_id,
        business_name
      `) // Removed refresh_token, token_expires_at
      .eq('ghl_account_id', locationId)
      .eq('is_active', true)
      .maybeSingle();
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.error('Error fetching GHL configuration:', error);
    throw new Error(`Failed to fetch configuration: ${error.message}`);
  }

  if (!data) {
    console.log('No configuration found for location:', locationId);
    return null;
  }

  console.log('✅ Found configuration:', {
    id: data.id,
    business_name: data.business_name,
    hasAccessToken: !!data.access_token
  });

  return data;
}

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
 * Fetches data extraction fields configuration from Supabase.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - The Supabase client instance.
 * @param {string} configId - The ID of the GHL configuration.
 * @returns {Promise<ExtractionField[]>} An array of extraction field configurations.
 */
export async function getExtractionFields(supabase, configId) {
  console.log('Fetching extraction fields for config:', configId);

  const segment = AWSXRay.getSegment ? AWSXRay.getSegment() : null;
  let data, error;

  if (segment && AWSXRay.captureAsyncFunc) {
    await AWSXRay.captureAsyncFunc('SupabaseQuery_getExtractionFields', async (subsegment) => {
      try {
        const result = await supabase
          .from('data_extraction_fields')
          .select(`
            id,
            field_name,
            target_ghl_key,
            field_key,
            field_type,
            overwrite_policy,
            original_ghl_field_data
          `)
          .eq('config_id', configId)
          .order('sort_order', { ascending: true });

        data = result.data;
        error = result.error;

        if (error) subsegment.addError(error);
      } catch (e) {
        subsegment.addError(e);
        throw e;
      } finally {
        if (subsegment) subsegment.close();
      }
    }, segment);
  } else {
    console.warn("X-Ray tracing for getExtractionFields Supabase query skipped.");
    const result = await supabase
      .from('data_extraction_fields')
      .select(`
        id,
        field_name,
        target_ghl_key,
        field_key,
        field_type,
        overwrite_policy,
        original_ghl_field_data
      `)
      .eq('config_id', configId)
      .order('sort_order', { ascending: true });
    data = result.data;
    error = result.error;
  }

  const fields = data || [];
  console.log(`✅ Found ${fields.length} extraction fields`);

  return fields;
}

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
 * Fetches a contact from GoHighLevel API.
 * @param {string} accessToken - The GHL access token.
 * @param {string} contactId - The ID of the contact to fetch.
 * @returns {Promise<GHLContact | null>} The GHL contact object or null if not found.
 */
export async function getGHLContact(accessToken, contactId) {
  const url = `${GHL_API_DOMAIN}/contacts/${contactId}`;

  const segment = AWSXRay.getSegment ? AWSXRay.getSegment() : null;
  let responseData;

  if (segment && AWSXRay.captureAsyncFunc) {
    await AWSXRay.captureAsyncFunc('GHL_API_GetContact', async (subsegment) => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Version': '2021-07-28',
            'Accept': 'application/json'
          }
        });

        if (response.status === 404) {
          console.log(`Contact ${contactId} not found in GHL`);
          subsegment.addAnnotation('ghlContactFound', false);
          responseData = null;
          return; // Exit subsegment early
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch contact: ${response.status} - ${errorText}`);
        }

        responseData = await response.json();
        subsegment.addAnnotation('ghlContactFound', true);
      } catch (e) {
        subsegment.addError(e);
        throw e;
      } finally {
        if (subsegment) subsegment.close();
      }
    }, segment);
  } else {
    console.warn("X-Ray tracing for GHL API Get Contact skipped.");
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    });

    if (response.status === 404) {
      console.log(`Contact ${contactId} not found in GHL`);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch contact: ${response.status} - ${errorText}`);
    }
    responseData = await response.json();
  }

  return responseData?.contact || responseData;
}

/**
 * Function to update a contact in GHL.
 * @param {string} accessToken - The GHL access token.
 * @param {string} contactId - The ID of the contact to update.
 * @param {Object} payload - The payload containing fields to update.
 * @returns {Promise<{success: boolean, error?: string, ghlResponse?: Object}>} Update result.
 */
export async function updateGHLContact(accessToken, contactId, payload) {
  try {
    const url = `${GHL_API_DOMAIN}/contacts/${contactId}`;
    // Clean payload - remove read-only fields
    const cleanPayload = { ...payload };
    delete cleanPayload.id;
    delete cleanPayload.locationId;
    delete cleanPayload.dateAdded;
    delete cleanPayload.dateUpdated;
    delete cleanPayload.lastActivity;

    console.log('Sending update to GHL:', {
      contactId,
      fieldsToUpdate: Object.keys(cleanPayload),
      customFieldsCount: cleanPayload.customFields?.length || 0
    });

    // Log the fields being updated
    console.log('Standard fields:', Object.keys(cleanPayload).filter((k) => k !== 'customFields'));
    console.log('Custom fields:', cleanPayload.customFields?.length || 0);

    // Final validation - GHL API only accepts specific standard fields for PUT
    const validStandardFields = [
      'firstName', 'lastName', 'name', 'email', 'phone', 'dnd', 'dndSettings',
      'companyName', 'address1', 'address', 'city', 'state', 'country',
      'postalCode', 'website', 'dateOfBirth', 'tags'
    ];

    // Remove any standard fields that aren't in the valid list from the payload
    Object.keys(cleanPayload).forEach((key) => {
      if (!validStandardFields.includes(key) && key !== 'customFields') { // 'customFields' is a special key
        console.warn(`⚠️ Invalid standard field detected: "${key}", removing from payload.`);
        delete cleanPayload[key];
      }
    });

    // Log the final payload being sent
    console.log('Final update payload being sent to GHL:', JSON.stringify(cleanPayload, null, 2));

    // If we have no valid fields to update, return early
    if (Object.keys(cleanPayload).length === 0 && (!cleanPayload.customFields || cleanPayload.customFields.length === 0)) {
      console.log('⚠️ No valid fields to update after cleanup, skipping GHL API call.');
      return {
        success: true,
        ghlResponse: { message: "No valid fields to update" }
      };
    }

    const segment = AWSXRay.getSegment ? AWSXRay.getSegment() : null;
    let responseData;

    if (segment && AWSXRay.captureAsyncFunc) {
      await AWSXRay.captureAsyncFunc('GHL_API_UpdateContact', async (subsegment) => {
        try {
          const response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Version': '2021-07-28',
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(cleanPayload)
          });

          try {
            responseData = await response.json();
          } catch (e) {
            responseData = { error: 'Failed to parse response from GHL' };
          }

          if (!response.ok) {
            subsegment.addError(new Error(`GHL API error: ${response.status}`));
            subsegment.addMetadata('ghlErrorResponse', responseData);
            throw new Error(`GHL API error: ${JSON.stringify({ status: response.status, response: responseData })}`);
          }
          subsegment.addAnnotation('ghlUpdateSuccess', true);
        } catch (e) {
          subsegment.addError(e);
          subsegment.addAnnotation('ghlUpdateSuccess', false);
          throw e;
        } finally {
          if (subsegment) subsegment.close();
        }
      }, segment);
    } else {
      console.warn("X-Ray tracing for GHL API Update Contact skipped.");
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(cleanPayload)
      });

      try {
        responseData = await response.json();
      } catch (e) {
        responseData = { error: 'Failed to parse response from GHL' };
      }

      if (!response.ok) {
        throw new Error(`GHL API error: ${JSON.stringify({ status: response.status, response: responseData })}`);
      }
    }

    console.log('✅ Contact updated successfully in GHL');
    return {
      success: true,
      ghlResponse: responseData
    };
  } catch (error) {
    console.error('Error updating contact:', error);
    return {
      success: false,
      error: error.message
    };
  }
}