export default class CustomFieldsLoader {
  constructor(authService = null) {
    this.authService = authService
  }

  async loadFields(config) {
    try {
      // Validate access token
      if (!config.access_token) {
        console.error('No access token available')
        throw new Error('No access token available. Please reconnect your account.')
      }

      if (this.isTemporaryToken(config.access_token)) {
        console.error('Temporary token detected. Please reconnect your account.')
        throw new Error('Temporary token detected. Please reconnect your account.')
      }

      try {
        const ghlService = new (await import('../../services/GHLApiService')).GHLApiService(config.access_token)
        const fields = await ghlService.getCustomFields(config.ghl_account_id)
        
        // Update stored field data for existing extraction fields
        await this.updateStoredFieldData(config.id, fields)
        
        return fields
      } catch (apiError) {
        console.error('API error fetching custom fields:', apiError)
        throw new Error(`Failed to fetch custom fields: ${apiError.message}`)
      }
    } catch (error) {
      console.error('Error loading custom fields:', error)
      throw error
    }
  }

  async updateStoredFieldData(configId, freshCustomFields) {
    try {
      console.log('=== UPDATING STORED FIELD DATA ===')
      console.log('Config ID:', configId)
      console.log('Fresh fields count:', freshCustomFields.length)

      // Get the authenticated Supabase client
      const supabase = this.authService?.getSupabaseClient() || (await import('../../services/supabase')).supabase

      // Get all extraction fields for this configuration
      const { data: extractionFields, error: fetchError } = await supabase
        .from('data_extraction_fields')
        .select('id, target_ghl_key, field_name, original_ghl_field_data')
        .eq('config_id', configId)

      if (fetchError) {
        console.error('Error fetching extraction fields:', fetchError)
        return
      }

      if (!extractionFields || extractionFields.length === 0) {
        console.log('No extraction fields found for this configuration')
        return
      }

      console.log('Found extraction fields to update:', extractionFields.length)

      // Process each extraction field
      const updatePromises = extractionFields.map(async (extractionField) => {
        try {
          // Find the corresponding fresh field data
          const freshField = freshCustomFields.find(field => field.id === extractionField.target_ghl_key)
          
          if (freshField) {
            console.log(`✅ Updating field data for: ${extractionField.field_name}`)
            console.log('Fresh field data:', {
              id: freshField.id,
              name: freshField.name,
              dataType: freshField.dataType,
              parentId: freshField.parentId,
              fieldKey: freshField.fieldKey,
              position: freshField.position
            })

            // CRITICAL: Check if the field name has changed in GHL
            const nameChanged = freshField.name !== extractionField.field_name
            if (nameChanged) {
              console.log(`🔄 FIELD NAME CHANGED: "${extractionField.field_name}" → "${freshField.name}"`)
            }

            // Ensure we preserve ALL field metadata including parentId
            const completeFieldData = {
              ...freshField,
              // Ensure critical folder placement data is preserved
              parentId: freshField.parentId || null,
              position: freshField.position || 0,
              fieldKey: freshField.fieldKey,
              model: freshField.model || 'contact',
              objectId: freshField.objectId || null,
              objectSchemaId: freshField.objectSchemaId || null
            }

            console.log('🗂️ CRITICAL: Preserving parentId in stored data:', completeFieldData.parentId)

            // Update both the stored field data AND the field name if it changed
            const updateData = {
              original_ghl_field_data: completeFieldData,
             field_key: freshField.fieldKey,
              updated_at: new Date().toISOString()
            }

            // CRITICAL FIX: Update the field_name if it changed in GHL
            if (nameChanged) {
              updateData.field_name = freshField.name
              console.log(`📝 UPDATING FIELD NAME: "${extractionField.field_name}" → "${freshField.name}"`)
            }

            const { error: updateError } = await supabase
              .from('data_extraction_fields')
              .update(updateData)
              .eq('id', extractionField.id)

            if (updateError) {
              console.error(`Error updating field ${extractionField.field_name}:`, updateError)
            } else {
              console.log(`✅ Successfully updated stored data for: ${freshField.name}`)
              if (nameChanged) {
                console.log(`✅ Field name synchronized: "${extractionField.field_name}" → "${freshField.name}"`)
              }
              console.log(`🗂️ Stored parentId: ${completeFieldData.parentId}`)
            }
          } else {
            console.log(`⚠️ Field no longer exists in GHL: ${extractionField.field_name} (ID: ${extractionField.target_ghl_key})`)
            
            // Field was deleted from GHL - preserve the existing stored data
            if (!extractionField.original_ghl_field_data || Object.keys(extractionField.original_ghl_field_data).length === 0) {
              console.log(`❌ No stored data available for deleted field: ${extractionField.field_name}`)
            } else {
              console.log(`✅ Preserved stored data for deleted field: ${extractionField.field_name}`)
              console.log(`🗂️ Preserved parentId: ${extractionField.original_ghl_field_data.parentId}`)
            }
          }
        } catch (error) {
          console.error(`Error processing extraction field ${extractionField.field_name}:`, error)
        }
      })

      // Wait for all updates to complete
      await Promise.all(updatePromises)
      console.log('✅ Finished updating stored field data with name synchronization')

    } catch (error) {
      console.error('Error updating stored field data:', error)
    }
  }

  isTemporaryToken(token) {
    if (!token) return true
    return token.startsWith('temp-') || 
           token.startsWith('dev-') || 
           token.startsWith('test-') ||
           token === 'invalid-token'
  }
}