import React, { useState, useEffect } from 'react'
import { getFieldTypeIcon, getFieldTypeLabel, mapGHLFieldType, mapStandardFieldType } from '../../utils/customFieldUtils'
import { isStandardField } from '../../utils/standardContactFields'

function ExtractionFieldForm({ customField, editingField, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    field_name: '',
    description: '',
    target_ghl_key: '',
    field_type: 'TEXT',
    picklist_options: [],
    placeholder: '',
    is_required: false,
    sort_order: 0,
    overwrite_policy: 'always', // Default to always overwrite
    original_ghl_field_data: {}
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Simplified overwrite policy options (removed 'ask')
  const overwritePolicyOptions = [
    {
      value: 'always',
      label: 'Always overwrite',
      description: 'Replace existing data with new extracted values',
      icon: '✏️'
    },
    {
      value: 'only_empty',
      label: 'Only empty fields',
      description: 'Only update if field is currently empty',
      icon: '📝'
    },
    {
      value: 'never',
      label: 'Never overwrite',
      description: 'Skip this field if it has any data',
      icon: '🔒'
    }
  ]

  useEffect(() => {
    if (editingField) {
      const enhancedOptions = mergeOptionsWithLiveData(editingField)
      
      setFormData({
        field_name: editingField.field_name,
        description: editingField.description,
        target_ghl_key: editingField.target_ghl_key,
        field_type: editingField.field_type,
        picklist_options: enhancedOptions,
        placeholder: editingField.placeholder || '',
        is_required: editingField.is_required,
        sort_order: editingField.sort_order,
        overwrite_policy: editingField.overwrite_policy || 'always', // Default to always
        original_ghl_field_data: editingField.original_ghl_field_data || {}
      })
    } else if (customField) {
      if (customField.key && isStandardField(customField.key)) {
        // For standard fields, use the field type as is or default to TEXT
        const fieldType = customField.dataType || 'TEXT'
        
        setFormData({
          field_name: customField.name,
          description: customField.description || `Extract data for ${customField.name} field`,
          target_ghl_key: customField.key,
          field_type: fieldType,
          picklist_options: [],
          placeholder: '',
          is_required: false,
          sort_order: 0,
          overwrite_policy: 'always', // Default for new fields
          original_ghl_field_data: customField
        })
      } else {
        // For custom fields, map the GHL field type to our field type
        // Default to TEXT if we can't determine the type
        const fieldType = customField.dataType ? 
          (customField.dataType === 'SINGLE_OPTIONS' ? 'SINGLE_OPTIONS' : 
           customField.dataType === 'MULTIPLE_OPTIONS' ? 'MULTIPLE_OPTIONS' :
           customField.dataType === 'DATE' ? 'DATE' :
           customField.dataType === 'NUMERICAL' ? 'NUMERICAL' :
           customField.dataType === 'EMAIL' ? 'EMAIL' :
           customField.dataType === 'PHONE' ? 'PHONE' : 'TEXT') : 'TEXT'
        
        const options = customField.picklistOptions || []
        
        const enhancedOptions = Array.isArray(options) ? options.map(opt => {
          if (typeof opt === 'string') {
            return { value: opt, description: '' }
          } else if (opt && typeof opt === 'object') {
            return {
              value: opt.label || opt.value || opt.key || '',
              description: opt.description || ''
            }
          }
          return { value: '', description: '' }
        }).filter(opt => opt.value) : []
        
        setFormData({
          field_name: customField.name,
          description: `Extract data for ${customField.name} field`,
          target_ghl_key: customField.id,
          field_type: fieldType,
          picklist_options: enhancedOptions,
          placeholder: customField.placeholder || '',
          is_required: false,
          sort_order: 0,
          overwrite_policy: 'always', // Default for new fields
          original_ghl_field_data: customField
        })
      }
    }
  }, [customField, editingField])

  const mergeOptionsWithLiveData = (extractionField) => {
    const liveCustomField = window.currentCustomFields?.find(cf => cf.id === extractionField.target_ghl_key)
    
    if (liveCustomField && liveCustomField.picklistOptions) {
      const liveOptions = liveCustomField.picklistOptions
      const storedOptions = extractionField.picklist_options || []
      
      return liveOptions.map(liveOption => {
        const liveValue = typeof liveOption === 'string' ? liveOption : (liveOption.label || liveOption.value || liveOption)
        
        const storedOption = storedOptions.find(stored => {
          const storedValue = typeof stored === 'string' ? stored : stored.value
          return storedValue === liveValue
        })
        
        return {
          value: liveValue,
          description: storedOption?.description || ''
        }
      })
    }
    
    const storedOptions = extractionField.picklist_options || []
    return Array.isArray(storedOptions) ? storedOptions.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, description: '' }
      } else if (opt && typeof opt === 'object') {
        return {
          value: opt.value || opt.label || opt.key || '',
          description: opt.description || ''
        }
      }
      return { value: '', description: '' }
    }).filter(opt => opt.value) : []
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (loading) return
    
    setLoading(true)
    setError(null)

    try {
      const validFieldTypes = ['TEXT', 'NUMERICAL', 'SINGLE_OPTIONS', 'MULTIPLE_OPTIONS', 'DATE', 'EMAIL', 'PHONE']
      
      if (!validFieldTypes.includes(formData.field_type)) {
        throw new Error(`Invalid field type: ${formData.field_type}. Must be one of: ${validFieldTypes.join(', ')}`)
      }

      // Add field_key from original_ghl_field_data if available
      if (customField && customField.fieldKey) {
        formData.field_key = customField.fieldKey.replace(/^contact\./, '')
      } else if (customField && customField.key) {
        formData.field_key = customField.key.replace(/^contact\./, '')
      } else if (formData.original_ghl_field_data && formData.original_ghl_field_data.fieldKey) {
        formData.field_key = formData.original_ghl_field_data.fieldKey.replace(/^contact\./, '')
      } else if (customField && !isStandardFieldForm) {
        // For custom fields without a fieldKey, generate one from the name
        const fieldName = formData.field_name || customField.name
        formData.field_key = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
        console.log(`Generated simplified field_key for custom field: ${formData.field_key}`)
      }

      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
      setError(error.message)
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...formData.picklist_options]
    newOptions[index] = {
      ...newOptions[index],
      [field]: value
    }
    handleChange('picklist_options', newOptions)
  }

  const addPicklistOption = () => {
    handleChange('picklist_options', [
      ...formData.picklist_options, 
      { value: '', description: '' }
    ])
  }

  const removePicklistOption = (index) => {
    const newOptions = formData.picklist_options.filter((_, i) => i !== index)
    handleChange('picklist_options', newOptions)
  }

  const needsPicklistOptions = ['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS'].includes(formData.field_type)
  const isStandardFieldForm = customField && customField.key && isStandardField(customField.key)

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-4xl">
        {/* Header */}
        <div className="modal-header">
          <h3 className="text-lg font-medium text-gray-900">
            {editingField ? 'Edit Extraction Field' : 'Configure Data Extraction'}
          </h3>
          {customField && (
            <p className="text-sm text-gray-600 mt-1">
              Setting up extraction for: <span className="font-medium">{customField.name}</span>
              {isStandardFieldForm && (
                <span className="ml-2 field-badge bg-blue-100 text-blue-800">
                  Standard Field
                </span>
              )}
            </p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 error-card">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Scrollable Form Content */}
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="form-label">
                Field Name *
              </label>
              <input
                type="text"
                value={formData.field_name}
                onChange={(e) => handleChange('field_name', e.target.value)}
                className="form-input"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="form-label">
                AI Extraction Instructions *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                className="form-textarea"
                placeholder="Describe what data should be extracted and how the AI should identify it in conversations..."
                required
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Write clear instructions for the AI about what to extract and how to identify it in conversations.
              </p>
            </div>

            {/* Show field type for standard fields (read-only) */}
            {isStandardFieldForm ? (
              <div>
                <label className="form-label">
                  Field Type
                </label>
                <input
                  type="text"
                  value={getFieldTypeLabel(formData.field_type)}
                  className="form-input bg-gray-50 text-gray-600"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  Standard field types cannot be changed. Detected type: {formData.field_type}
                </p>
              </div>
            ) : (
              <div>
                <label className="form-label">
                  Field Type
                </label>
                <select
                  value={formData.field_type}
                  onChange={(e) => handleChange('field_type', e.target.value)}
                  className="form-select"
                  disabled={loading}
                >
                  <option value="TEXT">Text</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone Number</option>
                  <option value="NUMERICAL">Numerical</option>
                  <option value="SINGLE_OPTIONS">Single Choice</option>
                  <option value="MULTIPLE_OPTIONS">Multiple Choice</option>
                  <option value="DATE">Date</option>
                </select>
              </div>
            )}

            {/* Simplified Overwrite Policy Section */}
            <div>
              <label className="form-label">
                Data Overwrite Policy *
              </label>
              <div className="info-card">
                <p className="text-sm text-blue-800">
                  <strong>💡 Policy:</strong> Choose how to handle existing data when AI extracts new information.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {overwritePolicyOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`relative flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      formData.overwrite_policy === option.value
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="overwrite_policy"
                      value={option.value}
                      checked={formData.overwrite_policy === option.value}
                      onChange={(e) => handleChange('overwrite_policy', e.target.value)}
                      className="sr-only"
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <span className="text-lg mr-2">{option.icon}</span>
                        <span className="text-sm font-medium text-gray-900">{option.label}</span>
                      </div>
                      <p className="text-xs text-gray-600">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {needsPicklistOptions && (
              <div>
                <label className="form-label">
                  Choice Options & AI Descriptions *
                </label>
                <div className="info-card">
                  <p className="text-sm text-blue-800">
                    <strong>💡 AI Tip:</strong> Add descriptions to help the AI understand when to select each option. 
                    Be specific about the criteria or context that should trigger each choice.
                  </p>
                  {editingField && (
                    <p className="text-xs text-blue-700 mt-1">
                      <strong>Note:</strong> Option values are synced from GoHighLevel. You can only edit the AI descriptions here.
                    </p>
                  )}
                </div>
                
                <div className="space-y-4 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-4">
                  {formData.picklist_options.map((option, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Option {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removePicklistOption(index)}
                          className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded disabled:opacity-50"
                          disabled={loading || formData.picklist_options.length <= 1}
                          title="Remove option"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Option Value *
                          </label>
                          <input
                            type="text"
                            value={option.value || ''}
                            onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                            className="form-input text-sm"
                            placeholder={`Option ${index + 1}`}
                            disabled={loading}
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            AI Description (When to select this option)
                          </label>
                          <textarea
                            value={option.description || ''}
                            onChange={(e) => handleOptionChange(index, 'description', e.target.value)}
                            rows={2}
                            className="form-textarea text-sm"
                            placeholder="Describe when the AI should select this option..."
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={addPicklistOption}
                    className="w-full text-blue-600 hover:text-blue-700 text-sm flex items-center justify-center py-3 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 transition-colors disabled:opacity-50"
                    disabled={loading}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Another Option
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  Each option needs a value and description. The AI will use descriptions to understand when to select each option.
                </p>
              </div>
            )}

            <div>
              <label className="form-label">
                Placeholder Text
              </label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => handleChange('placeholder', e.target.value)}
                className="form-input"
                placeholder="Optional placeholder text for the AI..."
                disabled={loading}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_required"
                checked={formData.is_required}
                onChange={(e) => handleChange('is_required', e.target.checked)}
                className="form-checkbox"
                disabled={loading}
              />
              <label htmlFor="is_required" className="ml-2 block text-sm text-gray-700">
                This field is required
              </label>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Saving...' : (editingField ? 'Update Field' : 'Create Field')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExtractionFieldForm