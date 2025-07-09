export class AuthService {
  constructor() {
    this.currentUser = null
    this.isAuthenticated = false
  }

  // Get user data using GHL SSO or standalone mode
  async getUserData() {
    try {
      console.log('Starting authentication process...')
      
      // Check if we have Supabase configuration
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL environment variable is not set')
      }

      // Check if we're on the OAuth callback page - if so, skip SSO
      if (window.location.pathname === '/oauth/callback') {
        console.log('On OAuth callback page, skipping SSO authentication')
        throw new Error('OAuth callback page - SSO not needed')
      }

      // Check if we just completed an OAuth installation
      const installationData = localStorage.getItem('ghl_installation')
      if (installationData) {
        console.log('Found recent OAuth installation, using standalone mode')
        return this.handleStandaloneMode(JSON.parse(installationData))
      }

      // Try to get encrypted data from parent window (for GHL SSO)
      let encryptedUserData = null
      try {
        encryptedUserData = await this.getEncryptedUserData()
        console.log('Encrypted user data received from GHL SSO')
      } catch (ssoError) {
        console.log('GHL SSO not available:', ssoError.message)
        throw new Error('GHL SSO authentication required')
      }

      // Use Supabase Edge Function for SSO authentication
      const response = await fetch(`${supabaseUrl}/functions/v1/auth-user-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ key: encryptedUserData })
      })

      console.log('Auth response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Auth response error:', errorText)
        throw new Error(`Authentication failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Authentication successful:', result)
      
      // Store the JWT for later use with Supabase
      if (result.supabaseJWT) {
        console.log('Storing JWT for Supabase operations...')
        this.supabaseJWT = result.supabaseJWT
        
        // Set up Supabase client with the JWT
        await this.setupSupabaseClient()
      }
      
      this.currentUser = result.user
     
     // Extract payment plan from JWT claims if available
     if (result.jwtClaims && result.jwtClaims.ghl_payment_plan) {
       this.currentUser.paymentPlan = result.jwtClaims.ghl_payment_plan
     } else {
       // Default to standard plan if not specified
       this.currentUser.paymentPlan = 'standard'
     }
     
      this.isAuthenticated = true
      
      return result.user
    } catch (error) {
      console.error('Failed to fetch user data:', error)
      throw error
    }
  }

  // Set up Supabase client with custom JWT
  async setupSupabaseClient() {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      
      // Create a new Supabase client with the JWT as the access token
      this.supabaseClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${this.supabaseJWT}`
            }
          }
        }
      )

      console.log('Supabase client configured with custom JWT')
      return this.supabaseClient
    } catch (error) {
      console.error('Error setting up Supabase client:', error)
      throw error
    }
  }

  // Get the configured Supabase client
  getSupabaseClient() {
    return this.supabaseClient
  }

  // Handle standalone mode for OAuth installations
  async handleStandaloneMode(installationData) {
    console.log('Handling standalone mode with installation data:', installationData)
    
    // Create a user object for standalone mode using the actual userId from OAuth
    const standaloneUser = {
      userId: installationData.userId || `oauth_${installationData.locationId || installationData.companyId}`,
      email: 'oauth-user@example.com',
      userName: 'OAuth User',
      role: 'admin',
      type: installationData.userType || 'location',
      companyId: installationData.companyId,
      locationId: installationData.locationId || installationData.companyId,
      activeLocation: installationData.locationId,
      standaloneMode: true,
      installedAt: installationData.installedAt,
      configId: installationData.configId,
      configValidated: true,
      tokenStatus: 'valid'
    }

    this.currentUser = standaloneUser
    this.isAuthenticated = true
    
    // For standalone mode, use the regular Supabase client
    const { createClient } = await import('@supabase/supabase-js')
    this.supabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    
    // Clear the installation data after a delay to allow for page refreshes
    setTimeout(() => {
      localStorage.removeItem('ghl_installation')
    }, 60000) // Clear after 1 minute
    
    return standaloneUser
  }

  // Extract the encrypted user data logic into separate method
  async getEncryptedUserData() {
    return new Promise((resolve, reject) => {
      console.log('Requesting user data from parent window...')
      
      const timeout = setTimeout(() => {
        console.log('Timeout waiting for user data from parent window')
        reject(new Error('Timeout waiting for user data from parent window'))
      }, 5000)

      // Request user data from parent window
      window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*')

      // Listen for the response
      const messageHandler = ({ data, origin }) => {
        console.log('Received message from parent:', { message: data.message, origin })
        
        if (data.message === 'REQUEST_USER_DATA_RESPONSE') {
          clearTimeout(timeout)
          window.removeEventListener('message', messageHandler)
          
          if (data.payload) {
            console.log('User data payload received')
            resolve(data.payload)
          } else {
            console.error('No payload in user data response')
            reject(new Error('No user data payload received'))
          }
        }
      }

      window.addEventListener('message', messageHandler)
    })
  }

  // Verify access to a specific location
  async verifyLocationAccess(locationId) {
    try {
      // If in standalone mode, always allow access to the installed location
      if (this.currentUser?.standaloneMode) {
        return this.currentUser.locationId === locationId
      }

      let encryptedUserData = null
      try {
        encryptedUserData = await this.getEncryptedUserData()
      } catch (error) {
        console.log('Cannot verify location access without SSO data')
        return false
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

      const response = await fetch(`${supabaseUrl}/functions/v1/auth-verify-location/${locationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ key: encryptedUserData })
      })

      if (!response.ok) {
        throw new Error('Access verification failed')
      }

      const result = await response.json()
      return result.hasAccess
    } catch (error) {
      console.error('Failed to verify location access:', error)
      return false
    }
  }

  getCurrentUser() {
    return this.currentUser
  }

  isUserAuthenticated() {
    return this.isAuthenticated
  }

  getJWT() {
    return this.supabaseJWT
  }
}