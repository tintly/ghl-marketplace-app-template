import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

function OAuthCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')
  const [message, setMessage] = useState('Processing your installation...')
  const [error, setError] = useState(null)
  const [installationData, setInstallationData] = useState(null)

  useEffect(() => {
    handleOAuthCallback()
  }, [])

  const handleOAuthCallback = async () => {
    try {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')

      if (error) {
        throw new Error(`OAuth error: ${error}`)
      }

      if (!code) {
        throw new Error('No authorization code received')
      }

      setMessage('Exchanging authorization code for access token...')

      // Exchange code for tokens using our edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          code,
          state 
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to exchange authorization code')
      }

      const result = await response.json()
      setInstallationData(result)
      
      setStatus('success')
      setMessage('Installation completed successfully!')
      
      // Store installation info in localStorage for the main app
      localStorage.setItem('ghl_installation', JSON.stringify({
        locationId: result.locationId,
        companyId: result.companyId,
        userType: result.userType,
        installedAt: new Date().toISOString()
      }))
      
      // Redirect to main app after a short delay
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)

    } catch (error) {
      console.error('OAuth callback error:', error)
      setStatus('error')
      setError(error.message)
      setMessage('Installation failed')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        )
      case 'success':
        return (
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      default:
        return null
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          {getStatusIcon()}
        </div>
        
        <h2 className={`text-xl font-semibold mb-4 ${getStatusColor()}`}>
          {status === 'processing' && 'Setting up your integration...'}
          {status === 'success' && 'Installation Complete!'}
          {status === 'error' && 'Installation Failed'}
        </h2>
        
        <p className="text-gray-600 mb-4">{message}</p>
        
        {installationData && status === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
            <div className="text-sm text-green-800">
              <p><strong>Type:</strong> {installationData.userType}</p>
              {installationData.locationId && (
                <p><strong>Location ID:</strong> {installationData.locationId}</p>
              )}
              {installationData.companyId && (
                <p><strong>Company ID:</strong> {installationData.companyId}</p>
              )}
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {status === 'success' && (
          <p className="text-sm text-gray-500">
            Redirecting you to the app...
          </p>
        )}
        
        {status === 'error' && (
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Return to App
          </button>
        )}
      </div>
    </div>
  )
}

export default OAuthCallback