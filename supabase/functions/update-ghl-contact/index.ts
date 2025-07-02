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
    console.log('=== GHL CONTACT UPDATE REQUEST ===');
    const requestBody = await req.json();
    // Validate required fields
    if (!requestBody.ghl_contact_id || !requestBody.location_id || !requestBody.extracted_data) {
      return new Response(JSON.stringify({
        error: "ghl_contact_id, location_id, and extracted_data are required.",
        example: {
          ghl_contact_id: "ocQHyuzHvysMo5N5VsXc",
          location_id: "4beIyWyWrcoPRD7PEN5G",
          extracted_data: {
            firstName: "John",
            email: "john.doe@example.com",
            appointment_date: "2024-07-20"
          }
        }
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log('Processing update for contact:', {
      ghl_contact_id: requestBody.ghl_contact_id,
      location_id: requestBody.location_id,
      extracted_data_keys: Object.keys(requestBody.extracted_data)
    });
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Step 1: Get GHL configuration (OAuth tokens) for the location
    console.log('Step 1: Fetching GHL configuration...');
    const ghlConfig = await getGHLConfiguration(supabase, requestBody.location_id);
    if (!ghlConfig) {
      return new Response(JSON.stringify({
        error: "No GHL configuration found for this location",
        locationId: requestBody.location_id
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Step 2: Check if token needs refresh
    console.log('Step 2: Validating access token...');
    const tokenValidation = validateTokenExpiry(ghlConfig);
    if (tokenValidation.needsRefresh) {
      console.log('Token needs refresh, attempting to refresh...');
      const refreshResult = await refreshAccessToken(supabase, ghlConfig);
      if (!refreshResult.success) {
        return new Response(JSON.stringify({
          error: "Failed to refresh access token",
          details: refreshResult.error
        }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      // Update the config with new token
      ghlConfig.access_token = refreshResult.accessToken;
    }
    // Step 3: Fetch custom field mappings for the location
    console.log('Step 3: Fetching custom field mappings...');
    const { data: customFieldMappings, error: mappingsError } = await supabase.from('ghl_custom_field_mappings').select('ghl_key, ghl_field_id').eq('location_id', requestBody.location_id); // Ensure this matches your table structure
    if (mappingsError) {
      console.error('Error fetching custom field mappings:', mappingsError.message);
      throw new Error(`Failed to retrieve custom field mappings: ${mappingsError.message}`);
    }
    const customFieldMap = new Map(customFieldMappings.map((m)=>[
        m.ghl_key,
        m.ghl_field_id
      ]));
    console.log(`Loaded ${customFieldMap.size} custom field mappings.`);
    // Step 4: Get existing contact data from GoHighLevel
    console.log('Step 4: Fetching existing contact data from GHL...');
    const existingContact = await getGHLContact(ghlConfig.access_token, requestBody.ghl_contact_id);
    if (!existingContact) {
      return new Response(JSON.stringify({
        error: `Contact with ID ${requestBody.ghl_contact_id} not found in GoHighLevel.`
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log('Existing GHL contact fetched successfully.');
    // Step 5: Prepare the merged payload for update
    console.log('Step 5: Preparing merged payload...');
    const mergedPayload = prepareUpdatePayload(existingContact, requestBody.extracted_data, customFieldMap);
    console.log('Merged payload prepared.');
    // Step 6: Update the contact in GHL
    console.log('Step 6: Sending update to GHL...');
    const updateResult = await updateGHLContact(ghlConfig.access_token, requestBody.ghl_contact_id, mergedPayload);
    if (!updateResult.success) {
      return new Response(JSON.stringify({
        error: "Failed to update contact in GHL",
        details: updateResult.error,
        ghlResponse: updateResult.ghlResponse
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log('✅ Contact updated successfully');
    return new Response(JSON.stringify({
      success: true,
      contactId: requestBody.ghl_contact_id,
      locationId: requestBody.location_id,
      updatedFields: Object.keys(requestBody.extracted_data),
      ghlResponse: updateResult.ghlResponse,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("=== CONTACT UPDATE ERROR ===");
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    return new Response(JSON.stringify({
      error: `Contact update failed: ${error.message}`,
      details: error.toString(),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});
// --- Helper Functions ---
async function getGHLConfiguration(supabase, locationId) {
  console.log('Fetching GHL configuration for location:', locationId);
  // Assuming 'ghl_account_id' in your 'ghl_configurations' table corresponds to 'location_id'
  const { data, error } = await supabase.from('ghl_configurations').select(`
      id,
      access_token,
      refresh_token,
      token_expires_at,
      ghl_account_id,
      business_name
    `).eq('ghl_account_id', locationId) // Use ghl_account_id to match locationId
  .eq('is_active', true) // Assuming you have an active flag
  .maybeSingle();
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
function validateTokenExpiry(config) {
  if (!config.token_expires_at) {
    // If no expiry date, assume it's valid or needs refresh based on your policy
    // For now, if no expiry, we won't force a refresh here.
    console.warn('No token_expires_at found for GHL configuration. Skipping expiry check.');
    return {
      needsRefresh: false
    };
  }
  const expiryDate = new Date(config.token_expires_at);
  const now = new Date();
  const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  console.log(`Token expires in ${Math.round(hoursUntilExpiry)} hours`);
  return {
    needsRefresh: hoursUntilExpiry <= 1,
    hoursUntilExpiry: Math.round(hoursUntilExpiry)
  };
}
async function refreshAccessToken(supabase, config) {
  try {
    const clientId = Deno.env.get('GHL_MARKETPLACE_CLIENT_ID');
    const clientSecret = Deno.env.get('GHL_MARKETPLACE_CLIENT_SECRET');
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com';
    if (!clientId || !clientSecret) {
      throw new Error('GHL client credentials (GHL_MARKETPLACE_CLIENT_ID, GHL_MARKETPLACE_CLIENT_SECRET) not configured in environment variables.');
    }
    if (!config.refresh_token) {
      throw new Error('Refresh token is missing from GHL configuration. Cannot refresh.');
    }
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token
    });
    const response = await fetch(`${apiDomain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }
    const tokenData = await response.json();
    // Update the database with new tokens
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const { error: updateError } = await supabase.from('ghl_configurations').update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    }).eq('id', config.id) // Use the config's primary ID for update
    ;
    if (updateError) {
      console.error('Failed to update tokens in database:', updateError);
    }
    console.log('✅ Access token refreshed successfully');
    return {
      success: true,
      accessToken: tokenData.access_token
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
async function getGHLContact(accessToken, contactId) {
  const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com';
  const url = `${apiDomain}/contacts/${contactId}`;
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
      console.log(`Contact ${contactId} not found in GHL.`);
      return null;
    }
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch existing GHL contact: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch existing GoHighLevel contact: ${response.statusText} - ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching existing contact:', error);
    throw error;
  }
}
function prepareUpdatePayload(existingContact, extractedData, customFieldMap) {
  // Start with a copy of the existing contact data
  const updatePayload = {
    ...existingContact
  };
  // GoHighLevel PUT endpoint requires specific fields to be removed or handled
  // These are typically read-only or part of the URL/context, not the body.
  delete updatePayload.id; // Contact ID is in the URL
  delete updatePayload.locationId; // Not part of contact update payload
  delete updatePayload.dateAdded; // Read-only
  delete updatePayload.dateUpdated; // Read-only
  delete updatePayload.companyId; // Read-only
  delete updatePayload.lastActivity; // Read-only
  delete updatePayload.lastConversation; // Read-only
  delete updatePayload.lastMessage; // Read-only
  delete updatePayload.lastStatus; // Read-only
  delete updatePayload.lastSeen; // Read-only
  delete updatePayload.source; // Can be updated, but often set on creation. If not in extracted_data, keep existing.
  delete updatePayload.assignedTo; // Can be updated, but often set on creation. If not in extracted_data, keep existing.
  // Ensure customFields array exists
  updatePayload.customFields = updatePayload.customFields || [];
  const existingCustomFieldsMap = new Map(updatePayload.customFields.map((cf)=>[
      cf.id,
      cf
    ]));
  // Process extracted_data
  for(const key in extractedData){
    if (extractedData.hasOwnProperty(key)) {
      const value = extractedData[key];
      // Handle standard fields
      switch(key){
        case 'firstName':
        case 'lastName':
        case 'name':
        case 'email':
        case 'phone':
        case 'address1':
        case 'city':
        case 'state':
        case 'postalCode':
        case 'website':
        case 'timezone':
        case 'country':
        case 'source':
        case 'assignedTo':
          updatePayload[key] = value;
          break;
        case 'tags':
          // Merge tags, ensure no duplicates
          updatePayload.tags = Array.from(new Set([
            ...updatePayload.tags || [],
            ...Array.isArray(value) ? value : [
              value
            ]
          ]));
          break;
        default:
          // Handle custom fields using the mapping
          const ghlFieldId = customFieldMap.get(key);
          if (ghlFieldId) {
            // Update existing custom field or add new one
            existingCustomFieldsMap.set(ghlFieldId, {
              ...existingCustomFieldsMap.get(ghlFieldId),
              id: ghlFieldId,
              field_value: value
            });
          } else {
            console.warn(`No GHL custom field mapping found for extracted key: "${key}". Skipping.`);
          }
          break;
      }
    }
  }
  // Convert the map back to an array for the payload
  updatePayload.customFields = Array.from(existingCustomFieldsMap.values());
  return updatePayload;
}
async function updateGHLContact(accessToken, contactId, payload// This payload is already merged and prepared
) {
  try {
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com';
    const url = `${apiDomain}/contacts/${contactId}`;
    console.log('Sending PUT request to GHL with payload (partial view):', {
      contactId,
      firstName: payload.firstName,
      email: payload.email,
      tags: payload.tags,
      customFieldsCount: payload.customFields?.length || 0
    });
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const responseData = await response.json();
    if (!response.ok) {
      console.error('GHL API error:', {
        status: response.status,
        statusText: response.statusText,
        response: responseData
      });
      return {
        success: false,
        error: `GHL API error: ${response.status} - ${response.statusText} - ${JSON.stringify(responseData)}`,
        ghlResponse: responseData
      };
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
