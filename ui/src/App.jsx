import { useState, useEffect } from 'react'
import { AuthService } from './services/AuthService'
import DataExtractorApp from './components/DataExtractorApp'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authService] = useState(new AuthService())

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get user data from GHL SSO
      const userData = await authService.getUserData()
      setUser(userData)
      
      console.log('User authenticated:', userData)
    } catch (error) {
      console.error('Authentication error:', error)
      setError('Failed to authenticate user. Please ensure you are accessing this from within GoHighLevel.')
    } finally {
      setLoading(false)
    }
  }

  const retryAuth = () => {
    initializeApp()
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your data extractor...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Access Error</h2>
        <p>{error}</p>
        <button onClick={retryAuth} className="retry-button">Retry</button>
      </div>
    )
  }

  return <DataExtractorApp user={user} authService={authService} />
}

export default App