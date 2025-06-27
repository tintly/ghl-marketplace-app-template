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
      
      console.log('Initializing app...');
      
      // Get user data from GHL SSO
      const userData = await authService.getUserData()
      setUser(userData)
      
      console.log('User authenticated successfully:', userData)
    } catch (error) {
      console.error('Authentication error:', error)
      setError(`Authentication failed: ${error.message}. Please ensure you are accessing this from within GoHighLevel and that the app is properly configured.`)
    } finally {
      setLoading(false)
    }
  }

  const retryAuth = () => {
    console.log('Retrying authentication...');
    initializeApp()
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your data extractor...</p>
        <p className="loading-subtext">Connecting to GoHighLevel...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Access Error</h2>
        <p>{error}</p>
        <div className="error-details">
          <h3>Troubleshooting Steps:</h3>
          <ul>
            <li>Ensure you are accessing this app from within GoHighLevel</li>
            <li>Check that the app is properly installed in your location</li>
            <li>Verify that your browser allows iframe communication</li>
            <li>Try refreshing the page</li>
          </ul>
        </div>
        <button onClick={retryAuth} className="retry-button">Retry Authentication</button>
      </div>
    )
  }

  return <DataExtractorApp user={user} authService={authService} />
}

export default App