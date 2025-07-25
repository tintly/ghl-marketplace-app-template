export class DatabaseService {
  // Check if a configuration exists for the given user and location
  static async checkConfigurationExists(userId, locationId, authService = null) {
    try {
      console.log('=== DATABASE SERVICE: CHECK EXISTS ===')
      console.log('Parameters:', { userId, locationId })

      // Get the appropriate Supabase client
      let supabase
      try {
        if (authService?.getSupabaseClient) {
          supabase = authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

      const { data, error } = await supabase
        .from('ghl_configurations')
        .select('id, user_id, ghl_account_id, business_name, access_token, refresh_token')
        .eq('user_id', userId)
        .eq('ghl_account_id', locationId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('Error checking configuration:', error)
        return { exists: false, error: error.message }
      }

      console.log('Check result:', { exists: !!data, configId: data?.id })
      return { 
        exists: !!data, 
        config: data,
        error: null 
      }
    } catch (error) {
      console.error('Database check error:', error)
      return { exists: false, error: error.message }
    }
  }

  // Get all configurations for debugging (with limited fields for security)
  static async getAllConfigurations(authService = null) {
    try {
      console.log('=== DATABASE SERVICE: GET ALL CONFIGS ===')

      let supabase
      try {
        if (authService?.getSupabaseClient) {
          supabase = authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

      const { data, error } = await supabase
        .from('ghl_configurations')
        .select('id, user_id, ghl_account_id, business_name, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching all configurations:', error)
        return { data: [], error: error.message }
      }

      console.log('Found configurations:', data?.length || 0)
      return { data: data || [], error: null }
    } catch (error) {
      console.error('Database fetch error:', error)
      return { data: [], error: error.message }
    }
  }

  // Create a new configuration
  static async createConfiguration(configData, authService = null) {
    try {
      console.log('=== DATABASE SERVICE: CREATE CONFIG ===')
      console.log('Config data:', {
        user_id: configData.user_id,
        ghl_account_id: configData.ghl_account_id,
        business_name: configData.business_name
      })

      let supabase
      try {
        if (authService?.getSupabaseClient) {
          supabase = authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

      const { data, error } = await supabase
        .from('ghl_configurations')
        .insert(configData)
        .select()
        .single()

      if (error) {
        console.error('Error creating configuration:', error)
        return { success: false, error: error.message, data: null }
      }

      console.log('Configuration created successfully:', data.id)
      return { success: true, error: null, data }
    } catch (error) {
      console.error('Database insert error:', error)
      return { success: false, error: error.message, data: null }
    }
  }

  // Update an existing configuration
  static async updateConfiguration(configId, updates, authService = null) {
    try {
      console.log('=== DATABASE SERVICE: UPDATE CONFIG ===')
      console.log('Config ID:', configId)
      console.log('Updates:', updates)

      let supabase
      try {
        if (authService?.getSupabaseClient) {
          supabase = authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

      const { data, error } = await supabase
        .from('ghl_configurations')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', configId)
        .select()
        .single()

      if (error) {
        console.error('Error updating configuration:', error)
        return { success: false, error: error.message, data: null }
      }

      console.log('Configuration updated successfully')
      return { success: true, error: null, data }
    } catch (error) {
      console.error('Database update error:', error)
      return { success: false, error: error.message, data: null }
    }
  }

  // Link a configuration to a user
  static async linkConfigurationToUser(configId, userId, authService = null) {
    console.log('=== DATABASE SERVICE: LINK CONFIG TO USER ===')
    console.log('Linking config', configId, 'to user', userId)
    return this.updateConfiguration(configId, { user_id: userId }, authService)
  }

  // Find configuration by location ID
  static async findConfigurationByLocation(locationId, authService = null) {
    try {
      console.log('=== DATABASE SERVICE: FIND BY LOCATION ===')
      console.log('Location ID:', locationId)

      let supabase
      try {
        if (authService?.getSupabaseClient) {
          supabase = authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

      const { data, error } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('ghl_account_id', locationId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error finding configuration by location:', error)
        return { found: false, error: error.message, data: null }
      }

      console.log('Location search result:', { found: !!data, configId: data?.id })
      return { found: !!data, error: null, data }
    } catch (error) {
      console.error('Database search error:', error)
      return { found: false, error: error.message, data: null }
    }
  }

  // Find configuration by user ID
  static async findConfigurationByUser(userId, authService = null) {
    try {
      console.log('=== DATABASE SERVICE: FIND BY USER ===')
      console.log('User ID:', userId)

      let supabase
      try {
        if (authService?.getSupabaseClient) {
          supabase = authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

      const { data, error } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error finding configuration by user:', error)
        return { found: false, error: error.message, data: null }
      }

      console.log('User search result:', { found: !!data, configId: data?.id })
      return { found: !!data, error: null, data }
    } catch (error) {
      console.error('Database search error:', error)
      return { found: false, error: error.message, data: null }
    }
  }

  // Comprehensive configuration lookup with better error handling
  static async findConfiguration(userId, locationId, authService = null) {
    console.log('=== DATABASE SERVICE: COMPREHENSIVE LOOKUP ===')
    console.log('Parameters:', { userId, locationId })

    try {
      let supabase
      try {
        if (authService?.getSupabaseClient) {
          supabase = authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

      // Strategy 1: Use the database function first
      console.log('Strategy 1: Using database function')
      try {
        const { data: functionData, error: functionError } = await supabase
          .rpc('get_user_ghl_configuration', {
            p_user_id: userId,
            p_location_id: locationId
          })

        if (!functionError && functionData && functionData.length > 0) {
          const config = functionData[0]
          console.log('Found via function:', config.id)
          return { found: true, strategy: 'database_function', data: config, error: null }
        }

        if (functionError) {
          console.log('Database function error:', functionError.message)
        }
      } catch (functionCallError) {
        console.error('Error calling database function:', functionCallError)
      }

      // Strategy 2: Fallback to direct queries
      console.log('Strategy 2: Direct query fallback')

      // Try exact match
      const exactMatch = await this.checkConfigurationExists(userId, locationId, authService)
      if (exactMatch.exists) {
        console.log('Found exact match via direct query')
        return { found: true, strategy: 'exact_match', data: exactMatch.config, error: null }
      }

      // Try by location
      const locationMatch = await this.findConfigurationByLocation(locationId, authService)
      if (locationMatch.found) {
        console.log('Found by location via direct query')
        return { found: true, strategy: 'location_match', data: locationMatch.data, error: null }
      }

      // Try by user
      const userMatch = await this.findConfigurationByUser(userId, authService)
      if (userMatch.found) {
        console.log('Found by user via direct query')
        return { found: true, strategy: 'user_match', data: userMatch.data, error: null }
      }

      console.log('No configuration found via any strategy')
      return { found: false, strategy: 'none', data: null, error: 'No configuration found' }

    } catch (error) {
      console.error('Comprehensive lookup error:', error)
      return { found: false, strategy: 'error', data: null, error: error.message }
    }
  }
}