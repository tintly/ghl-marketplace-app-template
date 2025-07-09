import React from 'react'
import ConfigurationManager from './ConfigurationManager'

function TokenStatusAlert({ config }) {
  const configManager = new ConfigurationManager()
  const tokenStatus = configManager.validateTokenStatus(config)

  // Only show alert for critical errors that require user action
  if (tokenStatus.isValid) {
    return null
  }

  const openOAuthInstall = () => {
    const OAUTH_INSTALL_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=https%3A%2F%2Feloquent-moonbeam-8a5386.netlify.app%2Foauth%2Fcallback&client_id=685c90c16a67491ca1f5f7de-mcf0wxc1&scope=conversations.readonly+conversations%2Fmessage.readonly+conversations%2Freports.readonly+contacts.readonly+contacts.write+locations.readonly+locations%2FcustomFields.readonly+locations%2FcustomFields.write+oauth.readonly+oauth.write'
    console.log('Opening OAuth installation URL:', OAUTH_INSTALL_URL)
    window.open(OAUTH_INSTALL_URL, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
  }

  // Only show errors for invalid tokens that need user intervention
  if (['missing_access_token', 'missing_refresh_token'].includes(tokenStatus.status)) {
    return (
      <div className="error-card mb-6">
        <h3 className="text-red-800 font-medium">⚠️ Connection Required</h3>
        <p className="text-red-600 text-sm mt-1">Your connection has expired or is invalid. Please reconnect your account to continue using the app.</p>
        
        <div className="mt-3">
          <button
            onClick={openOAuthInstall}
            className="btn-danger"
          >
            Connect Account
          </button>
        </div>
      </div>
    )
  }

  // For temporary tokens, show OAuth installation option
  if (tokenStatus.status === 'temporary_token') {
    return (
      <div className="warning-card mb-6">
        <h3 className="text-yellow-800 font-medium">⚠️ Development Mode</h3>
        <p className="text-yellow-600 text-sm mt-1">You're using temporary tokens. Connect your account to access real data.</p>
        
        <div className="mt-3">
          <button
            onClick={openOAuthInstall}
            className="btn-primary"
          >
            Connect Account
          </button>
        </div>
      </div>
    )
  }

  // Don't show anything for expired tokens - let the automatic refresh handle it
  // But if token is expired, show a warning
  if (tokenStatus.status === 'expired') {
    return (
      <div className="warning-card mb-6">
        <h3 className="text-yellow-800 font-medium">⚠️ Connection Expired</h3>
        <p className="text-yellow-600 text-sm mt-1">Your connection has expired. The system will attempt to refresh it automatically.</p>
        
        <div className="mt-3">
          <button
            onClick={openOAuthInstall}
            className="btn-primary"
          >
            Reconnect Account
          </button>
        </div>
      </div>
    )
  }
  
  return null;
}

export default TokenStatusAlert