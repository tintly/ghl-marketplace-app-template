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