import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AuthService } from './services/AuthService'
import DataExtractorApp from './components/DataExtractorApp'
import OAuthCallback from './components/OAuthCallback'

function AppContent() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authService] = useState(new AuthService())
  const location = useLocation()

  useEffect(() => {
    // Skip authentication for OAuth callback page
    if (location.pathname === '/oauth/callback') {
      setLoading(false)
      return
    }
    
    initializeApp()
  }, [location.pathname])

  const initializeApp = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Initializing app...')
      
      try {
        // Get user data from GHL SSO or standalone mode
        const userData = await authService.getUserData()
        setUser(userData)
        
        console.log('User authenticated successfully:', userData)
      } catch (authError) {
        console.error('Authentication error, using fallback mode:', authError)
        // Don't create fallback users - require proper authentication
        throw authError
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

  // Don't show loading/error states for OAuth callback
  if (location.pathname === '/oauth/callback') {
    return <OAuthCallback />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
          <p className="text-sm text-gray-500 mt-2">
            {user?.standaloneMode ? 'Running in standalone mode...' : 'Initializing application...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-600 mb-4">Authentication Required</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="bg-gray-50 p-4 rounded-lg mb-4 text-left">
            <h3 className="font-semibold text-gray-800 mb-2">How to Access This App:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Install this app from the GoHighLevel Marketplace</li>
              <li>• Access the app from within your GHL dashboard</li>
              <li>• Do not access this URL directly in your browser</li>
              <li>• Ensure your browser allows iframe communication</li>
            </ul>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg mb-4 text-left">
            <h3 className="font-semibold text-blue-800 mb-2">For GoHighLevel Users:</h3>
            <p className="text-sm text-blue-700">
              This app is designed to work within the GoHighLevel platform. Please access it through your GHL dashboard after installation.
            </p>
          </div>
          <button 
            onClick={retryAuth}
            className="btn-primary mb-2"
          >
            Retry Authentication
          </button>
          <p className="text-xs text-gray-500">
            If you continue to have issues, please contact support.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/*" element={<DataExtractorApp user={user} authService={authService} />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </Router>
  )
}

export default App