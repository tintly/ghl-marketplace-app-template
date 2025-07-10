import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface UpdateRequest {
  ghl_contact_id: string
  location_id: string
  extracted_data: Record<string, any>
  force_overwrite?: string[]
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  try {
    console.log('=== GHL CONTACT UPDATE REQUEST ===')
    
    const requestBody: UpdateRequest = await req.json()
    
    // Validate required fields
    if (!requestBody.ghl_contact_id || !requestBody.location_id || !requestBody.extracted_data) {
      return new Response(
        JSON.stringify({
          error: "ghl_contact_id, location_id, and extracted_data are required.",
          example: {
            ghl_contact_id: "ocQHyuzHvysMo5N5VsXc",
            location_id: "4beIyWyWrcoPRD7PEN5G",
            extracted_data: {
              "contact.firstName": "John",
              "contact.email": "john.doe@example.com",
              "custom_field_id": "Some value"
            }
          }
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    console.log('Processing update for contact:', {
      ghl_contact_id: requestBody.ghl_contact_id,
      location_id: requestBody.location_id,
      extracted_data_keys: Object.keys(requestBody.extracted_data)
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get GHL configuration
    console.log('Step 1: Fetching GHL configuration...')
    const ghlConfig = await getGHLConfiguration(supabase, requestBody.location_id)
    
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({
          error: "No GHL configuration found for this location",
          locationId: requestBody.location_id
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Step 2: Validate and refresh token if needed
    console.log('Step 2: Validating access token...')
    const tokenValidation = validateTokenExpiry(ghlConfig)
    
    if (tokenValidation.needsRefresh) {
      console.log('Token needs refresh, attempting to refresh...')
      const refreshResult = await refreshAccessToken(supabase, ghlConfig)
      
      if (!refreshResult.success) {
        return new Response(
          JSON.stringify({
            error: "Failed to refresh access token",
            details: refreshResult.error
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        )
      }
      
      ghlConfig.access_token = refreshResult.accessToken
    }

    // Step 3: Get extraction fields configuration for this location
    console.log('Step 3: Fetching extraction fields configuration...')
    const extractionFields = await getExtractionFields(supabase, ghlConfig.id)

    // Step 4: Get existing contact from GoHighLevel
    console.log('Step 4: Fetching existing contact from GHL...')
    const existingContact = await getGHLContact(ghlConfig.access_token, requestBody.ghl_contact_id)
    
    if (!existingContact) {
      return new Response(
        JSON.stringify({
          error: `Contact with ID ${requestBody.ghl_contact_id} not found in GoHighLevel`
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Step 5: Prepare update payload
    console.log('Step 5: Preparing update payload...')
    const updateResult = prepareUpdatePayload(
      existingContact,
      requestBody.extracted_data,
      extractionFields
    )

    if (Object.keys(updateResult.updatePayload).length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No fields were updated due to overwrite policies",
          contact_id: requestBody.ghl_contact_id,
          location_id: requestBody.location_id,
          skipped_fields: updateResult.skippedFields,
          updated_fields: []
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Step 6: Update the contact in GHL
    console.log('Step 6: Sending update to GHL...')
    console.log('Fields to update:', Object.keys(updateResult.updatePayload))
    
    // Log the update payload for debugging
    console.log('Update payload:', JSON.stringify(updateResult.updatePayload, null, 2))
    
    const ghlUpdateResult = await updateGHLContact(
      ghlConfig.access_token, 
      requestBody.ghl_contact_id, 
      updateResult.updatePayload
    )

    if (!ghlUpdateResult.success) {
      return new Response(
        JSON.stringify({
          error: "Failed to update contact in GHL",
          details: ghlUpdateResult.error,
          ghlResponse: ghlUpdateResult.ghlResponse
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    console.log('✅ Contact updated successfully')

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: requestBody.ghl_contact_id,
        location_id: requestBody.location_id,
        updated_fields: updateResult.updatedFields,
        skipped_fields: updateResult.skippedFields,
        ghl_response: ghlUpdateResult.ghlResponse,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )

  } catch (error) {
    console.error("=== CONTACT UPDATE ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Contact update failed: ${error.message}`,
        details: error.toString(),
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }
})

// Helper Functions

async function getGHLConfiguration(supabase: any, locationId: string) {
  const { data, error } = await supabase
    .from('ghl_configurations')
    .select(`
      id,
      access_token,
      refresh_token,
      token_expires_at,
      ghl_account_id,
      business_name
    `)
    .eq('ghl_account_id', locationId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch configuration: ${error.message}`)
  }

  return data
}

function validateTokenExpiry(config: any) {
  if (!config.token_expires_at) {
    return { needsRefresh: false }
  }

  const expiryDate = new Date(config.token_expires_at)
  const now = new Date()
  const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  return {
    needsRefresh: hoursUntilExpiry <= 1,
    hoursUntilExpiry: Math.round(hoursUntilExpiry)
  }
}

async function refreshAccessToken(supabase: any, config: any) {
  try {
    const clientId = Deno.env.get('GHL_MARKETPLACE_CLIENT_ID')
    const clientSecret = Deno.env.get('GHL_MARKETPLACE_CLIENT_SECRET')
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'

    const params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token
    })

    const response = await fetch(`${apiDomain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`)
    }

    const tokenData = await response.json()
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
    
    await supabase
      .from('ghl_configurations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id)

    return {
      success: true,
      accessToken: tokenData.access_token
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function getExtractionFields(supabase: any, configId: string) {
  const { data, error } = await supabase
    .from('data_extraction_fields')
    .select(`
      id,
      field_name,
      target_ghl_key,
      field_type,
      overwrite_policy,
      original_ghl_field_data
    `)
    .eq('config_id', configId)

  if (error) {
    throw new Error(`Failed to fetch extraction fields: ${error.message}`)
  }

  return data || []
}

async function getGHLContact(accessToken: string, contactId: string) {
  const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'
  const url = `${apiDomain}/contacts/${contactId}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Version': '2021-07-28',
      'Accept': 'application/json'
    }
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch contact: ${response.status} - ${errorText}`)
  }

  const responseData = await response.json()
  return responseData.contact || responseData
}

// Check if a field key is a standard field
function isStandardField(field: any): boolean {
  // Use the database information to determine if this is a standard field
  // This is the most reliable way since we already have this information
  return field && field.target_ghl_key && field.target_ghl_key.includes('.')
}

function prepareUpdatePayload(
  existingContact: any, 
  extractedData: Record<string, any>,
  extractionFields: any[]
) {
  const updatePayload: any = {}
  const updatedFields: string[] = []
  const skippedFields: string[] = []

  // Initialize customFields array if needed
  if (!updatePayload.customFields) {
    updatePayload.customFields = []
  }

  // Helper function to convert snake_case field keys to GHL's camelCase format
  function getGHLStandardFieldName(inputKey: string): string {
    // Remove 'contact.' prefix if present
    let key = inputKey.includes('.') ? inputKey.split('.')[1] : inputKey
    
    // Map specific fields to their GHL API equivalents
    switch (key) {
      case 'date_of_birth':
        return 'dateOfBirth'
      case 'first_name':
        return 'firstName'
      case 'last_name':
        return 'lastName'
      case 'postal_code':
        return 'postalCode'
      case 'phone_raw':
        return 'phone'
      case 'full_address':
        return 'address'
      case 'address1':
        return 'address1'
      case 'company_name':
        return 'companyName'
      // For fields that don't need conversion
      case 'name':
      case 'email':
      case 'city':
      case 'state':
      case 'country':
      case 'website':
        return key
      default:
        return key
    }
  }

  // Create extraction fields map for metadata
  const fieldsMap = new Map()
  
  // Map both standard fields and custom fields
  extractionFields.forEach(f => {
    if (f.target_ghl_key.includes('.')) {
      // Standard field (e.g., contact.firstName)
      fieldsMap.set(f.target_ghl_key, f)
    } else {
      // Custom field - map both the GHL ID and the fieldKey if available
      fieldsMap.set(f.target_ghl_key, f)
      
      // If we have original field data with a fieldKey, map that too
      if (f.original_ghl_field_data?.fieldKey) {
        fieldsMap.set(f.original_ghl_field_data.fieldKey, f)
      }
    }
  })

  // Create custom fields map for quick lookup
  const customFieldsMap = new Map()
  if (existingContact.customFields) {
    existingContact.customFields.forEach((cf: any) => {
      customFieldsMap.set(cf.id, cf.value)
    })
  }

  // Process each extracted field
  for (const [fieldKey, newValue] of Object.entries(extractedData)) {
    // Skip empty values
    if (newValue === null || newValue === undefined || newValue === '') {
      console.log(`Skipping empty value for field ${fieldKey}`)
      skippedFields.push(fieldKey)
      continue
    }

    console.log(`Processing field: ${fieldKey} with value: ${newValue}`)

    // Get field configuration if available
    const field = fieldsMap.get(fieldKey)

    if (!field) {
      console.log(`No field configuration found for ${fieldKey}, skipping`)
      skippedFields.push(fieldKey)
      continue
    }
    
    // Use the database information to determine if this is a standard field
    const isStandard = isStandardField(field)
    
    console.log(`Field ${fieldKey} is ${isStandard ? 'standard' : 'custom'} field`)
    
    const fieldName = field?.field_name || fieldKey
    const policy = field?.overwrite_policy || 'always'
    
    // Get current value based on field type
    let currentValue: any = null
    let targetFieldId: string = field?.target_ghl_key || fieldKey
    
    if (isStandard && field) {
      // Standard field (e.g., contact.firstName)
      const fieldKeyParts = field.target_ghl_key.split('.')
      const ghlStandardKey = getGHLStandardFieldName(field.target_ghl_key)
      currentValue = existingContact[ghlStandardKey]
      
      console.log(`Standard field ${fieldKey} -> ${ghlStandardKey}:`, {
        current: currentValue,
        new: newValue,
        policy
      })
    } else {
      // Custom field
      currentValue = customFieldsMap.get(targetFieldId)
      
      console.log(`Custom field ${fieldKey} (${targetFieldId}):`, {
        current: currentValue,
        new: newValue,
        policy
      })
    }

    // Apply overwrite policy
    let shouldUpdate = false
    
    switch (policy) {
      case 'always':
        shouldUpdate = true
        break
      case 'if_empty':
        shouldUpdate = !currentValue || currentValue === '' || currentValue === null
        break
      case 'never':
        shouldUpdate = false
        break
      default:
        shouldUpdate = true
    }

    if (!shouldUpdate) {
      console.log(`⏭️ Skipping ${fieldName} due to overwrite policy: ${policy}`)
      skippedFields.push(fieldKey)
      continue
    }

    if (shouldUpdate) {
      if (isStandard) {
        // For standard fields, get the GHL field name from the target_ghl_key
        const fieldKeyParts = field.target_ghl_key.split('.')
        const ghlStandardKey = getGHLStandardFieldName(field.target_ghl_key)
        
        // Special handling for specific field types
        switch (ghlStandardKey) {
          case 'tags':
            // Merge tags to avoid duplicates
            const existingTags = existingContact.tags || []
            const newTags = Array.isArray(newValue) ? newValue : [newValue]
            updatePayload.tags = Array.from(new Set([...existingTags, ...newTags]))
            break
            
          default:
            // For standard fields, just add them directly to the update payload
            updatePayload[ghlStandardKey] = newValue
            break
        }
        
        console.log(`✅ Will update standard field ${ghlStandardKey}: ${JSON.stringify(currentValue)} → ${JSON.stringify(newValue)}`)
        updatedFields.push(fieldKey)
      } else {
        // Custom field
        updatePayload.customFields.push({
          id: targetFieldId,
          value: newValue
        })
        
        console.log(`✅ Will update custom field ${targetFieldId} (${fieldName}): ${JSON.stringify(currentValue)} → ${JSON.stringify(newValue)}`)
        updatedFields.push(fieldKey)
      }
    }
  }

  // Final validation - ensure customFields is an array
  if (!Array.isArray(updatePayload.customFields)) {
    updatePayload.customFields = []
  }

  // If no custom fields were added, remove the empty array
  if (updatePayload.customFields && updatePayload.customFields.length === 0) {
    delete updatePayload.customFields
  }

  // Log the final payload
  console.log('=== FINAL UPDATE PAYLOAD ===')
  console.log('Standard fields:', Object.keys(updatePayload).filter(k => k !== 'customFields'))
  console.log('Custom fields:', updatePayload.customFields?.length || 0)
  console.log('=== END FINAL UPDATE PAYLOAD ===')

  return {
    updatePayload,
    updatedFields,
    skippedFields
  }
}

// Function to update a contact in GHL
async function updateGHLContact(accessToken: string, contactId: string, payload: any) {
  try {
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'
    const url = `${apiDomain}/contacts/${contactId}`

    // Clean payload - remove read-only fields
    const cleanPayload = { ...payload }
    delete cleanPayload.id 
    delete cleanPayload.locationId
    delete cleanPayload.dateAdded
    delete cleanPayload.dateUpdated
    delete cleanPayload.lastActivity

    console.log('Sending update to GHL:', {
      contactId,
      fieldsToUpdate: Object.keys(cleanPayload),
      customFieldsCount: cleanPayload.customFields?.length || 0
    })

    // Log the fields being updated
    console.log('Standard fields:', Object.keys(cleanPayload).filter(k => k !== 'customFields'))
    console.log('Custom fields:', cleanPayload.customFields?.length || 0)
    console.log('Fields to update:', Object.keys(cleanPayload))

    // Final validation to ensure we're not sending any invalid fields
    const validStandardFields = [
      'firstName', 'lastName', 'name', 'email', 'phone', 'dnd', 'dndSettings',
      'companyName', 'address1', 'address', 'city', 'state', 'country', 
      'postalCode', 'website', 'dateOfBirth', 'tags'
    ]
    
    // Move any standard fields that aren't in the valid list to customFields
    Object.keys(cleanPayload).forEach(key => {
      if (!validStandardFields.includes(key) && key !== 'customFields' && key !== 'tags') {
        console.log(`⚠️ Invalid standard field detected: ${key}, removing from payload`)
        
        // Move to customFields
        if (!cleanPayload.customFields) {
          cleanPayload.customFields = []
        }
        
        console.log(`⚠️ Skipping invalid field: ${key} - not a valid standard field`)
        
        // Remove from standard fields
        delete cleanPayload[key]
      }
    })

    // Log the final payload being sent
    console.log('Final update payload:', JSON.stringify(cleanPayload, null, 2))

    // If we have no valid fields to update, return early
    if (Object.keys(cleanPayload).length === 0 && 
        (!cleanPayload.customFields || cleanPayload.customFields.length === 0)) {
      console.log('⚠️ No valid fields to update, skipping API call')
      return {
        success: true,
        ghlResponse: { message: "No valid fields to update" }
      }
    }
    
    console.log('Sending update to GHL API...')

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

    let responseData
    try {
      responseData = await response.json()
    } catch (e) {
      responseData = { error: 'Failed to parse response' }
    }
    
    if (!response.ok) {
      console.error('GHL API error:', {
        status: response.status,
        response: responseData
      })
      
      return {
        success: false,
        error: `GHL API error: ${JSON.stringify({
          status: response.status,
          response: responseData
        })}`,
        ghlResponse: responseData
      }
    }
    
    console.log('✅ Contact updated successfully in GHL')
    
    return {
      success: true,
      ghlResponse: responseData
    }
  } catch (error) {
    console.error('Error updating contact:', error)
    return {
      success: false,
      error: error.message
    }
  }
}