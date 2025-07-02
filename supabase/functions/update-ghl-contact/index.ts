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

    // Step 5: Apply overwrite policies and prepare update payload
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
    
    if (updateResult.updatePayload.customFields) {
      console.log('Custom fields to update:', updateResult.updatePayload.customFields.map((cf: any) => 
        `${cf.id}: ${typeof cf.value === 'object' ? JSON.stringify(cf.value) : cf.value}`
      ))
    }
    
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

function prepareUpdatePayload(
  existingContact: any, 
  extractedData: Record<string, any>,
  extractionFields: any[]
) {
  const updatePayload: any = {}
  const updatedFields: string[] = []
  const skippedFields: string[] = []

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

    // Get field configuration if available
    const field = fieldsMap.get(fieldKey)
    
    // If no field configuration found, try to determine if it's a standard field
    const isStandardField = fieldKey.includes('.')
    
    if (!field && !isStandardField) {
      console.log(`No field configuration found for ${fieldKey}, skipping`)
      skippedFields.push(fieldKey)
      continue
    }
    
    const fieldName = field?.field_name || fieldKey
    const policy = field?.overwrite_policy || 'always'
    
    // Get current value
    let currentValue: any = null
    let targetFieldId: string = field?.target_ghl_key || fieldKey
    
    if (isStandardField) {
      // Standard field (e.g., contact.firstName)
      const standardFieldKey = fieldKey.split('.')[1]
      currentValue = existingContact[standardFieldKey]
      
      console.log(`Standard field ${fieldKey} -> ${standardFieldKey}:`, {
        currentValue,
        newValue
      })
    } else {
      // Custom field - use the GHL field ID from target_ghl_key
      currentValue = customFieldsMap.get(targetFieldId)
      
      console.log(`Custom field ${fieldKey} -> ${targetFieldId}:`, {
        currentValue,
        newValue
      })
    }

    // Check if field has existing value
    const hasExistingValue = currentValue !== null && 
                            currentValue !== undefined && 
                            currentValue !== '' &&
                            !(Array.isArray(currentValue) && currentValue.length === 0)

    // Apply overwrite policy
    let shouldUpdate = false
    let skipReason = ''

    switch (policy) {
      case 'always':
        shouldUpdate = true
        break
        
      case 'never':
        shouldUpdate = false
        skipReason = 'Policy set to never overwrite'
        break
        
      case 'only_empty':
        shouldUpdate = !hasExistingValue
        if (hasExistingValue) {
          skipReason = 'Field has existing value and policy is only_empty'
        }
        break
        
      default:
        // Default to always overwrite
        shouldUpdate = true
        break
    }

    if (shouldUpdate) {
      if (isStandardField) {
        // Handle standard fields
        const standardFieldKey = fieldKey.split('.')[1]
        
        // Special handling for specific field types
        switch (standardFieldKey) {
          case 'tags':
            // Merge tags to avoid duplicates
            const existingTags = existingContact.tags || []
            const newTags = Array.isArray(newValue) ? newValue : [newValue]
            updatePayload.tags = Array.from(new Set([...existingTags, ...newTags]))
            break
            
          default:
            updatePayload[standardFieldKey] = newValue
            break
        }
      } else {
        // Handle custom fields - CRITICAL FIX: Use the target_ghl_key (GHL field ID)
        if (!updatePayload.customFields) {
          updatePayload.customFields = [...(existingContact.customFields || [])]
        }
        
        // Find existing custom field or add new one
        const existingFieldIndex = updatePayload.customFields.findIndex((cf: any) => cf.id === targetFieldId)
        
        if (existingFieldIndex >= 0) {
          updatePayload.customFields[existingFieldIndex].value = newValue
        } else {
          updatePayload.customFields.push({
            id: targetFieldId,
            value: newValue
          })
        }
      }
      
      updatedFields.push(fieldKey)
      console.log(`✅ Will update ${fieldKey} (${targetFieldId}): ${currentValue} → ${newValue}`)
    } else {
      skippedFields.push(fieldKey)
      console.log(`⏭️ Skipping ${fieldKey}: ${skipReason}`)
    }
  }

  return {
    updatePayload,
    updatedFields,
    skippedFields
  }
}

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

    // Log the exact payload being sent
    console.log('Update payload:', JSON.stringify(cleanPayload, null, 2))

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(cleanPayload)
    })

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