import React, { useState, useEffect } from 'react'
import ConfigurationManager from './data-extraction/ConfigurationManager'
import DataExtractionInterface from './data-extraction/DataExtractionInterface'
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

      const configManager = new ConfigurationManager()
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error Loading Data</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={handleRetry}
          className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!ghlConfig) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-yellow-800 font-medium">❌ No Configuration Found</h3>
          <p className="text-yellow-600 text-sm mt-1">
            No GoHighLevel configuration found for this user and location combination.
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
            onConfigurationFound={handleConfigurationFound}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-green-800 font-medium">✅ Configuration Found!</h3>
        <div className="text-xs text-green-700 mt-2 space-y-1">
          <p><strong>Config ID:</strong> {ghlConfig.id}</p>
          <p><strong>User ID:</strong> {ghlConfig.user_id}</p>
          <p><strong>Location ID:</strong> {ghlConfig.ghl_account_id}</p>
          <p><strong>Business Name:</strong> {ghlConfig.business_name}</p>
        </div>
      </div>

      {/* Token Status Alert */}
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