import React from 'react'
import ConfigurationManager from './ConfigurationManager'

function TokenStatusAlert({ config }) {
  const configManager = new ConfigurationManager()
  const tokenStatus = configManager.validateTokenStatus(config)

  // Only show alert for critical errors that require user action
  if (tokenStatus.isValid) {
    return null
  }

  // Only show errors for invalid tokens that need user intervention
  if (['missing_access_token', 'missing_refresh_token'].includes(tokenStatus.status)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">⚠️ Authentication Required</h3>
        <p className="text-red-600 text-sm mt-1">{tokenStatus.message}</p>
        
        <div className="mt-3">
          <button
            onClick={() => window.open('https://marketplace.gohighlevel.com', '_blank')}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            Reinstall App
          </button>
        </div>
      </div>
    )
  }

  // For temporary tokens, show OAuth installation option
  if (tokenStatus.status === 'temporary_token') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-yellow-800 font-medium">⚠️ Development Mode</h3>
        <p className="text-yellow-600 text-sm mt-1">{tokenStatus.message}</p>
        
        <div className="mt-3">
          <a
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors inline-block"
          >
            Install via OAuth
          </a>
        </div>
      </div>
    )
  }

  // Don't show anything for expired tokens - let the automatic refresh handle it
  return null
}

export default TokenStatusAlert