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
        // Use fallback mode with minimal permissions
        setUser({
          userId: 'fallback_user',
          email: 'fallback@example.com',
          userName: 'Fallback User',
          role: 'viewer',
          type: 'location',
          companyId: 'fallback_company',
          locationId: 'fallback_location',
          standaloneMode: true,
          installedAt: new Date().toISOString()
        })
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
            className="btn-primary"
          >
            Retry Authentication
          </button>
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