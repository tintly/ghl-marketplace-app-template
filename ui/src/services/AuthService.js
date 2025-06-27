const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-ref.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here'

class AuthService {
  constructor() {
    this.baseUrl = `${SUPABASE_URL}/functions/v1`
  }

  async getUserContext() {
    try {
      // Get SSO key from URL parameters or iframe context
      const ssoKey = this.getSSOKey()
      
      const response = await fetch(`${this.baseUrl}/auth-user-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ key: ssoKey })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to authenticate')
      }

      const data = await response.json()
      return data.user
    } catch (error) {
      console.error('Auth service error:', error)
      throw error
    }
  }

  async verifyLocationAccess(locationId) {
    try {
      const ssoKey = this.getSSOKey()
      
      const response = await fetch(`${this.baseUrl}/auth-verify-location/${locationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ key: ssoKey })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Access denied')
      }

      const data = await response.json()
      return data.hasAccess
    } catch (error) {
      console.error('Location verification error:', error)
      throw error
    }
  }

  getSSOKey() {
    // In a real GHL iframe, this would come from the parent window
    // For development, we'll use a placeholder or URL parameter
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('key') || 'dev-mode-key'
  }
}

export default new AuthService()