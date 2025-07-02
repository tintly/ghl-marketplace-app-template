import React, { useState } from 'react'

function FieldConflictDialog({ conflicts, onResolve, onCancel, loading = false }) {
  const [resolutions, setResolutions] = useState({})

  const handleResolutionChange = (fieldKey, resolution) => {
    setResolutions(prev => ({
      ...prev,
      [fieldKey]: resolution
    }))
  }

  const handleResolveAll = () => {
    const forceOverwrite = []
    const skipFields = []

    conflicts.forEach(conflict => {
      const resolution = resolutions[conflict.fieldKey] || 'skip'
      if (resolution === 'overwrite') {
        forceOverwrite.push(conflict.fieldKey)
      } else {
        skipFields.push(conflict.fieldKey)
      }
    })

    onResolve({ forceOverwrite, skipFields })
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'Empty'
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const getResolutionIcon = (resolution) => {
    switch (resolution) {
      case 'overwrite': return '✏️'
      case 'skip': return '⏭️'
      default: return '❓'
    }
  }

  const allResolved = conflicts.every(conflict => 
    resolutions[conflict.fieldKey] && resolutions[conflict.fieldKey] !== 'ask'
  )

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-medium text-gray-900">⚠️ Field Conflicts Detected</h3>
          <p className="text-sm text-gray-600 mt-1">
            Some fields already have data. Choose how to handle each conflict.
          </p>
        </div>

        {/* Conflicts List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {conflicts.map((conflict, index) => {
              const resolution = resolutions[conflict.fieldKey] || 'ask'
              
              return (
                <div key={conflict.fieldKey} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{conflict.fieldName}</h4>
                      <p className="text-xs text-gray-500">{conflict.fieldKey}</p>
                    </div>
                    <span className="text-lg">{getResolutionIcon(resolution)}</span>
                  </div>

                  {/* Current vs New Value */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-xs font-medium text-red-800 mb-1">Current Value</p>
                      <p className="text-sm text-red-700 break-words">
                        {formatValue(conflict.currentValue)}
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <p className="text-xs font-medium text-green-800 mb-1">New Value (AI Extracted)</p>
                      <p className="text-sm text-green-700 break-words">
                        {formatValue(conflict.newValue)}
                      </p>
                    </div>
                  </div>

                  {/* Resolution Options */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Choose action:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        resolution === 'overwrite' 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}>
                        <input
                          type="radio"
                          name={`resolution-${conflict.fieldKey}`}
                          value="overwrite"
                          checked={resolution === 'overwrite'}
                          onChange={(e) => handleResolutionChange(conflict.fieldKey, e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex items-center">
                          <span className="text-lg mr-2">✏️</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Overwrite</p>
                            <p className="text-xs text-gray-600">Replace with new value</p>
                          </div>
                        </div>
                      </label>

                      <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        resolution === 'skip' 
                          ? 'border-gray-500 bg-gray-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}>
                        <input
                          type="radio"
                          name={`resolution-${conflict.fieldKey}`}
                          value="skip"
                          checked={resolution === 'skip'}
                          onChange={(e) => handleResolutionChange(conflict.fieldKey, e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex items-center">
                          <span className="text-lg mr-2">⏭️</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Keep Current</p>
                            <p className="text-xs text-gray-600">Don't change this field</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
          <div className="text-sm text-gray-600">
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} to resolve
          </div>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            
            <button
              type="button"
              onClick={handleResolveAll}
              disabled={!allResolved || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </div>
              ) : (
                'Apply Resolutions'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FieldConflictDialog