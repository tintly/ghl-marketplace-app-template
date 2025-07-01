export class GHLApiService {
  constructor(accessToken) {
    this.accessToken = accessToken
    this.baseUrl = 'https://services.leadconnectorhq.com'
    this.version = '2021-07-28'
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Version': this.version,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }

    const config = {
      method: options.method || 'GET',
      headers,
      ...options
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    const response = await fetch(url, config)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GHL API Error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  async getCustomFields(locationId, model = 'contact') {
    try {
      const endpoint = `/locations/${locationId}/customFields`
      const params = new URLSearchParams({ model })
      
      const response = await this.makeRequest(`${endpoint}?${params}`)
      return response.customFields || []
    } catch (error) {
      console.error('Error fetching custom fields:', error)
      throw new Error('Failed to fetch custom fields from GoHighLevel')
    }
  }

  async createCustomField(locationId, fieldData) {
    try {
      console.log('=== GHL API: CREATING CUSTOM FIELD ===')
      console.log('Location ID:', locationId)
      console.log('Field Data:', fieldData)
      
      // Always use the contact fields endpoint for now
      return await this.createContactField(locationId, fieldData)
    } catch (error) {
      console.error('Error creating custom field:', error)
      throw new Error(`Failed to create custom field in GoHighLevel: ${error.message}`)
    }
  }

  async createContactField(locationId, fieldData) {
    console.log('=== CREATING CONTACT FIELD ===')
    console.log('Using endpoint: /locations/{locationId}/customFields')
    
    const endpoint = `/locations/${locationId}/customFields`
    
    // Prepare the payload according to the contact fields API specification
    const payload = {
      name: fieldData.name,
      dataType: fieldData.dataType,
      model: fieldData.model || 'contact' // Default to contact if not specified
    }

    // CRITICAL: Include parentId to preserve folder structure
    if (fieldData.parentId !== null && fieldData.parentId !== undefined) {
      payload.parentId = fieldData.parentId
      console.log('🗂️ CRITICAL: Including parentId in API payload:', fieldData.parentId)
    } else {
      console.log('🗂️ INFO: No parentId - field will be created at root level')
    }

    // Add optional fields if provided
    if (fieldData.placeholder) {
      payload.placeholder = fieldData.placeholder
    }

    // Add position if specified
    if (fieldData.position !== undefined && fieldData.position !== null) {
      payload.position = fieldData.position
      console.log('📍 Including position in API payload:', fieldData.position)
    }

    // Add object-related fields that might affect folder placement
    if (fieldData.objectId) {
      payload.objectId = fieldData.objectId
      console.log('🔗 Including objectId in API payload:', fieldData.objectId)
    }

    if (fieldData.objectSchemaId) {
      payload.objectSchemaId = fieldData.objectSchemaId
      console.log('📊 Including objectSchemaId in API payload:', fieldData.objectSchemaId)
    }

    // Handle different field types with their specific requirements
    if (this.isChoiceField(fieldData.dataType)) {
      if (!fieldData.picklistOptions || !Array.isArray(fieldData.picklistOptions) || fieldData.picklistOptions.length === 0) {
        throw new Error(`Field type ${fieldData.dataType} requires at least one option`)
      }

      // Handle different choice field types
      switch (fieldData.dataType) {
        case 'TEXTBOX_LIST':
          // For TEXTBOX_LIST, use textBoxListOptions
          payload.textBoxListOptions = fieldData.picklistOptions.map((option, index) => ({
            label: typeof option === 'string' ? option : (option.label || `Option ${index + 1}`),
            prefillValue: '',
            position: index
          }))
          console.log('📋 Using textBoxListOptions for TEXTBOX_LIST field')
          break

        case 'SINGLE_OPTIONS':
        case 'MULTIPLE_OPTIONS':
          // For choice fields, use options array (not picklistOptions)
          payload.options = fieldData.picklistOptions.map(option => 
            typeof option === 'string' ? option : (option.label || option.key || 'Option')
          )
          console.log('🔘 Using options array for choice field')
          break

        case 'CHECKBOX':
          // For checkbox, use options
          payload.options = fieldData.picklistOptions.map(option => 
            typeof option === 'string' ? option : (option.label || option.key || 'Option')
          )
          console.log('✅ Using options array for checkbox field')
          break

        case 'RADIO':
          // For radio buttons, use options
          payload.options = fieldData.picklistOptions.map(option => 
            typeof option === 'string' ? option : (option.label || option.key || 'Option')
          )
          console.log('🔘 Using options array for radio field')
          break

        default:
          console.warn('Unknown choice field type:', fieldData.dataType)
          payload.options = fieldData.picklistOptions.map(option => 
            typeof option === 'string' ? option : (option.label || option.key || 'Option')
          )
      }
    }

    // Remove any properties that shouldn't be there
    delete payload.picklistOptions

    console.log('=== FINAL API PAYLOAD ===')
    console.log('Payload being sent to GHL:', JSON.stringify(payload, null, 2))
    console.log('Key fields for folder placement:')
    console.log('- parentId:', payload.parentId)
    console.log('- position:', payload.position)
    console.log('- model:', payload.model)
    console.log('- objectId:', payload.objectId)
    console.log('=== END PAYLOAD DEBUG ===')

    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      body: payload
    })

    console.log('=== GHL API RESPONSE ===')
    console.log('Field created successfully:', response)
    
    // Log the parentId in the response to verify it was preserved
    const createdField = response.customField || response
    if (createdField.parentId) {
      console.log('✅ SUCCESS: Response contains parentId:', createdField.parentId)
    } else {
      console.log('⚠️ WARNING: Response does not contain parentId - field may be at root level')
    }
    console.log('=== END API RESPONSE ===')
    
    return response
  }

  isChoiceField(dataType) {
    return ['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS', 'CHECKBOX', 'RADIO', 'TEXTBOX_LIST'].includes(dataType)
  }

  async updateCustomField(locationId, fieldId, fieldData) {
    try {
      console.log('Updating custom field in GHL:', { locationId, fieldId, fieldData })
      
      const endpoint = `/locations/${locationId}/customFields/${fieldId}`
      
      const payload = {
        name: fieldData.name,
        placeholder: fieldData.placeholder || '',
        position: fieldData.position
      }

      // CRITICAL: Include parentId when updating to preserve folder structure
      if (fieldData.parentId !== null && fieldData.parentId !== undefined) {
        payload.parentId = fieldData.parentId
        console.log('🗂️ Including parentId in update payload:', fieldData.parentId)
      }

      // For choice fields, use options instead of picklistOptions
      if (this.isChoiceField(fieldData.dataType) && fieldData.picklistOptions && fieldData.picklistOptions.length > 0) {
        payload.options = fieldData.picklistOptions.map(option => 
          typeof option === 'string' ? option : (option.label || option.key || 'Option')
        )
      }

      const response = await this.makeRequest(endpoint, {
        method: 'PUT',
        body: payload
      })

      console.log('Custom field updated successfully:', response)
      return response
    } catch (error) {
      console.error('Error updating custom field:', error)
      throw new Error(`Failed to update custom field in GoHighLevel: ${error.message}`)
    }
  }

  async deleteCustomField(locationId, fieldId) {
    try {
      console.log('Deleting custom field in GHL:', { locationId, fieldId })
      
      const endpoint = `/locations/${locationId}/customFields/${fieldId}`
      
      const response = await this.makeRequest(endpoint, {
        method: 'DELETE'
      })

      console.log('Custom field deleted successfully')
      return response
    } catch (error) {
      console.error('Error deleting custom field:', error)
      throw new Error(`Failed to delete custom field in GoHighLevel: ${error.message}`)
    }
  }

  async getContact(contactId) {
    try {
      const endpoint = `/contacts/${contactId}`
      return await this.makeRequest(endpoint)
    } catch (error) {
      console.error('Error fetching contact:', error)
      throw new Error('Failed to fetch contact from GoHighLevel')
    }
  }

  async updateContact(contactId, data) {
    try {
      const endpoint = `/contacts/${contactId}`
      return await this.makeRequest(endpoint, {
        method: 'PUT',
        body: data
      })
    } catch (error) {
      console.error('Error updating contact:', error)
      throw new Error('Failed to update contact in GoHighLevel')
    }
  }

  async getConversations(locationId, options = {}) {
    try {
      const params = new URLSearchParams({
        locationId,
        ...options
      })
      
      const endpoint = `/conversations/search?${params}`
      return await this.makeRequest(endpoint)
    } catch (error) {
      console.error('Error fetching conversations:', error)
      throw new Error('Failed to fetch conversations from GoHighLevel')
    }
  }
}