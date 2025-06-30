import { supabase } from './supabase'

export class DatabaseService {
  // Check if a configuration exists for the given user and location
  static async checkConfigurationExists(userId, locationId) {
    try {
      const { data, error } = await supabase
        .from('ghl_configurations')
        .select('id, user_id, ghl_account_id, business_name')
        .eq('user_id', userId)
        .eq('ghl_account_id', locationId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('Error checking configuration:', error)
        return { exists: false, error: error.message }
      }

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

  // Get all configurations for debugging
  static async getAllConfigurations() {
    try {
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

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Database fetch error:', error)
      return { data: [], error: error.message }
    }
  }

  // Create a new configuration
  static async createConfiguration(configData) {
    try {
      const { data, error } = await supabase
        .from('ghl_configurations')
        .insert(configData)
        .select()
        .single()

      if (error) {
        console.error('Error creating configuration:', error)
        return { success: false, error: error.message, data: null }
      }

      return { success: true, error: null, data }
    } catch (error) {
      console.error('Database insert error:', error)
      return { success: false, error: error.message, data: null }
    }
  }

  // Update an existing configuration
  static async updateConfiguration(configId, updates) {
    try {
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

      return { success: true, error: null, data }
    } catch (error) {
      console.error('Database update error:', error)
      return { success: false, error: error.message, data: null }
    }
  }

  // Link a configuration to a user
  static async linkConfigurationToUser(configId, userId) {
    return this.updateConfiguration(configId, { user_id: userId })
  }

  // Find configuration by location ID
  static async findConfigurationByLocation(locationId) {
    try {
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

      return { found: !!data, error: null, data }
    } catch (error) {
      console.error('Database search error:', error)
      return { found: false, error: error.message, data: null }
    }
  }

  // Find configuration by user ID
  static async findConfigurationByUser(userId) {
    try {
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

      return { found: !!data, error: null, data }
    } catch (error) {
      console.error('Database search error:', error)
      return { found: false, error: error.message, data: null }
    }
  }

  // Comprehensive configuration lookup
  static async findConfiguration(userId, locationId) {
    console.log('=== DATABASE SERVICE LOOKUP ===')
    console.log('Parameters:', { userId, locationId })

    // Strategy 1: Exact match
    const exactMatch = await this.checkConfigurationExists(userId, locationId)
    if (exactMatch.exists) {
      console.log('Found exact match via database service')
      return { found: true, strategy: 'exact_match', data: exactMatch.config, error: null }
    }

    // Strategy 2: By location
    const locationMatch = await this.findConfigurationByLocation(locationId)
    if (locationMatch.found) {
      console.log('Found by location via database service')
      return { found: true, strategy: 'location_match', data: locationMatch.data, error: null }
    }

    // Strategy 3: By user
    const userMatch = await this.findConfigurationByUser(userId)
    if (userMatch.found) {
      console.log('Found by user via database service')
      return { found: true, strategy: 'user_match', data: userMatch.data, error: null }
    }

    console.log('No configuration found via database service')
    return { found: false, strategy: 'none', data: null, error: 'No configuration found' }
  }
}