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
      
      const endpoint = `/locations/${locationId}/customFields`
      
      // Prepare the payload for GHL API
      const payload = {
        name: fieldData.name,
        dataType: fieldData.dataType,
        model: fieldData.model || 'contact',
        fieldKey: fieldData.fieldKey,
        placeholder: fieldData.placeholder || '',
        position: fieldData.position || 100
      }

      // Add parentId if provided (for folder organization)
      if (fieldData.parentId) {
        payload.parentId = fieldData.parentId
      }

      // Add picklist options for choice fields
      if (fieldData.picklistOptions && fieldData.picklistOptions.length > 0) {
        payload.picklistOptions = fieldData.picklistOptions
      }

      console.log('GHL API payload:', payload)

      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: payload
      })

      console.log('Custom field created successfully:', response)
      return response
    } catch (error) {
      console.error('Error creating custom field:', error)
      throw new Error(`Failed to create custom field in GoHighLevel: ${error.message}`)
    }
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