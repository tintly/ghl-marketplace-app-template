import React from 'react'
import { Routes, Route } from 'react-router-dom'
import UserLinking from './UserLinking'
import DataExtractionModule from './DataExtractionModule'
import StandardFieldsExtractionModule from './StandardFieldsExtractionModule'
import InstallationGuide from './InstallationGuide'
import Navigation from './Navigation'

function DataExtractorApp({ user, authService }) {
  const getLocationDisplay = () => {
    if (user.activeLocation) {
      return `Location: ${user.activeLocation}`
    }
    return `Company: ${user.companyId}`
  }

  const getUserModeDisplay = () => {
    if (user.standaloneMode) return 'STANDALONE'
    return null
  }

  const handleLinkingComplete = () => {
    window.location.reload()
  }

  const handleInstallationComplete = () => {
    window.location.reload()
  }

  const needsOAuthInstallation = () => {
    if (user.standaloneMode) return false
    
    if (user.tokenValidation) {
      return !user.tokenValidation.isValid && 
             ['missing_access_token', 'missing_refresh_token'].includes(user.tokenValidation.status)
    }
    
    return user.tokenStatus === 'missing'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Data Extractor</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">{user.userName}</span>
              <span className="field-badge bg-blue-100 text-blue-800">
                {getLocationDisplay()}
              </span>
              {getUserModeDisplay() && (
                <span className="field-badge bg-green-100 text-green-800">
                  {getUserModeDisplay()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {needsOAuthInstallation() && (
          <div className="mb-8">
            <InstallationGuide user={user} onInstallationComplete={handleInstallationComplete} />
          </div>
        )}
        
        {!user.standaloneMode && !needsOAuthInstallation() && (
          <UserLinking user={user} authService={authService} onLinkingComplete={handleLinkingComplete} />
        )}
        
        {!needsOAuthInstallation() && <Navigation />}
        
        <Routes>
          <Route path="/" element={<DashboardHome user={user} authService={authService} needsOAuth={needsOAuthInstallation()} />} />
          <Route path="/data-extraction" element={
            needsOAuthInstallation() ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Please complete the OAuth installation first.</p>
              </div>
            ) : (
              <DataExtractionModule user={user} authService={authService} />
            )
          } />
          <Route path="/standard-fields" element={
            needsOAuthInstallation() ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Please complete the OAuth installation first.</p>
              </div>
            ) : (
              <StandardFieldsExtractionModule user={user} authService={authService} />
            )
          } />
        </Routes>
      </main>
    </div>
  )
}

function DashboardHome({ user, authService, needsOAuth }) {
  if (needsOAuth) {
    return (
      <div className="space-y-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Setup Required
          </h2>
          <p className="text-lg text-gray-600">
            Complete the OAuth installation above to start extracting data from your GoHighLevel conversations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Your Conversation Data Extractor
        </h2>
        <p className="text-lg text-gray-600">
          Extract valuable insights from your GoHighLevel conversations automatically.
        </p>
        {user.standaloneMode && (
          <div className="mt-4 success-card">
            <p className="text-sm text-green-800">
              <strong>Standalone Mode:</strong> You're using this app as a standalone installation. 
              This installation was completed via OAuth and has proper access tokens.
            </p>
            <p className="text-xs text-green-700 mt-1">
              Installed: {new Date(user.installedAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="section-title">Available Features</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center p-6 border border-gray-200 rounded-lg card-hover">
              <div className="text-4xl mb-4">🔧</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Custom Fields</h4>
              <p className="text-gray-600 mb-4">Create and configure custom fields for data extraction</p>
              <a
                href="/data-extraction"
                className="btn-primary inline-block"
              >
                Configure
              </a>
            </div>
            
            <div className="text-center p-6 border border-gray-200 rounded-lg card-hover">
              <div className="text-4xl mb-4">👤</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Standard Fields</h4>
              <p className="text-gray-600 mb-4">Configure extraction for built-in contact fields</p>
              <a
                href="/standard-fields"
                className="btn-success inline-block"
              >
                Configure
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataExtractorApp