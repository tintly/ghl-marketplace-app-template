import React from 'react'
import { getStandardFieldByKey, getStandardFieldIcon } from '../utils/standardContactFields'

function StandardExtractionFieldsList({ extractionFields, onEdit, onDelete }) {
  const getFieldDisplayData = (field) => {
    const standardField = getStandardFieldByKey(field.target_ghl_key)
    
    if (standardField) {
      return {
        isActive: true,
        name: standardField.name,
        dataType: standardField.dataType,
        fieldKey: standardField.key,
        description: standardField.description,
        category: standardField.category,
        source: 'standard'
      }
    }
    
    // Fallback if standard field not found
    return {
      isActive: false,
      name: field.field_name,
      dataType: 'TEXT',
      fieldKey: field.target_ghl_key,
      description: 'Unknown standard field',
      category: 'Unknown',
      source: 'fallback'
    }
  }

  const handleDelete = (field) => {
    const displayData = getFieldDisplayData(field)
    if (window.confirm(`Are you sure you want to delete the extraction configuration for "${field.field_name}"?\n\nThis will stop AI from extracting data to the ${displayData.name} field.`)) {
      onDelete(field.id)
    }
  }

  // Group fields by category for better organization
  const fieldsByCategory = extractionFields.reduce((acc, field) => {
    const displayData = getFieldDisplayData(field)
    const category = displayData.category || 'Other'
    
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push({ ...field, displayData })
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Configured Standard Fields</h3>
        <span className="text-sm text-gray-500">
          {extractionFields.length} field{extractionFields.length !== 1 ? 's' : ''} configured
        </span>
      </div>

      {extractionFields.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p>No standard fields configured</p>
          <p className="text-sm mt-1">Configure standard contact fields to start extracting data automatically.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(fieldsByCategory).map(([category, fields]) => (
            <div key={category} className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">{category}</h4>
              <div className="space-y-3">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg">
                            {getStandardFieldIcon(field.displayData.dataType)}
                          </span>
                          <h5 className="font-medium text-gray-900">{field.field_name}</h5>
                          
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Standard Field
                          </span>
                          
                          {field.is_required && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Required
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><span className="font-medium">Description:</span> {field.description}</p>
                          <p><span className="font-medium">Field Key:</span> {field.displayData.fieldKey}</p>
                          <p><span className="font-medium">Type:</span> {field.displayData.dataType}</p>
                          
                          {field.placeholder && (
                            <p><span className="font-medium">Placeholder:</span> {field.placeholder}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4 flex space-x-2">
                        {/* Edit button */}
                        <button
                          onClick={() => onEdit(field)}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="Edit extraction configuration"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        
                        {/* Delete button */}
                        <button
                          onClick={() => handleDelete(field)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Delete extraction configuration"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default StandardExtractionFieldsList