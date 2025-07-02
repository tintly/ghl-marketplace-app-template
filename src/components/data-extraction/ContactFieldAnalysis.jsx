import React, { useState, useEffect } from 'react'

function ContactFieldAnalysis({ contactId, locationId, authService, onClose }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (contactId && locationId) {
      fetchContactAnalysis()
    }
  }, [contactId, locationId])

  const fetchContactAnalysis = async () => {
    try {
      setLoading(true)
      setError(null)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/get-ghl-contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          ghl_contact_id: contactId,
          location_id: locationId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch contact analysis')
      }

      const data = await response.json()
      setAnalysis(data)
    } catch (error) {
      console.error('Error fetching contact analysis:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'Empty'
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const getFieldStatusIcon = (field) => {
    if (!field.hasValue) return '📝' // Empty
    if (!field.isOverwritable) return '🔒' // Protected
    return '✏️' // Overwritable
  }

  const getFieldStatusColor = (field) => {
    if (!field.hasValue) return 'bg-gray-100 text-gray-800'
    if (!field.isOverwritable) return 'bg-red-100 text-red-800'
    return 'bg-yellow-100 text-yellow-800'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-700">Analyzing contact fields...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <h3 className="text-lg font-medium text-red-900 mb-2">Analysis Error</h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <div className="flex space-x-3">
            <button
              onClick={fetchContactAnalysis}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
            >
              Retry
            </button>
            <button
              onClick={onClose}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Contact Field Analysis</h3>
              <p className="text-sm text-gray-600 mt-1">
                {analysis.contact.name || analysis.contact.firstName || 'Contact'} - Field Status Overview
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{analysis.summary.totalFields}</div>
              <div className="text-xs text-gray-600">Total Fields</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{analysis.summary.emptyFields}</div>
              <div className="text-xs text-gray-600">Empty Fields</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{analysis.summary.overwritableFields}</div>
              <div className="text-xs text-gray-600">Overwritable</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{analysis.summary.protectedFields}</div>
              <div className="text-xs text-gray-600">Protected</div>
            </div>
          </div>
        </div>

        {/* Field Analysis */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">
            {analysis.field_analysis.map((field, index) => (
              <div key={field.fieldKey} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{getFieldStatusIcon(field)}</span>
                      <h4 className="font-medium text-gray-900">{field.fieldName}</h4>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getFieldStatusColor(field)}`}>
                        {field.hasValue ? (field.isOverwritable ? 'Overwritable' : 'Protected') : 'Empty'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{field.fieldKey}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Current Value</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                      <p className="text-sm text-gray-700 break-words">
                        {formatValue(field.currentValue)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Policy & Status</p>
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                      <p className="text-sm text-blue-700">{field.reason}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  )
}

export default ContactFieldAnalysis