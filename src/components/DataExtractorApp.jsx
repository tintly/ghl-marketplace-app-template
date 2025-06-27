import React from 'react'

function DataExtractorApp({ user, authService }) {
  const getLocationDisplay = () => {
    if (user.activeLocation) {
      return `Location: ${user.activeLocation}`
    }
    return `Company: ${user.companyId}`
  }

  const getContextTypeDisplay = () => {
    return user.type === 'agency' ? 'Agency User' : 'Location User'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Data Extractor</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">{user.userName}</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {getLocationDisplay()}
              </span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Your Conversation Data Extractor
          </h2>
          <p className="text-lg text-gray-600">
            Extract valuable insights from your GoHighLevel conversations automatically.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">User ID</h3>
            <p className="mt-2 text-lg font-semibold text-gray-900 break-all">{user.userId}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Location ID</h3>
            <p className="mt-2 text-lg font-semibold text-gray-900 break-all">{user.locationId}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">User Role</h3>
            <p className="mt-2 text-lg font-semibold text-gray-900">{user.role}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Context Type</h3>
            <p className="mt-2 text-lg font-semibold text-gray-900">{getContextTypeDisplay()}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Email</h3>
            <p className="mt-2 text-lg font-semibold text-gray-900 break-all">{user.email}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Company ID</h3>
            <p className="mt-2 text-lg font-semibold text-gray-900 break-all">{user.companyId}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Available Features</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">🔍</div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Data Extraction</h4>
                <p className="text-gray-600 mb-4">Set up custom fields to extract from conversations</p>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
                  Configure
                </button>
              </div>
              
              <div className="text-center p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">⚙️</div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Rules & Triggers</h4>
                <p className="text-gray-600 mb-4">Define when and how data should be extracted</p>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
                  Manage
                </button>
              </div>
              
              <div className="text-center p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">📊</div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Analytics</h4>
                <p className="text-gray-600 mb-4">View extraction performance and insights</p>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
                  View Reports
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default DataExtractorApp