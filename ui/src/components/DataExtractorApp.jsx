import React, { useState } from 'react'

const DataExtractorApp = () => {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            GHL Data Extractor
          </h1>
          <p className="text-gray-600">
            Extract and manage data from GoHighLevel
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Welcome to GHL Data Extractor
            </h2>
            <p className="text-gray-600 mb-6">
              This application helps you extract and manage data from GoHighLevel using Supabase Edge Functions.
            </p>
            
            {isLoading ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <button
                onClick={() => setIsLoading(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataExtractorApp