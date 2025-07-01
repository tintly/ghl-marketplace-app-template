import React, { useState, useEffect } from 'react'
import { getFieldTypeLabel, mapGHLFieldType } from '../../utils/customFieldUtils'
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
    original_ghl_field_data: {}
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (editingField) {
      // Editing existing field
      setFormData({
        field_name: editingField.field_name,
        description: editingField.description,
        target_ghl_key: editingField.target_ghl_key,
        field_type: editingField.field_type,
        picklist_options: editingField.picklist_options || [],
        placeholder: editingField.placeholder || '',
        is_required: editingField.is_required,
        sort_order: editingField.sort_order,
        original_ghl_field_data: editingField.original_ghl_field_data || {}
      })
    } else if (customField) {
      // Creating new field from custom field or standard field
      if (customField.key && isStandardField(customField.key)) {
        // This is a standard field
        setFormData({
          field_name: customField.name,
          description: customField.description || `Extract data for ${customField.name} field`,
          target_ghl_key: customField.key,
          field_type: customField.dataType,
          picklist_options: [],
          placeholder: '',
          is_required: false,
          sort_order: 0,
          original_ghl_field_data: customField
        })
      } else {
        // This is a GoHighLevel custom field
        const mappedType = mapGHLFieldType(customField.dataType)
        const options = customField.picklistOptions || []
        
        // Convert simple options to objects with descriptions
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
          field_type: mappedType,
          picklist_options: enhancedOptions,
          placeholder: customField.placeholder || '',
          is_required: false,
          sort_order: 0,
          original_ghl_field_data: customField
        })
      }
    }
  }, [customField, editingField])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (loading) return
    
    setLoading(true)
    setError(null)

    try {
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-medium text-gray-900">
            {editingField ? 'Edit Extraction Field' : 'Configure Data Extraction'}
          </h3>
          {customField && (
            <p className="text-sm text-gray-600 mt-1">
              Setting up extraction for: <span className="font-medium">{customField.name}</span>
              {isStandardFieldForm && (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Standard Field
                </span>
              )}
            </p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-md p-3 flex-shrink-0">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Name *
              </label>
              <input
                type="text"
                value={formData.field_name}
                onChange={(e) => handleChange('field_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Extraction Instructions *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Type
                </label>
                <input
                  type="text"
                  value={getFieldTypeLabel(formData.field_type)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  Standard field types cannot be changed
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Type
                </label>
                <select
                  value={formData.field_type}
                  onChange={(e) => handleChange('field_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="TEXT">Text</option>
                  <option value="NUMERICAL">Numerical</option>
                  <option value="SINGLE_OPTIONS">Single Choice</option>
                  <option value="MULTIPLE_OPTIONS">Multiple Choice</option>
                  <option value="DATE">Date</option>
                </select>
              </div>
            )}

            {needsPicklistOptions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choice Options & AI Descriptions *
                </label>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>💡 AI Tip:</strong> Add descriptions to help the AI understand when to select each option. 
                    Be specific about the criteria or context that should trigger each choice.
                  </p>
                </div>
                
                <div className="space-y-4 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-4">
                  {formData.picklist_options.map((option, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Option {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removePicklistOption(index)}
                          className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placeholder Text
              </label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => handleChange('placeholder', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={loading}
              />
              <label htmlFor="is_required" className="ml-2 block text-sm text-gray-700">
                This field is required
              </label>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
          >
            {loading ? 'Saving...' : (editingField ? 'Update Field' : 'Create Field')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExtractionFieldForm