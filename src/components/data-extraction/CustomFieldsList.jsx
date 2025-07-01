import React from 'react'
import { getFieldTypeIcon, getFieldTypeLabel, formatFieldType } from '../../utils/customFieldUtils'

function CustomFieldsList({ 
  customFields, 
  extractionFields, 
  onCreateExtraction, 
  onRefresh, 
  onCreateNewField, 
  onEditField,
  refreshing = false 
}) {
  const isFieldConfigured = (fieldId) => {
    return extractionFields.some(ef => ef.target_ghl_key === fieldId)
  }

  const getFieldStatus = (field) => {
    if (isFieldConfigured(field.id)) {
      return {
        status: 'configured',
        label: 'Configured',
        className: 'bg-green-100 text-green-800'
      }
    }
    return {
      status: 'available',
      label: 'Available',
      className: 'bg-gray-100 text-gray-800'
    }
  }

  const sortedFields = [...customFields].sort((a, b) => {
    // Sort by configured status first, then by name
    const aConfigured = isFieldConfigured(a.id)
    const bConfigured = isFieldConfigured(b.id)
    
    if (aConfigured && !bConfigured) return -1
    if (!aConfigured && bConfigured) return 1
    
    return a.name.localeCompare(b.name)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Available Custom Fields</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={onCreateNewField}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Field
          </button>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg 
              className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {customFields.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No custom fields found</p>
          <p className="text-sm mt-1 mb-4">Create custom fields in your GoHighLevel location or create them directly here.</p>
          <button
            onClick={onCreateNewField}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Your First Field
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sortedFields.map((field) => {
            const status = getFieldStatus(field)
            
            return (
              <div
                key={field.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">{getFieldTypeIcon(field.dataType)}</span>
                      <h4 className="font-medium text-gray-900">{field.name}</h4>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Type:</span> {getFieldTypeLabel(field.dataType)}</p>
                      <p><span className="font-medium">Key:</span> {field.fieldKey}</p>
                      {field.placeholder && (
                        <p><span className="font-medium">Placeholder:</span> {field.placeholder}</p>
                      )}
                      {field.picklistOptions && field.picklistOptions.length > 0 && (
                        <div>
                          <span className="font-medium">Options:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {field.picklistOptions.slice(0, 3).map((option, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800"
                              >
                                {typeof option === 'string' ? option : option.label}
                              </span>
                            ))}
                            {field.picklistOptions.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{field.picklistOptions.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4 flex space-x-2">
                    {/* Edit Field Button */}
                    <button
                      onClick={() => onEditField(field)}
                      className="text-gray-600 hover:text-gray-700 p-1"
                      title="Edit field"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Configure/Active Button */}
                    {!isFieldConfigured(field.id) ? (
                      <button
                        onClick={() => onCreateExtraction(field)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm transition-colors"
                      >
                        Configure
                      </button>
                    ) : (
                      <div className="flex items-center text-green-600">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Active</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CustomFieldsList