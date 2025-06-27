import { useState, useEffect } from 'react'
import { AuthService } from './services/AuthService'
import DataExtractorApp from './components/DataExtractorApp'
import DevModeLogin from './components/DevModeLogin'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showDevLogin, setShowDevLogin] = useState(false)
  const [authService] = useState(new AuthService())

  const handleGetStarted = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Get Started clicked - attempting authentication...')
      
      // Try to get user data from GHL SSO
      const userData = await authService.getUserData()
      setUser(userData)
      
      console.log('User authenticated successfully:', userData)
    } catch (error) {
      console.error('Authentication error:', error)
      
      // If it's development mode, show the dev login form
      if (error.message === 'DEV_MODE' || authService.isDev()) {
        console.log('Showing development mode login')
        setShowDevLogin(true)
      } else {
        setError(`Authentication failed: ${error.message}. Please ensure you are accessing this from within GoHighLevel and that the app is properly configured.`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDevLogin = async (userData) => {
    try {
      setLoading(true)
      const user = await authService.loginWithSampleData(userData)
      setUser(user)
      setShowDevLogin(false)
      console.log('Development login successful:', user)
    } catch (error) {
      console.error('Development login error:', error)
      setError('Failed to login with sample data')
    } finally {
      setLoading(false)
    }
  }

  const retryAuth = () => {
    console.log('Retrying authentication...')
    setError(null)
    setShowDevLogin(false)
    handleGetStarted()
  }

  // If user is authenticated, show the main app
  if (user) {
    return <DataExtractorApp user={user} authService={authService} />
  }

  // Show development login form
  if (showDevLogin) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <DevModeLogin onLogin={handleDevLogin} />
        </div>
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your data extractor...</p>
        <p className="loading-subtext">Connecting to GoHighLevel...</p>
      </div>
    )
  }

  // Show error state
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

  // Show welcome screen with Get Started button
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            GHL Data Extractor
          </h1>
          <p className="text-gray-600">
            Extract and manage data from GoHighLevel
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Welcome to GHL Data Extractor
            </h2>
            <p className="text-gray-600 mb-6">
              This application helps you extract and manage data from GoHighLevel using Supabase Edge Functions.
            </p>
            
            <button
              onClick={handleGetStarted}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {loading ? 'Connecting...' : 'Get Started'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App