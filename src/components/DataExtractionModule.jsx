import React, { useState, useEffect } from 'react'
import ConfigurationManager from './data-extraction/ConfigurationManager'
import DataExtractionInterface from './data-extraction/DataExtractionInterface'
import UsageLimitBanner from './UsageLimitBanner'
import TokenStatusAlert from './data-extraction/TokenStatusAlert'
import ConfigurationDebugger from './ConfigurationDebugger'

function DataExtractionModule({ user, authService }) {
  const [ghlConfig, setGhlConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDebugger, setShowDebugger] = useState(false)

  useEffect(() => {
    loadConfiguration()
  }, [user])

  const loadConfiguration = async () => {
    try {
      setLoading(true)
      setError(null) 
      
      if (!user || !user.userId || !user.locationId) {
        throw new Error('User information is incomplete. Please reload the page.')
      }

      // Use the authenticated Supabase client from AuthService
      const configManager = new ConfigurationManager(authService)
      const result = await configManager.findConfiguration(user.userId, user.locationId)
      
      if (result.found) {
        setGhlConfig(result.data)
      } else {
        setShowDebugger(true)
      }
    } catch (error) {
      console.error('Error loading configuration:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfigurationFound = (config) => {
    setGhlConfig(config)
    setShowDebugger(false)
  }

  const handleRetry = () => {
    loadConfiguration()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading data extraction settings...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-card">
        <h3 className="text-red-800 font-medium">Error Loading Data</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={handleRetry}
          className="mt-3 btn-danger text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!ghlConfig) {
    return (
      <div className="space-y-6">
        <div className="warning-card">
          <h3 className="text-yellow-800 font-medium">❌ No Connection Found</h3>
          <p className="text-yellow-600 text-sm mt-1">
            No connection found for this user and location combination.
          </p>
          <button
            onClick={() => setShowDebugger(!showDebugger)}
            className="mt-3 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            {showDebugger ? 'Hide' : 'Show'} Diagnostics
          </button>
        </div>

        {showDebugger && (
          <ConfigurationDebugger 
            user={user} 
            authService={authService}
            onConfigurationFound={handleConfigurationFound} 
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Usage Limit Banner */}
      <UsageLimitBanner user={user} authService={authService} />

      {/* Token Status Alert - Only show if there are issues */}
      <TokenStatusAlert config={ghlConfig} />

      {/* Main Data Extraction Interface */}
      <DataExtractionInterface 
        config={ghlConfig} 
        user={user}
        authService={authService}
      />
    </div>
  )
}

export default DataExtractionModule