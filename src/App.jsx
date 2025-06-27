import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthService } from './services/AuthService'
import { hasActiveGHLConfiguration } from './services/supabase'
import DataExtractorApp from './components/DataExtractorApp'
import OAuthCallback from './components/OAuthCallback'
import InstallationGuide from './components/InstallationGuide'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasConfiguration, setHasConfiguration] = useState(false)
  const [isDevMode, setIsDevMode] = useState(false)
  const [authService] = useState(new AuthService())

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Initializing app...')
      
      // Get user data from GHL SSO or dev mode
      const userData = await authService.getUserData()
      setUser(userData)
      
      console.log('User authenticated successfully:', userData)

      // Check if we're in dev mode
      const devMode = userData.devMode === true
      setIsDevMode(devMode)

      // Check if user has any GHL configurations
      if (userData.userId) {
        try {
          // In dev mode, assume we have configuration to skip installation guide
          if (devMode) {
            console.log('Dev mode enabled - skipping configuration check')
            setHasConfiguration(true)
          } else {
            const hasConfig = await hasActiveGHLConfiguration(userData.userId)
            setHasConfiguration(hasConfig)
            console.log('User has GHL configuration:', hasConfig)
          }
        } catch (configError) {
          console.log('Could not check GHL configuration:', configError.message)
          // In dev mode, default to having configuration
          setHasConfiguration(devMode)
        }
      }
      
    } catch (error) {
      console.error('Authentication error:', error)
      setError(`Authentication failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const retryAuth = () => {
    console.log('Retrying authentication...')
    initializeApp()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your data extractor...</p>
          <p className="text-sm text-gray-500 mt-2">
            {isDevMode ? 'Running in development mode...' : 'Connecting to GoHighLevel...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Access Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="bg-gray-50 p-4 rounded-lg mb-4 text-left">
            <h3 className="font-semibold text-gray-800 mb-2">Troubleshooting Steps:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Ensure you are accessing this app from within GoHighLevel</li>
              <li>• Check that the app is properly installed in your location</li>
              <li>• Verify that your browser allows iframe communication</li>
              <li>• Try refreshing the page</li>
            </ul>
          </div>
          <button 
            onClick={retryAuth}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Retry Authentication
          </button>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/callback/oauth" 
          element={<OAuthCallback />} 
        />
        <Route 
          path="/" 
          element={
            hasConfiguration ? 
              <DataExtractorApp user={user} authService={authService} isDevMode={isDevMode} /> :
              <InstallationGuide user={user} />
          } 
        />
      </Routes>
    </Router>
  )
}

export default App