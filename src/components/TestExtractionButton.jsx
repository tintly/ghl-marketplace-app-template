import React, { useState } from 'react'

function TestExtractionButton({ user, authService }) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)
  const [showResults, setShowResults] = useState(false)

  const runTestExtraction = async () => {
    try {
      setTesting(true)
      console.log('Running test extraction...')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/test-openai-extraction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          conversation_id: 's5QLyA8BsRzGman0LYAw' // Default test conversation
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Test extraction failed')
      }

      const testResult = await response.json()
      console.log('Test extraction completed:', testResult)
      
      setResult(testResult)
      setShowResults(true)

    } catch (error) {
      console.error('Test extraction error:', error)
      setResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      setShowResults(true)
    } finally {
      setTesting(false)
    }
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'Empty'
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Test AI Extraction</h3>
        <p className="text-sm text-gray-600 mb-4">
          Test the complete extraction pipeline with a sample conversation to see how overwrite policies work.
        </p>
        
        <button
          onClick={runTestExtraction}
          disabled={testing}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-md transition-colors flex items-center"
        >
          {testing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Testing Extraction...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Test Extraction
            </>
          )}
        </button>
      </div>

      {/* Simple Results Display */}
      {showResults && result && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{result.success ? '✅' : '❌'}</span>
                  <div>
                    <h3 className={`text-lg font-medium ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                      {result.success ? 'Test Completed Successfully' : 'Test Failed'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {result.success ? 'Extraction and contact update completed' : 'An error occurred during testing'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowResults(false)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {result.success ? (
                <div className="space-y-4">
                  {/* Extracted Data */}
                  {result.extracted_data && Object.keys(result.extracted_data).length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Extracted Data</h4>
                      <div className="space-y-2">
                        {Object.entries(result.extracted_data).map(([key, value]) => (
                          <div key={key} className="bg-green-50 border border-green-200 rounded-md p-3">
                            <p className="text-sm font-medium text-green-800">{key}</p>
                            <p className="text-xs text-green-700 mt-1">
                              Value: {formatValue(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact Update Results */}
                  {result.contact_update && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Contact Update Results</h4>
                      {result.contact_update.success ? (
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <p className="text-sm text-green-800">Contact updated successfully</p>
                          {result.contact_update.updated_fields && result.contact_update.updated_fields.length > 0 && (
                            <p className="text-xs text-green-700 mt-1">
                              Updated fields: {result.contact_update.updated_fields.join(', ')}
                            </p>
                          )}
                          {result.contact_update.skipped_fields && result.contact_update.skipped_fields.length > 0 && (
                            <p className="text-xs text-green-700 mt-1">
                              Skipped fields: {result.contact_update.skipped_fields.join(', ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-md p-3">
                          <p className="text-sm text-red-800">Contact update failed</p>
                          <p className="text-xs text-red-700 mt-1">{result.contact_update.error}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Usage Information */}
                  {result.test_steps?.openai_extraction && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <h4 className="font-medium text-blue-900 mb-2">Usage Information</h4>
                      <div className="text-sm text-blue-800 space-y-1">
                        <p>Model: {result.test_steps.openai_extraction.model}</p>
                        <p>Tokens: {result.test_steps.openai_extraction.total_tokens}</p>
                        <p>Cost: ${result.test_steps.openai_extraction.cost_estimate}</p>
                        <p>Response Time: {result.test_steps.openai_extraction.response_time_ms}ms</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <h4 className="font-medium text-red-900 mb-2">Error Details</h4>
                  <p className="text-sm text-red-800">{result.error || 'An unknown error occurred'}</p>
                  {result.details && (
                    <p className="text-xs text-red-700 mt-2">{result.details}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowResults(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default TestExtractionButton