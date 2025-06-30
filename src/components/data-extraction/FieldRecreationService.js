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

    // For custom objects, add the required fields
    if (originalData.fieldKey && originalData.fieldKey.startsWith('custom_object.')) {
      fieldData.fieldKey = originalData.fieldKey
      fieldData.objectKey = this.extractObjectKey(originalData.fieldKey)
      fieldData.showInForms = true

      if (originalData.description) {
        fieldData.description = originalData.description
      }

      if (originalData.parentId) {
        fieldData.parentId = originalData.parentId
      }
    }

    // Handle picklist options for choice fields
    if (this.isChoiceField(originalData.dataType) && originalData.picklistOptions) {
      fieldData.picklistOptions = this.normalizePicklistOptions(originalData.picklistOptions)
    }

    // Handle file upload specific fields
    if (originalData.dataType === 'FILE_UPLOAD') {
      fieldData.acceptedFormats = originalData.acceptedFormats || '.pdf,.jpg,.png'
      fieldData.maxFileLimit = originalData.maxFileLimit || 1
    }

    // Handle radio button specific fields
    if (originalData.dataType === 'RADIO') {
      fieldData.allowCustomOption = originalData.allowCustomOption || false
    }

    return fieldData
  }

  /**
   * Extract object key from field key
   */
  extractObjectKey(fieldKey) {
    if (!fieldKey) return 'contact'
    
    // For custom objects: "custom_object.pet.name" -> "custom_object.pet"
    if (fieldKey.startsWith('custom_object.')) {
      const parts = fieldKey.split('.')
      if (parts.length >= 3) {
        return `${parts[0]}.${parts[1]}`
      }
    }
    
    // For standard objects: "contact.field_name" -> "contact"
    const parts = fieldKey.split('.')
    return parts[0] || 'contact'
  }

  /**
   * Check if field type requires choice options
   */
  isChoiceField(dataType) {
    return ['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS', 'CHECKBOX', 'RADIO', 'TEXTBOX_LIST'].includes(dataType)
  }

  /**
   * Normalize picklist options to the format expected by GHL API
   */
  normalizePicklistOptions(options) {
    if (!Array.isArray(options)) return []

    return options.map((option, index) => {
      if (typeof option === 'string') {
        return {
          key: option.toLowerCase().replace(/\s+/g, '_'),
          label: option
        }
      } else if (option && typeof option === 'object') {
        return {
          key: option.key || option.value || `option_${index}`,
          label: option.label || option.value || option.key || `Option ${index + 1}`
        }
      } else {
        return {
          key: `option_${index}`,
          label: `Option ${index + 1}`
        }
      }
    })
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

    // For custom objects, validate additional required fields
    if (fieldData.fieldKey && fieldData.fieldKey.startsWith('custom_object.')) {
      const customObjectRequired = ['fieldKey', 'objectKey']
      const customObjectMissing = customObjectRequired.filter(field => !fieldData[field])
      
      if (customObjectMissing.length > 0) {
        throw new Error(`Missing required custom object fields: ${customObjectMissing.join(', ')}`)
      }

      // Validate field key format
      if (!this.isValidFieldKey(fieldData.fieldKey)) {
        throw new Error(`Invalid field key format: ${fieldData.fieldKey}`)
      }
    }

    return true
  }

  /**
   * Validate field key format
   */
  isValidFieldKey(fieldKey) {
    if (!fieldKey || typeof fieldKey !== 'string') return false
    
    // Should contain at least one dot
    if (!fieldKey.includes('.')) return false
    
    // Should not start or end with dot
    if (fieldKey.startsWith('.') || fieldKey.endsWith('.')) return false
    
    return true
  }

  /**
   * Determine if a field should be recreated as a custom object or contact field
   */
  isCustomObjectField(originalData) {
    return originalData.fieldKey && originalData.fieldKey.startsWith('custom_object.')
  }

  /**
   * Get field type compatibility info
   */
  getFieldTypeInfo(dataType) {
    const contactFieldTypes = [
      'TEXT', 'LARGE_TEXT', 'NUMERICAL', 'PHONE', 'MONETORY', 
      'CHECKBOX', 'SINGLE_OPTIONS', 'MULTIPLE_OPTIONS', 'DATE', 
      'TEXTBOX_LIST', 'FILE_UPLOAD', 'RADIO', 'EMAIL'
    ]

    const customObjectTypes = [
      'TEXT', 'LARGE_TEXT', 'NUMERICAL', 'SINGLE_OPTIONS', 
      'MULTIPLE_OPTIONS', 'CHECKBOX', 'RADIO', 'DATE', 
      'TEXTBOX_LIST', 'FILE_UPLOAD'
    ]

    return {
      supportsContact: contactFieldTypes.includes(dataType),
      supportsCustomObject: customObjectTypes.includes(dataType),
      dataType
    }
  }
}