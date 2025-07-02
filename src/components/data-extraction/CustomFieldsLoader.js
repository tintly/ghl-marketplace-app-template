export default class CustomFieldsLoader {
  constructor(authService = null) {
    this.authService = authService
  }

  async loadFields(config) {
    try {
      // Always use mock data for temporary/dev/test tokens
      if (this.isTemporaryToken(config.access_token)) {
        console.log('Using mock data for temporary tokens')
        return this.getMockCustomFields()
      }

      const ghlService = new (await import('../../services/GHLApiService')).GHLApiService(config.access_token)
      const fields = await ghlService.getCustomFields(config.ghl_account_id)
      
      // Update stored field data for existing extraction fields
      await this.updateStoredFieldData(config.id, fields)
      
      return fields
    } catch (error) {
      console.error('Error loading custom fields:', error)
      console.log('Falling back to mock data due to API error')
      return this.getMockCustomFields()
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
    return token.startsWith('temp-') || 
           token.startsWith('dev-') || 
           token.startsWith('test-')
  }

  getMockCustomFields() {
    return [
      {
        id: "mock-text-field",
        name: "Customer Name",
        model: "contact",
        fieldKey: "contact.customer_name",
        placeholder: "Enter customer name",
        dataType: "TEXT",
        position: 50,
        standard: false,
        parentId: null
      },
      {
        id: "mock-phone-field",
        name: "Phone Number",
        model: "contact",
        fieldKey: "contact.phone_number",
        placeholder: "",
        dataType: "PHONE",
        position: 100,
        standard: false,
        parentId: null
      },
      {
        id: "mock-service-field",
        name: "Services Requested",
        model: "contact",
        fieldKey: "contact.services_requested",
        placeholder: "",
        dataType: "SINGLE_OPTIONS",
        position: 150,
        standard: false,
        picklistOptions: ["Window Tint", "Paint Protection Film", "Haircut"],
        parentId: "mock-folder-id"
      },
      {
        id: "mock-date-field",
        name: "Appointment Date",
        model: "contact",
        fieldKey: "contact.appointment_date",
        placeholder: "",
        dataType: "DATE",
        position: 200,
        standard: false,
        parentId: null
      },
      {
        id: "mock-priority-field",
        name: "Priority Level",
        model: "contact",
        fieldKey: "contact.priority_level",
        placeholder: "",
        dataType: "SINGLE_OPTIONS",
        position: 250,
        standard: false,
        picklistOptions: ["Low", "Medium", "High", "Urgent"],
        parentId: "mock-folder-id"
      }
    ]
  }
}