import { supabase } from './supabase'

export class ConfigurationService {
  static async getGHLConfiguration(userId, locationId) {
    console.log('=== CONFIGURATION SERVICE LOOKUP ===')
    console.log('User ID:', userId)
    console.log('Location ID:', locationId)

    try {
      // Use the database function for optimized lookup
      const { data: functionResult, error: functionError } = await supabase
        .rpc('get_user_ghl_configuration', {
          p_user_id: userId,
          p_location_id: locationId
        })

      if (functionError) {
        console.error('Function lookup error:', functionError)
        // Fallback to manual queries if function fails
        return await this.fallbackConfigurationLookup(userId, locationId)
      }

      if (functionResult && functionResult.length > 0) {
        const config = functionResult[0]
        console.log('✅ Found configuration via function:', {
          id: config.id,
          user_id: config.user_id,
          ghl_account_id: config.ghl_account_id,
          hasAccessToken: !!config.access_token,
          hasRefreshToken: !!config.refresh_token
        })
        return config
      }

      console.log('❌ No configuration found via function')
      return null

    } catch (error) {
      console.error('Configuration service error:', error)
      // Fallback to manual queries
      return await this.fallbackConfigurationLookup(userId, locationId)
    }
  }

  static async fallbackConfigurationLookup(userId, locationId) {
    console.log('=== FALLBACK CONFIGURATION LOOKUP ===')

    try {
      // Strategy 1: Exact match
      console.log('Fallback Strategy 1: Exact match')
      const { data: exactMatch, error: exactError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', userId)
        .eq('ghl_account_id', locationId)
        .eq('is_active', true)
        .maybeSingle()

      if (exactError) {
        console.error('Exact match error:', exactError)
      } else if (exactMatch) {
        console.log('✅ Found exact match:', exactMatch.id)
        return exactMatch
      }

      // Strategy 2: By location (most common for OAuth installs)
      console.log('Fallback Strategy 2: By location')
      const { data: locationConfigs, error: locationError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('ghl_account_id', locationId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      if (locationError) {
        console.error('Location lookup error:', locationError)
      } else if (locationConfigs && locationConfigs.length > 0) {
        console.log(`Found ${locationConfigs.length} config(s) for location`)
        
        // Prefer config with matching user_id, otherwise take most recent
        const bestConfig = locationConfigs.find(c => c.user_id === userId) || locationConfigs[0]
        
        console.log('Selected config:', {
          id: bestConfig.id,
          user_id: bestConfig.user_id,
          matches_user: bestConfig.user_id === userId
        })

        // If user_id doesn't match, update it
        if (bestConfig.user_id !== userId) {
          console.log('Updating config to link with current user...')
          
          const { data: updatedConfig, error: updateError } = await supabase
            .from('ghl_configurations')
            .update({ 
              user_id: userId,
              updated_at: new Date().toISOString()
            })
            .eq('id', bestConfig.id)
            .select()
            .single()

          if (updateError) {
            console.error('Failed to update user_id:', updateError)
            return bestConfig // Return original even if update fails
          }

          console.log('✅ Successfully linked config to user')
          return updatedConfig
        }

        return bestConfig
      }

      // Strategy 3: By user_id only
      console.log('Fallback Strategy 3: By user_id')
      const { data: userConfigs, error: userError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      if (userError) {
        console.error('User lookup error:', userError)
      } else if (userConfigs && userConfigs.length > 0) {
        console.log('✅ Found config by user_id:', userConfigs[0].id)
        return userConfigs[0]
      }

      console.log('❌ No configuration found in fallback lookup')
      return null

    } catch (error) {
      console.error('Fallback lookup error:', error)
      throw error
    }
  }

  static async validateTokenStatus(config) {
    if (!config) {
      return {
        isValid: false,
        status: 'missing_config',
        message: 'No configuration found',
        severity: 'error'
      }
    }

    if (!config.access_token) {
      return {
        isValid: false,
        status: 'missing_access_token',
        message: 'Access token is missing. Please reinstall the app.',
        severity: 'error'
      }
    }
    
    if (!config.refresh_token) {
      return {
        isValid: false,
        status: 'missing_refresh_token',
        message: 'Refresh token is missing. Please reinstall the app.',
        severity: 'error'
      }
    }
    
    // Check if tokens are dev tokens
    if (config.access_token.startsWith('dev-') || config.refresh_token.startsWith('dev-')) {
      return {
        isValid: false,
        status: 'dev_tokens',
        message: 'Development tokens detected. Please reinstall the app to get real GHL tokens.',
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
          message: 'Access token has expired. The system will attempt to refresh it automatically.',
          severity: 'warning'
        }
      } else if (hoursUntilExpiry < 24) {
        return {
          isValid: true,
          status: 'expiring_soon',
          message: `Access token expires in ${Math.round(hoursUntilExpiry)} hours.`,
          severity: 'info'
        }
      }
    }
    
    return {
      isValid: true,
      status: 'valid',
      message: 'Real GHL access tokens are valid and ready for use.',
      severity: 'success'
    }
  }
}