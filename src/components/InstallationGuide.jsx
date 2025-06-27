import React, { useState } from 'react'

function InstallationGuide({ user, onInstallationComplete }) {
  const [copied, setCopied] = useState(false)
  
  const redirectUri = `${window.location.origin}/oauth/callback`
  
  // Use environment variable for client ID or provide setup instructions
  const clientId = import.meta.env.VITE_GHL_MARKETPLACE_CLIENT_ID || 'your-ghl-marketplace-client-id'
  
  const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=conversations.readonly contacts.readonly locations.readonly&state=${encodeURIComponent(JSON.stringify({ userId: user?.userId }))}`

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isClientIdConfigured = clientId !== 'your-ghl-marketplace-client-id'

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          GoHighLevel Integration Setup Required
        </h2>
        
        <div className="space-y-6">
          {!isClientIdConfigured && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Configuration Required
              </h3>
              <p className="text-red-800 mb-4">
                Before you can install the app, you need to configure your GoHighLevel marketplace app credentials.
              </p>
              <div className="bg-white border rounded-md p-3 font-mono text-sm mb-4">
                <p className="text-gray-800 mb-2">Add to your environment variables:</p>
                <code className="block">VITE_GHL_MARKETPLACE_CLIENT_ID=your-actual-client-id</code>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Step 1: Install the App via OAuth
            </h3>
            <p className="text-blue-800 mb-4">
              Click the button below to authorize this app to access your GoHighLevel data and get real access tokens.
            </p>
            {isClientIdConfigured ? (
              <a
                href={authUrl}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Install GoHighLevel Integration
              </a>
            ) : (
              <button
                disabled
                className="inline-flex items-center px-4 py-2 bg-gray-400 text-white font-medium rounded-md cursor-not-allowed"
              >
                Configure Client ID First
              </button>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Why OAuth Installation is Required
            </h3>
            <div className="text-yellow-800 space-y-2">
              <p>• Your account currently has development tokens that cannot access real GHL data</p>
              <p>• OAuth installation provides real access tokens for your location</p>
              <p>• This enables actual data extraction from your GoHighLevel conversations</p>
              <p>• The installation links the app to your specific location with proper permissions</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Current Status
            </h3>
            <div className="text-gray-700 space-y-1 text-sm">
              <p><strong>User ID:</strong> {user?.userId}</p>
              <p><strong>Location ID:</strong> {user?.locationId}</p>
              <p><strong>Dev Mode:</strong> {user?.devMode ? 'Yes' : 'No'}</p>
              <p><strong>Token Status:</strong> {user?.tokenStatus || 'Unknown'}</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Marketplace App Settings
            </h3>
            <p className="text-gray-700 mb-4">
              In your GoHighLevel marketplace app settings, make sure to set the following redirect URI:
            </p>
            <div className="bg-white border rounded-md p-3 font-mono text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-800">{redirectUri}</span>
                <button
                  onClick={() => copyToClipboard(redirectUri)}
                  className="ml-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              What Happens Next?
            </h3>
            <div className="text-green-800 space-y-2">
              <p>1. You'll be redirected to GoHighLevel to authorize the app</p>
              <p>2. Choose the location you want to integrate with</p>
              <p>3. The app will receive real access tokens and store them securely</p>
              <p>4. You'll be redirected back here to start using the data extractor</p>
              <p>5. Your existing configuration will be updated with real tokens</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InstallationGuide