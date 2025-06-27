export class AuthService {
  constructor() {
    this.currentUser = null
    this.isAuthenticated = false
  }

  // Get user data using GHL SSO
  async getUserData() {
    try {
      console.log('Starting authentication process...');
      
      // Get encrypted data from parent window
      const encryptedUserData = await this.getEncryptedUserData()
      console.log('Encrypted user data received');

      // Send encrypted data to Netlify Function
      const response = await fetch('/.netlify/functions/auth-user-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: encryptedUserData })
      })

      console.log('Auth response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Auth response error:', errorText);
        throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json()
      console.log('Authentication successful:', result);
      
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
      console.log('Requesting user data from parent window...');
      
      const timeout = setTimeout(() => {
        console.error('Timeout waiting for user data from parent window');
        reject(new Error('Timeout waiting for user data from parent window. Please ensure you are accessing this app from within GoHighLevel.'))
      }, 15000) // Increased timeout to 15 seconds

      // Request user data from parent window
      window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*')

      // Listen for the response
      const messageHandler = ({ data, origin }) => {
        console.log('Received message from parent:', { message: data.message, origin });
        
        if (data.message === 'REQUEST_USER_DATA_RESPONSE') {
          clearTimeout(timeout)
          window.removeEventListener('message', messageHandler)
          
          if (data.payload) {
            console.log('User data payload received');
            resolve(data.payload)
          } else {
            console.error('No payload in user data response');
            reject(new Error('No user data payload received'))
          }
        }
      }

      window.addEventListener('message', messageHandler)
      
      // Also try to get data immediately in case it's already available
      setTimeout(() => {
        window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*')
      }, 1000)
    })
  }

  // Verify access to a specific location
  async verifyLocationAccess(locationId) {
    try {
      const encryptedUserData = await this.getEncryptedUserData()

      const response = await fetch(`/.netlify/functions/auth-verify-location/${locationId}`, {
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