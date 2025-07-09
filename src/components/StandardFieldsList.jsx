import React from 'react'
import { STANDARD_FIELDS_BY_CATEGORY, getStandardFieldIcon } from '../utils/standardContactFields'

function StandardFieldsList({ extractionFields, onCreateExtraction }) {
  const isFieldConfigured = (fieldKey) => {
    return extractionFields.some(ef => ef.target_ghl_key === fieldKey)
  }

  const getFieldStatus = (field) => {
    if (isFieldConfigured(field.key)) {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Standard Contact Fields</h3>
        <span className="text-sm text-gray-500">
          Built-in contact fields
        </span>
      </div>

      <div className="space-y-6">
        {Object.entries(STANDARD_FIELDS_BY_CATEGORY).map(([category, fields]) => (
          <div key={category} className="border border-gray-200 rounded-lg p-4 bg-white">
            <h4 className="font-medium text-gray-900 mb-3">{category}</h4>
            <div className="space-y-3">
              {fields.map((field) => {
                const status = getFieldStatus(field)
                
                return (
                  <div
                    key={field.key}
                    className="field-card bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg">{getStandardFieldIcon(field.dataType)}</span>
                          <h5 className="font-medium text-gray-900">{field.name}</h5>
                          <span className={`field-badge ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><span className="font-medium">Field Key:</span> {field.key}</p>
                          <p><span className="font-medium">Type:</span> {field.dataType}</p>
                          <p><span className="font-medium">Description:</span> {field.description}</p>
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        {!isFieldConfigured(field.key) ? (
                          <button
                            onClick={() => onCreateExtraction(field)}
                            className="btn-primary text-sm"
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
          </div>
        ))}
      </div>
    </div>
  )
}

export default StandardFieldsList