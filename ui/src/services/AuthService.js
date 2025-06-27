export class AuthService {
  constructor() {
    this.currentUser = null
    this.isAuthenticated = false
  }

  // Check if we're in mock mode
  isMockMode() {
    return import.meta.env.VITE_MOCK_AUTH === 'true'
  }

  // Get mock user data from environment variables
  getMockUserData() {
    return {
      userId: import.meta.env.VITE_MOCK_USER_ID,
      companyId: import.meta.env.VITE_MOCK_COMPANY_ID,
      role: import.meta.env.VITE_MOCK_ROLE,
      type: import.meta.env.VITE_MOCK_TYPE,
      activeLocation: import.meta.env.VITE_MOCK_ACTIVE_LOCATION,
      userName: import.meta.env.VITE_MOCK_USER_NAME,
      email: import.meta.env.VITE_MOCK_EMAIL,
      // Set locationId based on activeLocation or companyId (as per your backend logic)
      locationId: import.meta.env.VITE_MOCK_ACTIVE_LOCATION || import.meta.env.VITE_MOCK_COMPANY_ID
    }
  }

  // Get user data using GHL SSO or mock data
  async getUserData() {
    try {
      // If in mock mode, return mock data immediately
      if (this.isMockMode()) {
        console.log('🔧 Using mock authentication data for development')
        const mockUser = this.getMockUserData()
        this.currentUser = mockUser
        this.isAuthenticated = true
        return mockUser
      }

      // Production flow - get encrypted data from parent window
      const encryptedUserData = await this.getEncryptedUserData()

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

  // Extract the encrypted user data logic into separate method
  async getEncryptedUserData() {
    return new Promise((resolve, reject) => {
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
  }

  // Verify access to a specific location
  async verifyLocationAccess(locationId) {
    try {
      // If in mock mode, simulate access verification
      if (this.isMockMode()) {
        console.log('🔧 Mock mode: Simulating location access verification')
        const mockUser = this.getMockUserData()
        // Grant access if the locationId matches activeLocation or companyId
        return locationId === mockUser.activeLocation || locationId === mockUser.companyId
      }

      // Production flow
      const encryptedUserData = await this.getEncryptedUserData()

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