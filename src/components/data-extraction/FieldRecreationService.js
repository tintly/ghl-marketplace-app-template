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
        throw new Error('No original field data available for recreation. This field cannot be recreated.')
      }

      console.log('Original field data:', originalData)

      // Debug the parent folder information
      this.debugParentFolderInfo(originalData)

      // Prepare field data for recreation with explicit parentId handling
      const fieldData = this.prepareFieldDataForRecreation(originalData)
      console.log('Prepared field data for GHL API:', fieldData)

      // Validate field data before recreation
      this.validateFieldData(fieldData)

      // Create the field in GoHighLevel with explicit parentId
      console.log('🔄 Creating field in GoHighLevel with parentId:', fieldData.parentId || 'root level')
      const recreatedField = await this.ghlApiService.createCustomField(locationId, fieldData)
      console.log('✅ Field recreated successfully in GHL:', recreatedField)

      // Verify the parentId was preserved
      this.verifyParentIdPreservation(originalData, recreatedField)

      return recreatedField
    } catch (error) {
      console.error('❌ Field recreation error:', error)
      throw new Error(`Failed to recreate field: ${error.message}`)
    }
  }

  /**
   * Debug parent folder information
   */
  debugParentFolderInfo(originalData) {
    console.log('=== PARENT FOLDER DEBUG ===')
    console.log('Original parentId:', originalData.parentId)
    console.log('Original fieldKey:', originalData.fieldKey)
    console.log('Original model:', originalData.model)
    console.log('Original objectId:', originalData.objectId)
    console.log('Original position:', originalData.position)
    
    if (originalData.parentId) {
      console.log('🗂️ Field was in folder with ID:', originalData.parentId)
    } else {
      console.log('🗂️ Field was at root level (no parent folder)')
    }
    console.log('=== END PARENT FOLDER DEBUG ===')
  }

  /**
   * Verify that parentId was preserved after recreation
   */
  verifyParentIdPreservation(originalData, recreatedField) {
    const originalParentId = originalData.parentId
    const newField = recreatedField.customField || recreatedField
    const newParentId = newField.parentId

    console.log('=== PARENT ID VERIFICATION ===')
    console.log('Original parentId:', originalParentId)
    console.log('New parentId:', newParentId)

    if (originalParentId && newParentId === originalParentId) {
      console.log('✅ SUCCESS: parentId preserved correctly')
    } else if (!originalParentId && !newParentId) {
      console.log('✅ SUCCESS: Root level placement preserved')
    } else {
      console.log('⚠️ WARNING: parentId mismatch!')
      console.log('Expected:', originalParentId || 'null (root level)')
      console.log('Actual:', newParentId || 'null (root level)')
    }
    console.log('=== END VERIFICATION ===')
  }

  /**
   * Prepare field data for recreation based on original GHL field data
   */
  prepareFieldDataForRecreation(originalData) {
    const fieldData = {
      name: originalData.name,
      dataType: originalData.dataType
    }

    // CRITICAL: Explicitly preserve the parent folder structure
    // This is the most important part for maintaining folder placement
    if (originalData.parentId) {
      fieldData.parentId = originalData.parentId
      console.log('🗂️ CRITICAL: Setting parentId to preserve folder placement:', originalData.parentId)
    } else {
      console.log('🗂️ INFO: No parentId - field will be created at root level')
      // Explicitly set to null to ensure it's not undefined
      fieldData.parentId = null
    }

    // Preserve position to maintain field ordering within the folder
    if (originalData.position !== undefined && originalData.position !== null) {
      fieldData.position = originalData.position
      console.log('📍 Preserving field position:', originalData.position)
    }

    // Add optional fields if they exist
    if (originalData.placeholder) {
      fieldData.placeholder = originalData.placeholder
    }

    // Preserve model information (contact, custom object, etc.)
    if (originalData.model) {
      fieldData.model = originalData.model
      console.log('📋 Preserving model type:', originalData.model)
    }

    // Preserve object-related IDs that might affect folder placement
    if (originalData.objectId) {
      fieldData.objectId = originalData.objectId
      console.log('🔗 Preserving objectId:', originalData.objectId)
    }

    if (originalData.objectSchemaId) {
      fieldData.objectSchemaId = originalData.objectSchemaId
      console.log('📊 Preserving objectSchemaId:', originalData.objectSchemaId)
    }

    // Handle picklist options for choice fields
    if (this.isChoiceField(originalData.dataType)) {
      const options = this.getFieldOptions(originalData)
      
      if (options.length === 0) {
        fieldData.picklistOptions = this.createDefaultOptions(originalData.dataType)
        console.log('⚠️ Created default options (no original options found):', fieldData.picklistOptions)
      } else {
        fieldData.picklistOptions = this.normalizeOptionsToStrings(options)
        console.log('✅ Using existing options:', fieldData.picklistOptions)
      }
    }

    // Handle file upload specific fields
    if (originalData.dataType === 'FILE_UPLOAD') {
      fieldData.acceptedFormats = originalData.acceptedFormats || '.pdf,.jpg,.png'
      fieldData.maxFileLimit = originalData.maxFileLimit || 1
    }

    // Log the final field data to verify parentId is included
    console.log('🔍 Final field data prepared for API call:', {
      name: fieldData.name,
      dataType: fieldData.dataType,
      parentId: fieldData.parentId,
      position: fieldData.position,
      model: fieldData.model,
      hasOptions: !!fieldData.picklistOptions
    })

    return fieldData
  }

  /**
   * Get field options from various possible sources in the original data
   */
  getFieldOptions(originalData) {
    const possibleSources = [
      originalData.picklistOptions,
      originalData.options,
      originalData.choices,
      originalData.values,
      originalData.textBoxListOptions
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
        const value = option.label || option.value || option.key || option.name || option.text
        return value ? String(value).trim() : `Option ${index + 1}`
      } else {
        return `Option ${index + 1}`
      }
    }).filter(Boolean)
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

    if (!fieldData.name || fieldData.name.trim().length === 0) {
      throw new Error('Field name cannot be empty')
    }

    // Validate that choice fields have options
    if (this.isChoiceField(fieldData.dataType)) {
      if (!fieldData.picklistOptions || !Array.isArray(fieldData.picklistOptions) || fieldData.picklistOptions.length === 0) {
        throw new Error(`Choice field type ${fieldData.dataType} requires at least one option`)
      }

      const invalidOptions = fieldData.picklistOptions.filter(opt => !opt || typeof opt !== 'string' || opt.trim() === '')
      if (invalidOptions.length > 0) {
        throw new Error(`All options must be non-empty strings. Found ${invalidOptions.length} invalid options`)
      }

      const uniqueOptions = [...new Set(fieldData.picklistOptions)]
      if (uniqueOptions.length !== fieldData.picklistOptions.length) {
        console.log('⚠️ Removing duplicate options from field')
        fieldData.picklistOptions = uniqueOptions
      }
    }

    // Validate parentId if present
    if (fieldData.parentId !== null && fieldData.parentId !== undefined) {
      if (typeof fieldData.parentId !== 'string' || fieldData.parentId.trim() === '') {
        console.log('⚠️ Invalid parentId detected, setting to null')
        fieldData.parentId = null
      } else {
        console.log('✅ Valid parentId found:', fieldData.parentId)
      }
    }

    console.log('✅ Field data validation passed')
    return true
  }

  /**
   * Debug function to log all available field metadata
   */
  debugFieldMetadata(originalData) {
    console.log('=== FIELD METADATA DEBUG ===')
    console.log('Available properties:', Object.keys(originalData))
    
    const importantProps = [
      'id', 'name', 'dataType', 'fieldKey', 'parentId', 'objectId', 
      'model', 'position', 'placeholder', 'picklistOptions', 'options',
      'objectSchemaId', 'standard', 'locationId', 'documentType'
    ]
    
    importantProps.forEach(prop => {
      if (originalData.hasOwnProperty(prop)) {
        console.log(`${prop}:`, originalData[prop])
      }
    })
    
    // Special attention to folder structure
    if (originalData.parentId) {
      console.log('🗂️ FOLDER STRUCTURE: Field belongs to folder/parent:', originalData.parentId)
    } else {
      console.log('🗂️ FOLDER STRUCTURE: Field is at root level (no parent)')
    }
    
    console.log('=== END METADATA DEBUG ===')
  }
}