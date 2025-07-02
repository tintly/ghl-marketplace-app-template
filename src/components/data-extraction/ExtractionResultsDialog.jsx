import React, { useState } from 'react'
import FieldConflictDialog from './FieldConflictDialog'
import ContactFieldAnalysis from './ContactFieldAnalysis'

function ExtractionResultsDialog({ 
  extractionResult, 
  onClose, 
  onRetryWithResolution,
  authService 
}) {
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [showFieldAnalysis, setShowFieldAnalysis] = useState(false)
  const [resolvingConflicts, setResolvingConflicts] = useState(false)

  const handleResolveConflicts = () => {
    setShowConflictDialog(true)
  }

  const handleConflictResolution = async ({ forceOverwrite, skipFields }) => {
    setResolvingConflicts(true)
    setShowConflictDialog(false)
    
    try {
      await onRetryWithResolution(forceOverwrite)
    } finally {
      setResolvingConflicts(false)
    }
  }

  const handleShowFieldAnalysis = () => {
    setShowFieldAnalysis(true)
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'Empty'
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const getResultIcon = () => {
    if (extractionResult.success) return '✅'
    if (extractionResult.requires_confirmation) return '⚠️'
    return '❌'
  }

  const getResultColor = () => {
    if (extractionResult.success) return 'text-green-600'
    if (extractionResult.requires_confirmation) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <>
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{getResultIcon()}</span>
                <div>
                  <h3 className={`text-lg font-medium ${getResultColor()}`}>
                    {extractionResult.success ? 'Extraction Completed' : 
                     extractionResult.requires_confirmation ? 'Conflicts Detected' : 
                     'Extraction Failed'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {extractionResult.success ? 'Contact has been updated successfully' :
                     extractionResult.requires_confirmation ? 'Some fields require confirmation to overwrite' :
                     'An error occurred during extraction'}
                  </p>
                </div>
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Success State */}
            {extractionResult.success && (
              <div className="space-y-4">
                {extractionResult.updated_fields && extractionResult.updated_fields.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Updated Fields ({extractionResult.updated_fields.length})</h4>
                    <div className="space-y-2">
                      {extractionResult.updated_fields.map((fieldKey, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-md p-3">
                          <p className="text-sm font-medium text-green-800">{fieldKey}</p>
                          {extractionResult.extracted_data && extractionResult.extracted_data[fieldKey] && (
                            <p className="text-xs text-green-700 mt-1">
                              New value: {formatValue(extractionResult.extracted_data[fieldKey])}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {extractionResult.skipped_fields && extractionResult.skipped_fields.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Skipped Fields ({extractionResult.skipped_fields.length})</h4>
                    <div className="space-y-2">
                      {extractionResult.skipped_fields.map((fieldKey, index) => (
                        <div key={index} className="bg-gray-50 border border-gray-200 rounded-md p-3">
                          <p className="text-sm font-medium text-gray-800">{fieldKey}</p>
                          <p className="text-xs text-gray-600 mt-1">Skipped due to overwrite policy</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {extractionResult.usage && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <h4 className="font-medium text-blue-900 mb-2">Usage Information</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>Model: {extractionResult.usage.model}</p>
                      <p>Tokens: {extractionResult.usage.total_tokens}</p>
                      <p>Cost: ${extractionResult.usage.cost_estimate}</p>
                      <p>Response Time: {extractionResult.usage.response_time_ms}ms</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conflict State */}
            {extractionResult.requires_confirmation && (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <h4 className="font-medium text-yellow-900 mb-2">Conflicts Found</h4>
                  <p className="text-sm text-yellow-800 mb-3">
                    {extractionResult.conflicts?.length || 0} field(s) have existing data that conflicts with extracted values.
                  </p>
                  <div className="space-y-2">
                    {extractionResult.conflicts?.slice(0, 3).map((conflict, index) => (
                      <div key={index} className="bg-white border border-yellow-300 rounded p-2">
                        <p className="text-sm font-medium text-gray-900">{conflict.fieldName}</p>
                        <p className="text-xs text-gray-600">
                          Current: {formatValue(conflict.currentValue)} → New: {formatValue(conflict.newValue)}
                        </p>
                      </div>
                    ))}
                    {extractionResult.conflicts?.length > 3 && (
                      <p className="text-xs text-yellow-700">
                        +{extractionResult.conflicts.length - 3} more conflicts...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error State */}
            {!extractionResult.success && !extractionResult.requires_confirmation && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 className="font-medium text-red-900 mb-2">Error Details</h4>
                <p className="text-sm text-red-800">{extractionResult.error || 'An unknown error occurred'}</p>
                {extractionResult.details && (
                  <p className="text-xs text-red-700 mt-2">{extractionResult.details}</p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
            <div className="flex space-x-2">
              {extractionResult.contact_id && extractionResult.location_id && (
                <button
                  onClick={handleShowFieldAnalysis}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  View Field Analysis
                </button>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Close
              </button>
              
              {extractionResult.requires_confirmation && (
                <button
                  onClick={handleResolveConflicts}
                  disabled={resolvingConflicts}
                  className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 rounded-md transition-colors"
                >
                  {resolvingConflicts ? 'Resolving...' : 'Resolve Conflicts'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conflict Resolution Dialog */}
      {showConflictDialog && extractionResult.conflicts && (
        <FieldConflictDialog
          conflicts={extractionResult.conflicts}
          onResolve={handleConflictResolution}
          onCancel={() => setShowConflictDialog(false)}
          loading={resolvingConflicts}
        />
      )}

      {/* Field Analysis Dialog */}
      {showFieldAnalysis && (
        <ContactFieldAnalysis
          contactId={extractionResult.contact_id}
          locationId={extractionResult.location_id}
          authService={authService}
          onClose={() => setShowFieldAnalysis(false)}
        />
      )}
    </>
  )
}

export default ExtractionResultsDialog