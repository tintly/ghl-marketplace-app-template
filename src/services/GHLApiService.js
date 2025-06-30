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
      console.log('Creating custom field in GHL:', { locationId, fieldData })
      
      // Determine which API endpoint to use based on the field type
      const isCustomObject = fieldData.fieldKey && fieldData.fieldKey.startsWith('custom_object.')
      
      if (isCustomObject) {
        return await this.createCustomObjectField(locationId, fieldData)
      } else {
        return await this.createContactField(locationId, fieldData)
      }
    } catch (error) {
      console.error('Error creating custom field:', error)
      throw new Error(`Failed to create custom field in GoHighLevel: ${error.message}`)
    }
  }

  async createCustomObjectField(locationId, fieldData) {
    console.log('Creating custom object field using /custom-fields/ endpoint')
    
    const endpoint = `/custom-fields/`
    
    // Prepare the payload according to the custom objects API specification
    const payload = {
      locationId: locationId,
      name: fieldData.name,
      dataType: fieldData.dataType,
      showInForms: true, // Required field
      fieldKey: fieldData.fieldKey,
      objectKey: fieldData.objectKey || 'contact'
    }

    // Add optional fields if provided
    if (fieldData.description) {
      payload.description = fieldData.description
    }

    if (fieldData.placeholder) {
      payload.placeholder = fieldData.placeholder
    }

    if (fieldData.parentId) {
      payload.parentId = fieldData.parentId
    }

    // Add options for choice fields
    if (fieldData.picklistOptions && fieldData.picklistOptions.length > 0) {
      payload.options = fieldData.picklistOptions.map((option) => ({
        key: typeof option === 'string' ? option.toLowerCase().replace(/\s+/g, '_') : option.key,
        label: typeof option === 'string' ? option : option.label
      }))
    }

    // Add specific fields for certain data types
    if (fieldData.dataType === 'FILE_UPLOAD') {
      payload.acceptedFormats = fieldData.acceptedFormats || '.pdf'
      payload.maxFileLimit = fieldData.maxFileLimit || 1
    }

    if (fieldData.dataType === 'RADIO') {
      payload.allowCustomOption = fieldData.allowCustomOption || false
    }

    console.log('Custom object field payload:', payload)

    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      body: payload
    })

    console.log('Custom object field created successfully:', response)
    return response
  }

  async createContactField(locationId, fieldData) {
    console.log('Creating contact field using /locations/{locationId}/customFields endpoint')
    
    const endpoint = `/locations/${locationId}/customFields`
    
    // Prepare the payload according to the contact fields API specification
    const payload = {
      name: fieldData.name,
      dataType: fieldData.dataType,
      model: 'contact' // Required for contact fields
    }

    // Add optional fields if provided
    if (fieldData.placeholder) {
      payload.placeholder = fieldData.placeholder
    }

    // Add position if specified
    if (fieldData.position !== undefined) {
      payload.position = fieldData.position
    }

    // Handle picklist options for choice fields
    if (this.isChoiceField(fieldData.dataType) && fieldData.picklistOptions && fieldData.picklistOptions.length > 0) {
      if (fieldData.dataType === 'TEXTBOX_LIST') {
        // For TEXTBOX_LIST, use textBoxListOptions
        payload.textBoxListOptions = fieldData.picklistOptions.map((option, index) => ({
          label: typeof option === 'string' ? option : option.label,
          prefillValue: '',
          position: index
        }))
      } else {
        // For other choice fields, this might not be supported in the contact fields API
        console.warn('Picklist options may not be supported for contact fields of type:', fieldData.dataType)
      }
    }

    // Handle file upload specific fields
    if (fieldData.dataType === 'FILE_UPLOAD') {
      payload.acceptedFormat = fieldData.acceptedFormats ? 
        fieldData.acceptedFormats.split(',').map(f => f.trim()) : 
        ['.pdf']
      payload.isMultipleFile = fieldData.maxFileLimit > 1
      payload.maxNumberOfFiles = fieldData.maxFileLimit || 1
    }

    console.log('Contact field payload:', payload)

    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      body: payload
    })

    console.log('Contact field created successfully:', response)
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

      // Add picklist options for choice fields
      if (fieldData.picklistOptions && fieldData.picklistOptions.length > 0) {
        payload.picklistOptions = fieldData.picklistOptions
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