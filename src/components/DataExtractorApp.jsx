import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { WhiteLabelProvider, useWhiteLabel } from './WhiteLabelProvider'
import UserLinking from './UserLinking'
import DataExtractionModule from './DataExtractionModule'
import SubscriptionManager from './SubscriptionManager'
import StandardFieldsExtractionModule from './StandardFieldsExtractionModule'
import AgencyBrandingManager from './AgencyBrandingManager'
import AgencyOpenAIManager from './AgencyOpenAIManager'
import AgencyLicensedLocationsManager from './AgencyLicensedLocationsManager'
import InstallationGuide from './InstallationGuide'
import Navigation from './Navigation'
import LogViewer from './LogViewer'

function DataExtractorApp({ user, authService }) {
  return (
    <WhiteLabelProvider authService={authService} locationId={user?.locationId}>
      <DataExtractorAppContent user={user} authService={authService} />
    </WhiteLabelProvider>
  )
}

function DataExtractorAppContent({ user, authService }) {
  const { getAppName, getAgencyName, shouldHideGHLBranding, getWelcomeMessage } = useWhiteLabel()

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

  // Helper function to check if user can access subscription management
  const canAccessSubscription = () => {
    return user?.type === 'agency' && user?.role === 'admin'
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
            <h1 className="text-2xl font-bold text-gray-900">{getAppName()}</h1>
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
        
        {!needsOAuthInstallation() && <Navigation user={user} />}
        
        <Routes>
          <Route path="/" element={<DashboardHome user={user} authService={authService} needsOAuth={needsOAuthInstallation()} getWelcomeMessage={getWelcomeMessage} getAgencyName={getAgencyName} canAccessSubscription={canAccessSubscription()} />} />
          <Route path="/subscription" element={
            needsOAuthInstallation() ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Please complete the OAuth installation first.</p>
              </div>
            ) : !canAccessSubscription() ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
                <p className="text-gray-600 mb-4">
                  Subscription management is only available to agency administrators.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Current User Details:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li><strong>Type:</strong> {user?.type || 'Unknown'}</li>
                    <li><strong>Role:</strong> {user?.role || 'Unknown'}</li>
                    <li><strong>Required:</strong> Agency Admin</li>
                  </ul>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Contact your agency administrator to manage subscription settings.
                </p>
              </div>
            ) : (
              <SubscriptionManager user={user} authService={authService} />
            )
          } />
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
          <Route path="/logs" element={
            needsOAuthInstallation() ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Please complete the OAuth installation first.</p>
              </div>
            ) : (
              <LogViewer user={user} />
            )
          } />
          <Route path="/branding" element={
            needsOAuthInstallation() ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Please complete the OAuth installation first.</p>
              </div>
            ) : (
              <AgencyBrandingManager user={user} authService={authService} />
            )
          } />
          <Route path="/openai-keys" element={
            needsOAuthInstallation() ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Please complete the OAuth installation first.</p>
              </div>
            ) : (
              <AgencyOpenAIManager user={user} authService={authService} />
            )
          } />
          <Route path="/licensed-locations" element={
            needsOAuthInstallation() ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Please complete the OAuth installation first.</p>
              </div>
            ) : (
              <AgencyLicensedLocationsManager user={user} authService={authService} />
            )
          } />
        </Routes>
      </main>
    </div>
  )
}

function DashboardHome({ user, authService, needsOAuth, getWelcomeMessage, getAgencyName, canAccessSubscription }) {
  if (needsOAuth) {
    return (
      <div className="space-y-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Setup Required
          </h2>
          <p className="text-lg text-gray-600">
            Complete the connection above to start extracting data from your conversations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Subscription Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold">Manage Your Subscription</h3>
            <p className="mt-1 text-blue-100">
              View your current plan, usage statistics, and upgrade options.
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <a href="/subscription" className="inline-block px-5 py-2 bg-white text-blue-600 font-medium rounded-md shadow-sm hover:bg-blue-50 transition-colors">
              View Subscription
            </a>
          </div>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {getWelcomeMessage()}
        </h2>
        <p className="text-lg text-gray-600">
          Extract valuable insights from your conversations automatically.
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 border border-gray-200 rounded-lg card-hover">
              <div className="text-4xl mb-4">🔧</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Custom Fields</h4>
              <p className="text-gray-600 mb-4">Create and configure custom fields for data extraction</p>
              <a
                href="/data-extraction"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors font-medium inline-block"
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors font-medium inline-block"
              >
                Configure
              </a>
            </div>
            
            <div className="text-center p-6 border border-gray-200 rounded-lg card-hover">
              <div className="text-4xl mb-4">💰</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Subscription</h4>
              <p className="text-gray-600 mb-4">Manage your plan and view usage statistics</p>
              {canAccessSubscription ? (
                <a
                  href="/subscription"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors font-medium inline-block"
                >
                  Manage Plan
                </a>
              ) : (
                <div className="text-center">
                  <button
                    disabled
                    className="bg-gray-300 text-gray-500 px-4 py-2 rounded-md font-medium cursor-not-allowed inline-block"
                    title="Only available to agency administrators"
                  >
                    Manage Plan
                  </button>
                  <p className="text-xs text-gray-500 mt-2">Agency Admin Only</p>
                </div>
              )}
            </div>
            
            <div className="text-center p-6 border border-gray-200 rounded-lg card-hover">
              <div className="text-4xl mb-4">📊</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Extraction Logs</h4>
              <p className="text-gray-600 mb-4">View extraction history and message processing</p>
              <a
                href="/logs"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors font-medium inline-block"
              >
                View Logs
              </a>
            </div>
            
            {user.type === 'agency' && (
              <>
                <div className="text-center p-6 border border-gray-200 rounded-lg card-hover">
                  <div className="text-4xl mb-4">🎨</div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Agency Branding</h4>
                  <p className="text-gray-600 mb-4">Customize your white-label experience</p>
                  <a
                    href="/branding"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors font-medium inline-block"
                  >
                    Manage Branding
                  </a>
                </div>
                
                <div className="text-center p-6 border border-gray-200 rounded-lg card-hover">
                  <div className="text-4xl mb-4">🔑</div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">OpenAI Keys</h4>
                  <p className="text-gray-600 mb-4">Manage your agency's AI API keys</p>
                  <a
                    href="/openai-keys"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors font-medium inline-block"
                  >
                    Manage Keys
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
      </div>
    </div>
  )
}

export default DataExtractorApp