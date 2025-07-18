import React, { useState } from 'react'

function InstallationGuide({ user, onInstallationComplete }) {
  const [copied, setCopied] = useState(false)
  
  // The EXACT OAuth URL that should be opened
  const OAUTH_INSTALL_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=https%3A%2F%2Feloquent-moonbeam-8a5386.netlify.app%2Foauth%2Fcallback&client_id=685c90c16a67491ca1f5f7de-mcf0wxc1&scope=conversations.readonly+conversations%2Fmessage.readonly+conversations%2Freports.readonly+contacts.readonly+contacts.write+locations.readonly+locations%2FcustomFields.readonly+locations%2FcustomFields.write+oauth.readonly+oauth.write'

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openInstallWindow = () => {
    console.log('Opening OAuth installation URL:', OAUTH_INSTALL_URL)
    // Open the OAuth URL in a new window
    window.open(OAUTH_INSTALL_URL, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Integration Setup Required
        </h2>
        
        <div className="space-y-6">
          <div className="info-card">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Connect Your Account
            </h3>
            <p className="text-blue-800 mb-4">
              Click the button below to authorize this app and get real access tokens.
            </p>
            <button
              onClick={openInstallWindow}
              className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors text-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Connect Account
            </button>
          </div>

          <div className="warning-card">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Why Connection is Required
            </h3>
            <div className="text-yellow-800 space-y-2">
              <p>• Your account currently has development tokens that cannot access real data</p>
              <p>• This connection provides real access tokens for your location</p>
              <p>• This enables actual data extraction from your conversations</p>
              <p>• The connection links the app to your specific location with proper permissions</p>
            </div>
          </div>

          <div className="success-card">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              What Happens Next?
            </h3>
            <div className="text-green-800 space-y-2">
              <p>1. Click the install button above (opens in new window)</p>
              <p>2. You'll be redirected to authorize the app</p>
              <p>3. Choose the location you want to integrate with</p>
              <p>4. The app will receive real access tokens and store them securely</p>
              <p>5. You'll be redirected back with working tokens</p>
              <p>6. Your existing configuration will be updated with real tokens</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Installation URL (for verification)
            </h3>
            <div className="bg-white border rounded-md p-3 font-mono text-xs break-all">
              <div className="flex items-start justify-between">
                <span className="text-gray-800 flex-1 mr-2">{OAUTH_INSTALL_URL}</span>
                <button
                  onClick={() => copyToClipboard(OAUTH_INSTALL_URL)}
                  className="ml-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
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
              <p><strong>Client ID:</strong> 685c90c16a67491ca1f5f7de-mcf0wxc1</p>
              <p><strong>Redirect URI:</strong> https://eloquent-moonbeam-8a5386.netlify.app/oauth/callback</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InstallationGuide