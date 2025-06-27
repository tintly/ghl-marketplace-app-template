import { useState, useEffect } from 'react'
import { AuthService } from './services/AuthService'
import DataExtractorApp from './components/DataExtractorApp'
import DevModeLogin from './components/DevModeLogin'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDevLogin, setShowDevLogin] = useState(false)
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
      
      // Check if this is development mode
      if (error.message === 'DEV_MODE' || authService.isDev()) {
        console.log('Switching to development mode')
        setShowDevLogin(true)
        setLoading(false)
        return
      }
      
      setError(`Authentication failed: ${error.message}. Please ensure you are accessing this from within GoHighLevel and that the app is properly configured.`)
    } finally {
      if (!showDevLogin) {
        setLoading(false)
      }
    }
  }

  const handleDevLogin = async (userData) => {
    try {
      setLoading(true)
      const authenticatedUser = await authService.loginWithSampleData(userData)
      setUser(authenticatedUser)
      setShowDevLogin(false)
      console.log('Development login successful:', authenticatedUser)
    } catch (error) {
      console.error('Development login error:', error)
      setError('Failed to login with sample data')
    } finally {
      setLoading(false)
    }
  }

  const retryAuth = () => {
    console.log('Retrying authentication...');
    setShowDevLogin(false)
    initializeApp()
  }

  const switchToDevMode = () => {
    console.log('Switching to development mode...');
    setError(null)
    setShowDevLogin(true)
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

  if (showDevLogin) {
    return <DevModeLogin onLogin={handleDevLogin} />
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
        <div className="error-actions">
          <button onClick={retryAuth} className="retry-button">Retry Authentication</button>
          <button onClick={switchToDevMode} className="dev-button">Use Development Mode</button>
        </div>
      </div>
    )
  }

  return <DataExtractorApp user={user} authService={authService} />
}

export default App