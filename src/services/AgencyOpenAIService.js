export class AgencyOpenAIService {
  constructor(authService = null) {
    this.authService = authService
  }

  // Check if agency can use custom OpenAI keys
  async canUseCustomOpenAIKey(agencyId) {
    try {
      // If no agency ID, return false
      if (!agencyId) {
        console.log('No agency ID provided for OpenAI key permission check')
        return false
      }
      
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
      
      // For agency users, default to true if there's an error
      // This ensures agencies can use their keys even if the function fails
      if (this.authService?.getCurrentUser()?.type === 'agency') {
        console.log('Defaulting to true for agency user due to error')
        return true
      }
      
      return false
    }
  }

  // Check if user is on agency plan
  async isAgencyPlan() {
    try {
      const user = this.authService?.getCurrentUser()
      
      // If user is agency type, they're on agency plan
      if (user?.type === 'agency') {
        return true
      }
      
      return false
    } catch (error) {
      console.error('Agency OpenAI service error:', error)
      return false
    }
  }

  // Get agency's OpenAI keys
  async getAgencyOpenAIKeys(agencyId) {
    try {
      const supabase = await this.getSupabaseClient()
      
      if (!supabase) {
        throw new Error('Supabase client not available')
      }

      const { data, error } = await supabase
        .from('agency_openai_keys')
        .select('id, key_name, openai_org_id, usage_limit_monthly, current_usage_monthly, is_active, created_at, openai_model')
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
      if (!agencyId) {
        throw new Error('Agency ID is required')
      }
      
      // Skip permission check for agency users
      const user = this.authService?.getCurrentUser()
      const isAgency = user?.type === 'agency'
      
      if (!isAgency) {
        // Only check permissions for non-agency users
        const canUse = await this.canUseCustomOpenAIKey(agencyId)
        if (!canUse) {
          throw new Error('Your account does not have permission to use custom OpenAI keys')
        }
      }

      const supabase = await this.getSupabaseClient()
      
      if (!supabase) {
        console.error('Supabase client not available')
        throw new Error('Database connection not available')
      }

      // Encrypt the API key before storing (in production, use proper encryption)
      const encryptedKey = await this.encryptApiKey(keyData.api_key)

      console.log('Adding OpenAI key for agency:', agencyId)
      
      const { data, error } = await supabase
        .from('agency_openai_keys')
        .insert({
          agency_ghl_id: agencyId,
          encrypted_openai_api_key: encryptedKey,
          key_name: keyData.key_name || 'Default Key',
          openai_org_id: keyData.org_id || null,
          openai_model: keyData.openai_model || 'gpt-4o-mini',
          openai_model: keyData.openai_model || 'gpt-4o-mini',
          usage_limit_monthly: keyData.usage_limit || null,
          is_active: true
        })
        .select('id, key_name, openai_org_id, usage_limit_monthly, is_active, created_at, openai_model')
        .single()

      if (error) {
        console.error('Database error adding OpenAI key:', error)
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
      const supabase = await this.getSupabaseClient()
      
      if (!supabase) {
        console.error('Supabase client not available')
        throw new Error('Database connection not available')
      }

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
        .select('id, key_name, openai_org_id, usage_limit_monthly, is_active, created_at, openai_model')
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
      const supabase = await this.getSupabaseClient()
      
      if (!supabase) {
        console.error('Supabase client not available')
        throw new Error('Database connection not available')
      }

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
      const supabase = await this.getSupabaseClient()
      
      if (!supabase) {
        console.error('Supabase client not available')
        throw new Error('Database connection not available')
      }

      // Use the new database function to get usage statistics
      const { data, error } = await supabase
        .rpc('get_agency_usage_statistics', {
          agency_id: agencyId,
          timeframe: timeframe
        })

      if (error) {
        throw new Error(`Failed to fetch usage statistics: ${error.message}`)
      }

      // If no data, return empty stats
      if (!data) {
        return { 
          success: true, 
          data: {
            total_requests: 0,
            total_tokens: 0,
            total_cost: 0,
            by_model: {},
            by_key: {},
            daily_usage: {}
          } 
        }
      }

      return { success: true, data }
    } catch (error) {
      console.error('Error fetching usage statistics:', error)
      return { success: false, error: error.message, data: null }
    }
  }


  // Simple encryption for API keys (in production, use proper encryption service)
  async encryptApiKey(apiKey) {
    // This is a placeholder - in production, use proper encryption
    if (typeof btoa === 'function') {
      return btoa(apiKey);
    } else {
      // Use TextEncoder for environments without btoa
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      return Array.from(data)
        .map(byte => String.fromCharCode(byte))
        .join('');
    }
  }

  // Simple decryption for API keys (in production, use proper decryption service)
  async decryptApiKey(encryptedKey) {
    // This is a placeholder - in production, use proper decryption
    if (typeof atob === 'function') {
      return atob(encryptedKey);
    } else {
      // Use TextDecoder for environments without atob
      const charCodes = encryptedKey.split('').map(c => c.charCodeAt(0));
      const decoder = new TextDecoder();
      return decoder.decode(new Uint8Array(charCodes));
    }
  }
  
  // Helper method to get Supabase client
  async getSupabaseClient() {
    try {
      if (this.authService?.getSupabaseClient) {
        const client = await this.authService.getSupabaseClient()
        if (client) return client
      }
      
      return (await import('./supabase')).supabase
    } catch (error) {
      console.error('Error getting Supabase client:', error)
      return null
    }
  }
}