import { supabase } from './supabase'

export class ConfigurationService {
  constructor() {
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutes
  }

  // Get configuration using the optimized database function
  async getGHLConfiguration(userId, locationId) {
    const cacheKey = `${userId}-${locationId}`
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }
      this.cache.delete(cacheKey)
    }

    try {
      console.log('=== CONFIGURATION LOOKUP START ===')
      console.log('Parameters:', { userId, locationId })

      // Use the database function for optimized lookup
      const { data, error } = await supabase
        .rpc('get_user_ghl_configuration', {
          p_user_id: userId,
          p_location_id: locationId
        })

      if (error) {
        console.error('Database function error:', error)
        // Fallback to manual queries if function fails
        return await this.fallbackConfigurationLookup(userId, locationId)
      }

      if (data && data.length > 0) {
        const config = data[0]
        console.log('Configuration found via function:', {
          id: config.id,
          userId: config.user_id,
          locationId: config.ghl_account_id,
          hasTokens: !!(config.access_token && config.refresh_token)
        })

        // Cache the result
        this.cache.set(cacheKey, {
          data: config,
          timestamp: Date.now()
        })

        return config
      }

      console.log('No configuration found via function, trying fallback...')
      return await this.fallbackConfigurationLookup(userId, locationId)

    } catch (error) {
      console.error('Configuration lookup error:', error)
      return await this.fallbackConfigurationLookup(userId, locationId)
    }
  }

  // Fallback lookup method using direct queries
  async fallbackConfigurationLookup(userId, locationId) {
    console.log('=== FALLBACK CONFIGURATION LOOKUP ===')
    
    try {
      // Strategy 1: Try exact match
      console.log('Strategy 1: Exact match lookup')
      let { data, error } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', userId)
        .eq('ghl_account_id', locationId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('Exact match query error:', error)
      } else if (data) {
        console.log('Found exact match:', data.id)
        return data
      }

      // Strategy 2: Try by location only
      console.log('Strategy 2: Location-only lookup')
      const { data: locationData, error: locationError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('ghl_account_id', locationId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (locationError) {
        console.error('Location lookup error:', locationError)
      } else if (locationData) {
        console.log('Found by location:', locationData.id)
        
        // If found but no user_id, try to link it
        if (!locationData.user_id) {
          console.log('Attempting to link configuration to user...')
          const linkedConfig = await this.linkConfigurationToUser(locationData.id, userId)
          if (linkedConfig) {
            return linkedConfig
          }
        }
        
        return locationData
      }

      // Strategy 3: Try by user only
      console.log('Strategy 3: User-only lookup')
      const { data: userData, error: userError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (userError) {
        console.error('User lookup error:', userError)
      } else if (userData) {
        console.log('Found by user:', userData.id)
        return userData
      }

      console.log('No configuration found in any strategy')
      return null

    } catch (error) {
      console.error('Fallback lookup error:', error)
      return null
    }
  }

  // Link an existing configuration to a user
  async linkConfigurationToUser(configId, userId) {
    try {
      console.log('Linking configuration to user:', { configId, userId })
      
      const { data, error } = await supabase
        .from('ghl_configurations')
        .update({
          user_id: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', configId)
        .select()
        .single()

      if (error) {
        console.error('Failed to link configuration:', error)
        return null
      }

      console.log('Successfully linked configuration')
      return data

    } catch (error) {
      console.error('Link configuration error:', error)
      return null
    }
  }

  // Validate token status
  validateTokenStatus(config) {
    if (!config.access_token) {
      return {
        isValid: false,
        status: 'missing_access_token',
        message: 'Access token is missing',
        severity: 'error'
      }
    }
    
    if (!config.refresh_token) {
      return {
        isValid: false,
        status: 'missing_refresh_token', 
        message: 'Refresh token is missing',
        severity: 'error'
      }
    }
    
    if (config.token_expires_at) {
      const expiryDate = new Date(config.token_expires_at)
      const now = new Date()
      const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      if (hoursUntilExpiry < 0) {
        return {
          isValid: false,
          status: 'expired',
          message: 'Access token has expired',
          severity: 'warning'
        }
      } else if (hoursUntilExpiry < 24) {
        return {
          isValid: true,
          status: 'expiring_soon',
          message: `Token expires in ${Math.round(hoursUntilExpiry)} hours`,
          severity: 'info'
        }
      }
    }
    
    return {
      isValid: true,
      status: 'valid',
      message: 'Access token is valid',
      severity: 'success'
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear()
  }
}