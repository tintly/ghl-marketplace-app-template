export class AgencyOpenAIService {
  constructor(authService = null) {
    this.authService = authService
  }

  // Check if agency can use custom OpenAI keys
  async canUseCustomOpenAIKey(agencyId) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { data, error } = await supabase
        .rpc('agency_can_use_custom_openai_key', {
          agency_id: agencyId
        })

      if (error) {
        console.error('Error checking OpenAI key permission:', error)
        return false
      }

      return data || false
    } catch (error) {
      console.error('Agency OpenAI service error:', error)
      return false
    }
  }

  // Get agency's OpenAI keys
  async getAgencyOpenAIKeys(agencyId) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { data, error } = await supabase
        .from('agency_openai_keys')
        .select('id, key_name, openai_org_id, usage_limit_monthly, current_usage_monthly, is_active, created_at')
        .eq('agency_ghl_id', agencyId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch OpenAI keys: ${error.message}`)
      }

      return { success: true, data: data || [] }
    } catch (error) {
      console.error('Error fetching agency OpenAI keys:', error)
      return { success: false, error: error.message, data: [] }
    }
  }

  // Add new OpenAI key for agency
  async addOpenAIKey(agencyId, keyData) {
    try {
      // First check if agency has permission
      const canUse = await this.canUseCustomOpenAIKey(agencyId)
      if (!canUse) {
        throw new Error('Agency does not have permission to use custom OpenAI keys')
      }

      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      // Encrypt the API key before storing (in production, use proper encryption)
      const encryptedKey = await this.encryptApiKey(keyData.api_key)

      const { data, error } = await supabase
        .from('agency_openai_keys')
        .insert({
          agency_ghl_id: agencyId,
          encrypted_openai_api_key: encryptedKey,
          key_name: keyData.key_name || 'Default Key',
          openai_org_id: keyData.org_id || null,
          usage_limit_monthly: keyData.usage_limit || null,
          is_active: true
        })
        .select('id, key_name, openai_org_id, usage_limit_monthly, is_active, created_at')
        .single()

      if (error) {
        throw new Error(`Failed to add OpenAI key: ${error.message}`)
      }

      return { success: true, data }
    } catch (error) {
      console.error('Error adding OpenAI key:', error)
      return { success: false, error: error.message }
    }
  }

  // Update OpenAI key
  async updateOpenAIKey(keyId, agencyId, updates) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const updateData = { ...updates }
      
      // If updating the API key, encrypt it
      if (updates.api_key) {
        updateData.encrypted_openai_api_key = await this.encryptApiKey(updates.api_key)
        delete updateData.api_key
      }

      const { data, error } = await supabase
        .from('agency_openai_keys')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', keyId)
        .eq('agency_ghl_id', agencyId)
        .select('id, key_name, openai_org_id, usage_limit_monthly, is_active, created_at')
        .single()

      if (error) {
        throw new Error(`Failed to update OpenAI key: ${error.message}`)
      }

      return { success: true, data }
    } catch (error) {
      console.error('Error updating OpenAI key:', error)
      return { success: false, error: error.message }
    }
  }

  // Delete OpenAI key
  async deleteOpenAIKey(keyId, agencyId) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { error } = await supabase
        .from('agency_openai_keys')
        .delete()
        .eq('id', keyId)
        .eq('agency_ghl_id', agencyId)

      if (error) {
        throw new Error(`Failed to delete OpenAI key: ${error.message}`)
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting OpenAI key:', error)
      return { success: false, error: error.message }
    }
  }

  // Get usage statistics for agency's OpenAI keys
  async getUsageStatistics(agencyId, timeframe = '30d') {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      let dateFilter = new Date()
      switch (timeframe) {
        case '7d':
          dateFilter.setDate(dateFilter.getDate() - 7)
          break
        case '30d':
          dateFilter.setDate(dateFilter.getDate() - 30)
          break
        case '90d':
          dateFilter.setDate(dateFilter.getDate() - 90)
          break
        default:
          dateFilter.setDate(dateFilter.getDate() - 30)
      }

      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('model, total_tokens, cost_estimate, created_at, openai_key_used')
        .eq('agency_ghl_id', agencyId)
        .gte('created_at', dateFilter.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch usage statistics: ${error.message}`)
      }

      // Process the data to create summary statistics
      const stats = this.processUsageData(data || [])

      return { success: true, data: stats }
    } catch (error) {
      console.error('Error fetching usage statistics:', error)
      return { success: false, error: error.message, data: null }
    }
  }

  // Process usage data into summary statistics
  processUsageData(usageData) {
    const summary = {
      total_requests: usageData.length,
      total_tokens: 0,
      total_cost: 0,
      by_model: {},
      by_key: {},
      daily_usage: {}
    }

    usageData.forEach(log => {
      summary.total_tokens += log.total_tokens || 0
      summary.total_cost += parseFloat(log.cost_estimate || 0)

      // By model
      if (!summary.by_model[log.model]) {
        summary.by_model[log.model] = { requests: 0, tokens: 0, cost: 0 }
      }
      summary.by_model[log.model].requests++
      summary.by_model[log.model].tokens += log.total_tokens || 0
      summary.by_model[log.model].cost += parseFloat(log.cost_estimate || 0)

      // By key
      const keyUsed = log.openai_key_used || 'default'
      if (!summary.by_key[keyUsed]) {
        summary.by_key[keyUsed] = { requests: 0, tokens: 0, cost: 0 }
      }
      summary.by_key[keyUsed].requests++
      summary.by_key[keyUsed].tokens += log.total_tokens || 0
      summary.by_key[keyUsed].cost += parseFloat(log.cost_estimate || 0)

      // Daily usage
      const date = new Date(log.created_at).toISOString().split('T')[0]
      if (!summary.daily_usage[date]) {
        summary.daily_usage[date] = { requests: 0, tokens: 0, cost: 0 }
      }
      summary.daily_usage[date].requests++
      summary.daily_usage[date].tokens += log.total_tokens || 0
      summary.daily_usage[date].cost += parseFloat(log.cost_estimate || 0)
    })

    return summary
  }

  // Simple encryption for API keys (in production, use proper encryption service)
  async encryptApiKey(apiKey) {
    // This is a placeholder - in production, use proper encryption
    // You should use a proper encryption service or library
    return btoa(apiKey) // Base64 encoding as placeholder
  }

  // Simple decryption for API keys (in production, use proper decryption service)
  async decryptApiKey(encryptedKey) {
    // This is a placeholder - in production, use proper decryption
    try {
      return atob(encryptedKey) // Base64 decoding as placeholder
    } catch (error) {
      console.error('Error decrypting API key:', error)
      return null
    }
  }
}