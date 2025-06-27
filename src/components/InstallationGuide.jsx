import React, { useState } from 'react'

function InstallationGuide({ user, onInstallationComplete }) {
  const [copied, setCopied] = useState(false)
  
  // Use the exact redirect URI from your marketplace app configuration
  const redirectUri = 'https://eloquent-moonbeam-8a5386.netlify.app/oauth/callback'
  
  // Use the actual client ID from your marketplace app
  const clientId = '685c90c16a67491ca1f5f7de-mcf0wxc1'
  
  // Use the exact scopes from your installation link
  const scopes = [
    'conversations.readonly',
    'conversations/message.readonly', 
    'conversations/reports.readonly',
    'contacts.readonly',
    'contacts.write',
    'locations.readonly',
    'locations/customFields.readonly',
    'locations/customFields.write',
    'oauth.readonly',
    'oauth.write'
  ].join(' ')
  
  const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(JSON.stringify({ userId: user?.userId }))}`

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          GoHighLevel Integration Setup Required
        </h2>
        
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Step 1: Install the App via OAuth
            </h3>
            <p className="text-blue-800 mb-4">
              Click the button below to authorize this app to access your GoHighLevel data and get real access tokens.
            </p>
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Install GoHighLevel Integration
            </a>
            <p className="text-xs text-blue-600 mt-2">
              This will open in a new tab and redirect to your deployed app after installation.
            </p>
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

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Required OAuth Scopes
            </h3>
            <p className="text-green-800 mb-2">
              This app requires the following OAuth scopes for full functionality:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-green-800">
              <div className="space-y-1">
                <p>• <code className="bg-green-100 px-1 rounded text-xs">conversations.readonly</code></p>
                <p>• <code className="bg-green-100 px-1 rounded text-xs">conversations/message.readonly</code></p>
                <p>• <code className="bg-green-100 px-1 rounded text-xs">conversations/reports.readonly</code></p>
                <p>• <code className="bg-green-100 px-1 rounded text-xs">contacts.readonly</code></p>
                <p>• <code className="bg-green-100 px-1 rounded text-xs">contacts.write</code></p>
              </div>
              <div className="space-y-1">
                <p>• <code className="bg-green-100 px-1 rounded text-xs">locations.readonly</code></p>
                <p>• <code className="bg-green-100 px-1 rounded text-xs">locations/customFields.readonly</code></p>
                <p>• <code className="bg-green-100 px-1 rounded text-xs">locations/customFields.write</code></p>
                <p>• <code className="bg-green-100 px-1 rounded text-xs">oauth.readonly</code></p>
                <p>• <code className="bg-green-100 px-1 rounded text-xs">oauth.write</code></p>
              </div>
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
              <p><strong>Client ID:</strong> {clientId}</p>
              <p><strong>Redirect URI:</strong> {redirectUri}</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Development vs Production
            </h3>
            <div className="text-gray-700 space-y-2 text-sm">
              <p>• <strong>Local Development:</strong> You're currently running on localhost:3000</p>
              <p>• <strong>OAuth Redirect:</strong> The installation will redirect to your deployed app at {redirectUri}</p>
              <p>• <strong>After Installation:</strong> Visit your deployed app to use the new tokens</p>
              <p>• <strong>Token Sync:</strong> The tokens will be available in both local and deployed environments</p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              What Happens Next?
            </h3>
            <div className="text-green-800 space-y-2">
              <p>1. Click the install button above (opens in new tab)</p>
              <p>2. You'll be redirected to GoHighLevel to authorize the app</p>
              <p>3. Choose the location you want to integrate with</p>
              <p>4. The app will receive real access tokens and store them securely</p>
              <p>5. You'll be redirected to your deployed app with working tokens</p>
              <p>6. Your existing configuration will be updated with real tokens</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InstallationGuide