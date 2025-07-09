import { DatabaseService } from '../../services/DatabaseService'

export default class ConfigurationManager {
  constructor(authService = null) {
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutes
    this.authService = authService
  }

  async findConfiguration(userId, locationId) {
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
      console.log('=== CONFIGURATION MANAGER LOOKUP ===')
      console.log('Parameters:', { userId, locationId })

      const result = await DatabaseService.findConfiguration(userId, locationId, this.authService)
      
      if (result.found) {
        console.log('Configuration found:', {
          id: result.data.id,
          strategy: result.strategy,
          hasTokens: !!(result.data.access_token && result.data.refresh_token)
        })

        // Cache the result
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        })
      }

      return result

    } catch (error) {
      console.error('Configuration manager error:', error)
      return {
        found: false,
        strategy: 'error',
        data: null,
        error: error.message
      }
    }
  }

  validateTokenStatus(config) {
    if (!config.access_token) {
      return {
        isValid: false,
        status: 'missing_access_token',
        message: 'Access token is missing. Please reconnect your account.',
        severity: 'error'
      }
    }
    
    if (config.access_token.startsWith('temp-') || 
        config.access_token.startsWith('dev-') || 
        config.access_token.startsWith('test-')) {
      return {
        isValid: false,
        status: 'temporary_token',
        message: 'Using temporary tokens. Connect your account for real data access.',
        severity: 'warning'
      }
    }
    
    if (!config.refresh_token) {
      return {
        isValid: false,
        status: 'missing_refresh_token',
        message: 'Refresh token is missing. Please reconnect your account.',
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
          message: 'Your connection has expired. The system will attempt to refresh it automatically.',
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
      message: 'Your connection is valid and active.',
      severity: 'success'
    }
  }

  clearCache() {
    this.cache.clear()
  }
}