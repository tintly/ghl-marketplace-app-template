export class AuthService {
  constructor() {
    this.currentUser = null
    this.isAuthenticated = false
  }

  // Get user data using GHL SSO
  async getUserData() {
    try {
      const encryptedUserData = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for user data'))
        }, 10000)

        // Request user data from parent window
        window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*')

        // Listen for the response
        const messageHandler = ({ data }) => {
          if (data.message === 'REQUEST_USER_DATA_RESPONSE') {
            clearTimeout(timeout)
            window.removeEventListener('message', messageHandler)
            resolve(data.payload)
          }
        }

        window.addEventListener('message', messageHandler)
      })

      // Send encrypted data to backend for decryption
      const response = await fetch('/api/auth/user-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: encryptedUserData })
      })

      if (!response.ok) {
        throw new Error('Failed to get user context')
      }

      const result = await response.json()
      this.currentUser = result.user
      this.isAuthenticated = true
      
      return result.user
    } catch (error) {
      console.error('Failed to fetch user data:', error)
      throw error
    }
  }

  // Verify access to a specific location
  async verifyLocationAccess(locationId) {
    try {
      const encryptedUserData = await new Promise((resolve) => {
        window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*')
        
        const messageHandler = ({ data }) => {
          if (data.message === 'REQUEST_USER_DATA_RESPONSE') {
            window.removeEventListener('message', messageHandler)
            resolve(data.payload)
          }
        }

        window.addEventListener('message', messageHandler)
      })

      const response = await fetch(`/api/auth/verify-location/${locationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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