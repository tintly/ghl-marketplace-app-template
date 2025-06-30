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
      console.log('Prepared field data:', fieldData)

      // Validate field data before recreation
      this.validateFieldData(fieldData)

      // Create the field in GoHighLevel
      const recreatedField = await this.ghlApiService.createCustomField(locationId, fieldData)
      console.log('Field recreated successfully:', recreatedField)

      return recreatedField
    } catch (error) {
      console.error('Field recreation error:', error)
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

    // Add optional fields if they exist
    if (originalData.placeholder) {
      fieldData.placeholder = originalData.placeholder
    }

    if (originalData.position !== undefined) {
      fieldData.position = originalData.position
    }

    // Handle picklist options for choice fields - CRITICAL FIX
    if (this.isChoiceField(originalData.dataType)) {
      const options = this.getFieldOptions(originalData)
      
      if (options.length === 0) {
        // If no options are available, create default options
        fieldData.picklistOptions = this.createDefaultOptions(originalData.dataType)
        console.log('Created default options for field:', fieldData.picklistOptions)
      } else {
        // Normalize options to simple string array for GHL API
        fieldData.picklistOptions = this.normalizeOptionsToStrings(options)
        console.log('Using existing options for field:', fieldData.picklistOptions)
      }
    }

    // Handle file upload specific fields
    if (originalData.dataType === 'FILE_UPLOAD') {
      fieldData.acceptedFormats = originalData.acceptedFormats || '.pdf,.jpg,.png'
      fieldData.maxFileLimit = originalData.maxFileLimit || 1
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
      originalData.values
    ]

    for (const source of possibleSources) {
      if (Array.isArray(source) && source.length > 0) {
        return source
      }
    }

    return []
  }

  /**
   * Create default options for choice fields when none are available
   */
  createDefaultOptions(dataType) {
    const defaultOptions = {
      'SINGLE_OPTIONS': ['Option 1', 'Option 2', 'Option 3'],
      'MULTIPLE_OPTIONS': ['Choice A', 'Choice B', 'Choice C'],
      'CHECKBOX': ['Yes', 'No'],
      'RADIO': ['Option 1', 'Option 2'],
      'TEXTBOX_LIST': ['Item 1', 'Item 2']
    }

    return defaultOptions[dataType] || ['Option 1', 'Option 2']
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
        return option
      } else if (option && typeof option === 'object') {
        return option.label || option.value || option.key || `Option ${index + 1}`
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

    // Validate that choice fields have options
    if (this.isChoiceField(fieldData.dataType)) {
      if (!fieldData.picklistOptions || !Array.isArray(fieldData.picklistOptions) || fieldData.picklistOptions.length === 0) {
        throw new Error(`Choice field type ${fieldData.dataType} requires at least one option`)
      }

      // Ensure all options are valid strings
      const invalidOptions = fieldData.picklistOptions.filter(opt => !opt || typeof opt !== 'string' || opt.trim() === '')
      if (invalidOptions.length > 0) {
        throw new Error(`All options must be non-empty strings. Found invalid options: ${invalidOptions.length}`)
      }
    }

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
}