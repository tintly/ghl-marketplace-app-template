export class FieldRecreationService {
  constructor(ghlApiService) {
    this.ghlApiService = ghlApiService
  }

  /**
   * Recreate a custom field in GoHighLevel from stored data
   */
  async recreateField(locationId, extractionField) {
    try {
      console.log('=== FIELD RECREATION START ===')
      console.log('Extraction field:', extractionField)

      const originalData = extractionField.original_ghl_field_data
      if (!originalData || Object.keys(originalData).length === 0) {
        throw new Error('No original field data available for recreation')
      }

      console.log('Original field data:', originalData)

      // Prepare field data for recreation
      const fieldData = this.prepareFieldDataForRecreation(originalData)
      console.log('Prepared field data for GHL API:', fieldData)

      // Validate field data before recreation
      this.validateFieldData(fieldData)

      // Create the field in GoHighLevel
      console.log('🔄 Creating field in GoHighLevel...')
      const recreatedField = await this.ghlApiService.createCustomField(locationId, fieldData)
      console.log('✅ Field recreated successfully in GHL:', recreatedField)

      // Return the complete response with the new field ID
      return recreatedField
    } catch (error) {
      console.error('❌ Field recreation error:', error)
      throw new Error(`Failed to recreate field: ${error.message}`)
    }
  }

  /**
   * Prepare field data for recreation based on original GHL field data
   */
  prepareFieldDataForRecreation(originalData) {
    const fieldData = {
      name: originalData.name,
      dataType: originalData.dataType
    }

    // CRITICAL FIX: Preserve the parent folder structure
    if (originalData.parentId) {
      fieldData.parentId = originalData.parentId
      console.log('✅ Preserving parent folder ID:', originalData.parentId)
    }

    // Add optional fields if they exist
    if (originalData.placeholder) {
      fieldData.placeholder = originalData.placeholder
    }

    if (originalData.position !== undefined) {
      fieldData.position = originalData.position
    }

    // Preserve field key structure if available
    if (originalData.fieldKey) {
      // Extract the field name part from the key for reference
      const keyParts = originalData.fieldKey.split('.')
      if (keyParts.length > 1) {
        console.log('Original field key structure:', originalData.fieldKey)
        // Note: GHL will generate a new fieldKey, but we log the original for reference
      }
    }

    // Handle picklist options for choice fields
    if (this.isChoiceField(originalData.dataType)) {
      const options = this.getFieldOptions(originalData)
      
      if (options.length === 0) {
        // If no options are available, create default options
        fieldData.picklistOptions = this.createDefaultOptions(originalData.dataType)
        console.log('⚠️ Created default options for field (no original options found):', fieldData.picklistOptions)
      } else {
        // Normalize options to simple string array for GHL API
        fieldData.picklistOptions = this.normalizeOptionsToStrings(options)
        console.log('✅ Using existing options for field:', fieldData.picklistOptions)
      }
    }

    // Handle file upload specific fields
    if (originalData.dataType === 'FILE_UPLOAD') {
      fieldData.acceptedFormats = originalData.acceptedFormats || '.pdf,.jpg,.png'
      fieldData.maxFileLimit = originalData.maxFileLimit || 1
    }

    // Preserve any custom object information
    if (originalData.model && originalData.model !== 'contact') {
      fieldData.model = originalData.model
      console.log('✅ Preserving model type:', originalData.model)
    }

    // Preserve any additional metadata that might affect folder placement
    if (originalData.objectId) {
      fieldData.objectId = originalData.objectId
      console.log('✅ Preserving object ID:', originalData.objectId)
    }

    return fieldData
  }

  /**
   * Get field options from various possible sources in the original data
   */
  getFieldOptions(originalData) {
    // Try multiple possible option sources
    const possibleSources = [
      originalData.picklistOptions,
      originalData.options,
      originalData.choices,
      originalData.values,
      originalData.textBoxListOptions // For TEXTBOX_LIST fields
    ]

    for (const source of possibleSources) {
      if (Array.isArray(source) && source.length > 0) {
        console.log('Found options in source:', source)
        return source
      }
    }

    console.log('⚠️ No options found in any source for choice field')
    return []
  }

  /**
   * Create default options for choice fields when none are available
   */
  createDefaultOptions(dataType) {
    const defaultOptions = {
      'SINGLE_OPTIONS': ['Yes', 'No', 'Maybe'],
      'MULTIPLE_OPTIONS': ['Option A', 'Option B', 'Option C'],
      'CHECKBOX': ['Yes', 'No'],
      'RADIO': ['Option 1', 'Option 2', 'Option 3'],
      'TEXTBOX_LIST': ['Item 1', 'Item 2', 'Item 3']
    }

    return defaultOptions[dataType] || ['Option 1', 'Option 2', 'Option 3']
  }

  /**
   * Check if field type requires choice options
   */
  isChoiceField(dataType) {
    return ['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS', 'CHECKBOX', 'RADIO', 'TEXTBOX_LIST'].includes(dataType)
  }

  /**
   * Normalize picklist options to simple string array for GHL API
   */
  normalizeOptionsToStrings(options) {
    if (!Array.isArray(options)) return []

    return options.map((option, index) => {
      if (typeof option === 'string') {
        return option.trim()
      } else if (option && typeof option === 'object') {
        // Handle different object structures
        const value = option.label || option.value || option.key || option.name || option.text
        return value ? String(value).trim() : `Option ${index + 1}`
      } else {
        return `Option ${index + 1}`
      }
    }).filter(Boolean) // Remove any empty values
  }

  /**
   * Validate that field data is complete for recreation
   */
  validateFieldData(fieldData) {
    const required = ['name', 'dataType']
    const missing = required.filter(field => !fieldData[field])
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields for recreation: ${missing.join(', ')}`)
    }

    // Validate field name
    if (!fieldData.name || fieldData.name.trim().length === 0) {
      throw new Error('Field name cannot be empty')
    }

    // Validate that choice fields have options
    if (this.isChoiceField(fieldData.dataType)) {
      if (!fieldData.picklistOptions || !Array.isArray(fieldData.picklistOptions) || fieldData.picklistOptions.length === 0) {
        throw new Error(`Choice field type ${fieldData.dataType} requires at least one option`)
      }

      // Ensure all options are valid strings
      const invalidOptions = fieldData.picklistOptions.filter(opt => !opt || typeof opt !== 'string' || opt.trim() === '')
      if (invalidOptions.length > 0) {
        throw new Error(`All options must be non-empty strings. Found ${invalidOptions.length} invalid options`)
      }

      // Check for duplicate options
      const uniqueOptions = [...new Set(fieldData.picklistOptions)]
      if (uniqueOptions.length !== fieldData.picklistOptions.length) {
        console.log('⚠️ Removing duplicate options from field')
        fieldData.picklistOptions = uniqueOptions
      }
    }

    console.log('✅ Field data validation passed')
    return true
  }

  /**
   * Get field type compatibility info
   */
  getFieldTypeInfo(dataType) {
    const supportedTypes = [
      'TEXT', 'LARGE_TEXT', 'NUMERICAL', 'PHONE', 'MONETORY', 
      'CHECKBOX', 'SINGLE_OPTIONS', 'MULTIPLE_OPTIONS', 'DATE', 
      'TEXTBOX_LIST', 'FILE_UPLOAD', 'RADIO', 'EMAIL'
    ]

    return {
      isSupported: supportedTypes.includes(dataType),
      dataType,
      requiresOptions: this.isChoiceField(dataType)
    }
  }

  /**
   * Extract the new field ID from the GHL API response
   */
  extractNewFieldId(response) {
    // Handle different response structures from GHL API
    if (response.customField && response.customField.id) {
      return response.customField.id
    }
    
    if (response.id) {
      return response.id
    }
    
    if (response.data && response.data.id) {
      return response.data.id
    }
    
    console.error('Could not extract field ID from response:', response)
    throw new Error('Unable to extract new field ID from GoHighLevel response')
  }

  /**
   * Debug function to log all available field metadata
   */
  debugFieldMetadata(originalData) {
    console.log('=== FIELD METADATA DEBUG ===')
    console.log('Available properties:', Object.keys(originalData))
    
    const importantProps = [
      'id', 'name', 'dataType', 'fieldKey', 'parentId', 'objectId', 
      'model', 'position', 'placeholder', 'picklistOptions', 'options'
    ]
    
    importantProps.forEach(prop => {
      if (originalData.hasOwnProperty(prop)) {
        console.log(`${prop}:`, originalData[prop])
      }
    })
    
    console.log('=== END METADATA DEBUG ===')
  }
}