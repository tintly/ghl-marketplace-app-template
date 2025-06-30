import React, { useState, useEffect } from 'react'
import { getFieldTypeLabel, mapGHLFieldType } from '../../utils/customFieldUtils'

function ExtractionFieldForm({ customField, editingField, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    field_name: '',
    description: '',
    target_ghl_key: '',
    field_type: 'TEXT',
    picklist_options: [],
    placeholder: '',
    is_required: false,
    sort_order: 0
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
        sort_order: editingField.sort_order
      })
    } else if (customField) {
      // Creating new field from custom field
      const mappedType = mapGHLFieldType(customField.dataType)
      const options = customField.picklistOptions || []
      
      setFormData({
        field_name: customField.name,
        description: `Extract data for ${customField.name} field`,
        target_ghl_key: customField.id,
        field_type: mappedType,
        picklist_options: Array.isArray(options) ? options.map(opt => 
          typeof opt === 'string' ? opt : opt.label || opt.value || ''
        ).filter(Boolean) : [],
        placeholder: customField.placeholder || '',
        is_required: false,
        sort_order: 0
      })
    }
  }, [customField, editingField])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePicklistChange = (index, value) => {
    const newOptions = [...formData.picklist_options]
    newOptions[index] = value
    handleChange('picklist_options', newOptions)
  }

  const addPicklistOption = () => {
    handleChange('picklist_options', [...formData.picklist_options, ''])
  }

  const removePicklistOption = (index) => {
    const newOptions = formData.picklist_options.filter((_, i) => i !== index)
    handleChange('picklist_options', newOptions)
  }

  const needsPicklistOptions = ['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS'].includes(formData.field_type)

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white my-8">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {editingField ? 'Edit Extraction Field' : 'Configure Data Extraction'}
          </h3>
          {customField && (
            <p className="text-sm text-gray-600 mt-1">
              Setting up extraction for: <span className="font-medium">{customField.name}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="max-h-[70vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what data should be extracted and how it should be used..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Type
              </label>
              <select
                value={formData.field_type}
                onChange={(e) => handleChange('field_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TEXT">Text</option>
                <option value="NUMERICAL">Numerical</option>
                <option value="SINGLE_OPTIONS">Single Choice</option>
                <option value="MULTIPLE_OPTIONS">Multiple Choice</option>
                <option value="DATE">Date</option>
              </select>
            </div>

            {needsPicklistOptions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Options
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {formData.picklist_options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handlePicklistChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Option ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removePicklistOption(index)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPicklistOption}
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Option
                  </button>
                </div>
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
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_required"
                checked={formData.is_required}
                onChange={(e) => handleChange('is_required', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_required" className="ml-2 block text-sm text-gray-700">
                This field is required
              </label>
            </div>
          </form>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
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