import React from 'react'
import { getFieldTypeIcon, getFieldTypeLabel } from '../../utils/customFieldUtils'

function ExtractionFieldsList({ extractionFields, customFields, onEdit, onDelete }) {
  const getCustomFieldInfo = (targetKey) => {
    return customFields.find(cf => cf.id === targetKey)
  }

  const handleDelete = (field) => {
    if (window.confirm(`Are you sure you want to delete the extraction configuration for "${field.field_name}"?`)) {
      onDelete(field.id)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Configured Extractions</h3>
        <span className="text-sm text-gray-500">
          {extractionFields.length} field{extractionFields.length !== 1 ? 's' : ''} configured
        </span>
      </div>

      {extractionFields.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p>No extraction fields configured</p>
          <p className="text-sm mt-1">Configure custom fields to start extracting data automatically.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {extractionFields.map((field) => {
            const customField = getCustomFieldInfo(field.target_ghl_key)
            
            return (
              <div
                key={field.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">
                        {customField ? getFieldTypeIcon(customField.dataType) : '📝'}
                      </span>
                      <h4 className="font-medium text-gray-900">{field.field_name}</h4>
                      {field.is_required && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Description:</span> {field.description}</p>
                      <p><span className="font-medium">Type:</span> {getFieldTypeLabel(field.field_type)}</p>
                      {customField && (
                        <p><span className="font-medium">GHL Field:</span> {customField.name}</p>
                      )}
                      {field.placeholder && (
                        <p><span className="font-medium">Placeholder:</span> {field.placeholder}</p>
                      )}
                      {field.picklist_options && field.picklist_options.length > 0 && (
                        <div>
                          <span className="font-medium">Options:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {field.picklist_options.slice(0, 3).map((option, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800"
                              >
                                {option}
                              </span>
                            ))}
                            {field.picklist_options.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{field.picklist_options.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4 flex space-x-2">
                    <button
                      onClick={() => onEdit(field)}
                      className="text-blue-600 hover:text-blue-700 p-1"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(field)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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

export default ExtractionFieldsList