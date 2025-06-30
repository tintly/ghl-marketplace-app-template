import React from 'react'
import ConfigurationManager from './ConfigurationManager'

function TokenStatusAlert({ config }) {
  const configManager = new ConfigurationManager()
  const tokenStatus = configManager.validateTokenStatus(config)

  if (tokenStatus.isValid) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-green-800 font-medium">✅ Token Status: Valid</h3>
        <p className="text-green-600 text-sm mt-1">{tokenStatus.message}</p>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg p-4 ${
      tokenStatus.severity === 'error' 
        ? 'bg-red-50 border-red-200' 
        : 'bg-yellow-50 border-yellow-200'
    }`}>
      <h3 className={`font-medium ${
        tokenStatus.severity === 'error' ? 'text-red-800' : 'text-yellow-800'
      }`}>
        ⚠️ Token Issue Detected
      </h3>
      <p className={`text-sm mt-1 ${
        tokenStatus.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
      }`}>
        {tokenStatus.message}
      </p>
      
      {tokenStatus.status === 'temporary_token' && (
        <div className="mt-3">
          <a
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors inline-block"
          >
            Install via OAuth
          </a>
        </div>
      )}
      
      {['missing_access_token', 'missing_refresh_token'].includes(tokenStatus.status) && (
        <div className="mt-3">
          <button
            onClick={() => window.open('https://marketplace.gohighlevel.com', '_blank')}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            Reinstall App
          </button>
        </div>
      )}
    </div>
  )
}

export default TokenStatusAlert