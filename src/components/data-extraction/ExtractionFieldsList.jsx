import React from 'react'
import { getFieldTypeIcon, getFieldTypeLabel } from '../../utils/customFieldUtils'

function ExtractionFieldsList({ extractionFields, customFields, onEdit, onDelete, onRecreate }) {
  const getCustomFieldInfo = (targetKey) => {
    return customFields.find(cf => cf.id === targetKey)
  }

  const isFieldActive = (targetKey) => {
    return !!getCustomFieldInfo(targetKey)
  }

  const getFieldDisplayData = (field) => {
    const customField = getCustomFieldInfo(field.target_ghl_key)
    
    if (customField) {
      // Field is active in GHL
      return {
        isActive: true,
        name: customField.name,
        dataType: customField.dataType,
        picklistOptions: customField.picklistOptions || [],
        source: 'ghl'
      }
    } else if (field.original_ghl_field_data && Object.keys(field.original_ghl_field_data).length > 0) {
      // Field is inactive, use stored data
      return {
        isActive: false,
        name: field.original_ghl_field_data.name || field.field_name,
        dataType: field.original_ghl_field_data.dataType || 'TEXT',
        picklistOptions: field.original_ghl_field_data.picklistOptions || [],
        source: 'stored'
      }
    } else {
      // Fallback to extraction field data
      return {
        isActive: false,
        name: field.field_name,
        dataType: 'TEXT',
        picklistOptions: field.picklist_options || [],
        source: 'fallback'
      }
    }
  }

  const canRecreateField = (field) => {
    return field.original_ghl_field_data && 
           Object.keys(field.original_ghl_field_data).length > 0 &&
           field.original_ghl_field_data.name &&
           field.original_ghl_field_data.dataType &&
           field.original_ghl_field_data.fieldKey
  }

  const handleDelete = (field) => {
    if (window.confirm(`Are you sure you want to delete the extraction configuration for "${field.field_name}"?`)) {
      onDelete(field.id)
    }
  }

  const handleRecreate = (field) => {
    const displayData = getFieldDisplayData(field)
    if (window.confirm(`Are you sure you want to recreate the "${displayData.name}" field in GoHighLevel?\n\nThis will create a new custom field with the same configuration as the original.`)) {
      onRecreate(field)
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
            const displayData = getFieldDisplayData(field)
            const canRecreate = canRecreateField(field)
            
            return (
              <div
                key={field.id}
                className={`border rounded-lg p-4 hover:shadow-sm transition-shadow ${
                  displayData.isActive ? 'border-gray-200' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">
                        {getFieldTypeIcon(displayData.dataType)}
                      </span>
                      <h4 className="font-medium text-gray-900">{field.field_name}</h4>
                      
                      {/* Status badges */}
                      {displayData.isActive ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          No longer active
                        </span>
                      )}
                      
                      {field.is_required && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Required
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Description:</span> {field.description}</p>
                      <p><span className="font-medium">Type:</span> {getFieldTypeLabel(displayData.dataType)}</p>
                      
                      {displayData.isActive ? (
                        <p><span className="font-medium">GHL Field:</span> {displayData.name}</p>
                      ) : (
                        <p><span className="font-medium">Original Field:</span> {displayData.name} <span className="text-red-600">(deleted from GHL)</span></p>
                      )}
                      
                      {field.placeholder && (
                        <p><span className="font-medium">Placeholder:</span> {field.placeholder}</p>
                      )}
                      
                      {displayData.picklistOptions && displayData.picklistOptions.length > 0 && (
                        <div>
                          <span className="font-medium">Options:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {displayData.picklistOptions.slice(0, 3).map((option, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800"
                              >
                                {typeof option === 'string' ? option : option.label || option.value || option}
                              </span>
                            ))}
                            {displayData.picklistOptions.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{displayData.picklistOptions.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {!displayData.isActive && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <p className="text-yellow-800">
                            <strong>Note:</strong> This field was deleted from GoHighLevel. 
                            {canRecreate ? ' You can recreate it using the stored configuration.' : ' Recreation data is not available.'}
                          </p>
                          {!canRecreate && (
                            <p className="text-yellow-700 mt-1">
                              <strong>Missing data:</strong> Original field configuration is incomplete.
                            </p>
                          )}
                        </div>
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
                    
                    {/* Recreate button (only for inactive fields with complete data) */}
                    {!displayData.isActive && canRecreate && onRecreate && (
                      <button
                        onClick={() => handleRecreate(field)}
                        className="text-green-600 hover:text-green-700 p-1"
                        title="Recreate field in GoHighLevel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )}
                    
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
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ExtractionFieldsList