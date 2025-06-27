export class AuthService {
  constructor() {
    this.currentUser = null
    this.isAuthenticated = false
  }

  // Get user data using GHL SSO or development mode
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

      // Try to get encrypted data from parent window (for GHL SSO)
      let encryptedUserData = null
      try {
        encryptedUserData = await this.getEncryptedUserData()
        console.log('Encrypted user data received from GHL SSO')
      } catch (ssoError) {
        console.log('GHL SSO not available, will try development mode:', ssoError.message)
      }

      // Use Supabase Edge Function
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
      
      this.currentUser = result.user
      this.isAuthenticated = true
      
      return result.user
    } catch (error) {
      console.error('Failed to fetch user data:', error)
      throw error
    }
  }

  // Extract the encrypted user data logic into separate method
  async getEncryptedUserData() {
    return new Promise((resolve, reject) => {
      console.log('Requesting user data from parent window...')
      
      const timeout = setTimeout(() => {
        console.log('Timeout waiting for user data from parent window - this is expected in development mode')
        reject(new Error('Timeout waiting for user data from parent window'))
      }, 5000) // Reduced timeout since we expect this to fail in dev mode

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
      let encryptedUserData = null
      try {
        encryptedUserData = await this.getEncryptedUserData()
      } catch (error) {
        console.log('Using development mode for location verification')
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
}