import React, { useState, useEffect } from 'react'
import { getFieldTypeIcon, getFieldTypeLabel } from '../../utils/customFieldUtils'

function CreateCustomFieldForm({ onSubmit, onCancel, customFields = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    dataType: 'TEXT',
    placeholder: '',
    picklistOptions: [],
    parentId: null,
    position: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Available field types based on your examples
  const fieldTypes = [
    { value: 'TEXT', label: 'Single Line Text', icon: '📝' },
    { value: 'LARGE_TEXT', label: 'Multi Line Text', icon: '📄' },
    { value: 'NUMERICAL', label: 'Numeric', icon: '🔢' },
    { value: 'MONETORY', label: 'Monetary', icon: '💰' },
    { value: 'PHONE', label: 'Phone Number', icon: '📞' },
    { value: 'EMAIL', label: 'Email', icon: '📧' },
    { value: 'DATE', label: 'Date Picker', icon: '📅' },
    { value: 'SINGLE_OPTIONS', label: 'Single Select Dropdown', icon: '🔘' },
    { value: 'MULTIPLE_OPTIONS', label: 'Multi Select Dropdown', icon: '☑️' },
    { value: 'RADIO', label: 'Radio Select', icon: '🔘' },
    { value: 'CHECKBOX', label: 'Checkbox', icon: '✅' },
    { value: 'TEXTBOX_LIST', label: 'Text Box List', icon: '📋' },
    { value: 'FILE_UPLOAD', label: 'File Upload', icon: '📎' }
  ]

  // Get available folders from existing custom fields
  const availableFolders = React.useMemo(() => {
    const folders = new Map()
    
    customFields.forEach(field => {
      if (field.parentId && !folders.has(field.parentId)) {
        // Try to find a field that represents this folder
        const folderField = customFields.find(f => f.id === field.parentId)
        if (folderField) {
          folders.set(field.parentId, {
            id: field.parentId,
            name: folderField.name || `Folder ${field.parentId.substring(0, 8)}...`
          })
        } else {
          // Create a generic folder entry
          folders.set(field.parentId, {
            id: field.parentId,
            name: `Folder ${field.parentId.substring(0, 8)}...`
          })
        }
      }
    })

    return Array.from(folders.values())
  }, [customFields])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (loading) return
    
    setLoading(true)
    setError(null)

    try {
      // Validate form data
      if (!formData.name.trim()) {
        throw new Error('Field name is required')
      }

      if (needsPicklistOptions && formData.picklistOptions.length === 0) {
        throw new Error(`${getFieldTypeLabel(formData.dataType)} requires at least one option`)
      }

      // Generate field key from name
      const fieldKey = `contact.${formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`

      // Prepare field data for GHL API
      const fieldData = {
        name: formData.name.trim(),
        dataType: formData.dataType,
        model: 'contact',
        fieldKey: fieldKey,
        placeholder: formData.placeholder.trim() || '',
        parentId: formData.parentId || null,
        position: formData.position || getNextPosition(),
        picklistOptions: formData.picklistOptions.filter(opt => opt.trim())
      }

      console.log('Creating custom field with data:', fieldData)
      await onSubmit(fieldData)
    } catch (error) {
      console.error('Form submission error:', error)
      setError(error.message)
      setLoading(false)
    }
  }

  const getNextPosition = () => {
    if (customFields.length === 0) return 50
    const maxPosition = Math.max(...customFields.map(f => f.position || 0))
    return maxPosition + 50
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Clear options when switching away from choice fields
    if (field === 'dataType' && !isChoiceField(value)) {
      setFormData(prev => ({
        ...prev,
        picklistOptions: []
      }))
    }
  }

  const handlePicklistChange = (index, value) => {
    const newOptions = [...formData.picklistOptions]
    newOptions[index] = value
    handleChange('picklistOptions', newOptions)
  }

  const addPicklistOption = () => {
    handleChange('picklistOptions', [...formData.picklistOptions, ''])
  }

  const removePicklistOption = (index) => {
    const newOptions = formData.picklistOptions.filter((_, i) => i !== index)
    handleChange('picklistOptions', newOptions)
  }

  const isChoiceField = (dataType) => {
    return ['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS', 'CHECKBOX', 'RADIO', 'TEXTBOX_LIST'].includes(dataType)
  }

  const needsPicklistOptions = isChoiceField(formData.dataType)

  // Add default options when switching to a choice field
  useEffect(() => {
    if (needsPicklistOptions && formData.picklistOptions.length === 0) {
      const defaultOptions = {
        'SINGLE_OPTIONS': ['Option 1', 'Option 2', 'Option 3'],
        'MULTIPLE_OPTIONS': ['Option A', 'Option B', 'Option C'],
        'CHECKBOX': ['Yes', 'No'],
        'RADIO': ['Option 1', 'Option 2', 'Option 3'],
        'TEXTBOX_LIST': ['Item 1', 'Item 2', 'Item 3']
      }
      
      handleChange('picklistOptions', defaultOptions[formData.dataType] || ['Option 1', 'Option 2'])
    }
  }, [formData.dataType, needsPicklistOptions])

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-medium text-gray-900">Create New Custom Field</h3>
          <p className="text-sm text-gray-600 mt-1">
            Create a new custom field in GoHighLevel and automatically configure it for data extraction.
          </p>
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
            {/* Field Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter field name..."
                required
                disabled={loading}
              />
              {formData.name && (
                <p className="text-xs text-gray-500 mt-1">
                  Field key will be: contact.{formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}
                </p>
              )}
            </div>

            {/* Field Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Type *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {fieldTypes.map((type) => (
                  <label
                    key={type.value}
                    className={`relative flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      formData.dataType === type.value
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dataType"
                      value={type.value}
                      checked={formData.dataType === type.value}
                      onChange={(e) => handleChange('dataType', e.target.value)}
                      className="sr-only"
                      disabled={loading}
                    />
                    <span className="text-lg mr-3">{type.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Folder Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Folder (Optional)
              </label>
              <select
                value={formData.parentId || ''}
                onChange={(e) => handleChange('parentId', e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">Root Level (No Folder)</option>
                {availableFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    📁 {folder.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose a folder to organize your custom field, or leave at root level.
              </p>
            </div>

            {/* Placeholder Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placeholder Text (Optional)
              </label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => handleChange('placeholder', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter placeholder text..."
                disabled={loading}
              />
            </div>

            {/* Options for Choice Fields */}
            {needsPicklistOptions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Options *
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {formData.picklistOptions.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 w-8">{index + 1}.</span>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handlePicklistChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Option ${index + 1}`}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => removePicklistOption(index)}
                        className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50"
                        disabled={loading || formData.picklistOptions.length <= 1}
                        title="Remove option"
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
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center disabled:opacity-50"
                    disabled={loading}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Option
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Add options for users to choose from. At least one option is required.
                </p>
              </div>
            )}

            {/* Field Preview */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Field Preview</h4>
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">{getFieldTypeIcon(formData.dataType)}</span>
                <span className="font-medium">{formData.name || 'Field Name'}</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {getFieldTypeLabel(formData.dataType)}
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Type:</strong> {getFieldTypeLabel(formData.dataType)}</p>
                <p><strong>Location:</strong> {formData.parentId ? `📁 ${availableFolders.find(f => f.id === formData.parentId)?.name || 'Selected Folder'}` : '📄 Root Level'}</p>
                {formData.placeholder && (
                  <p><strong>Placeholder:</strong> {formData.placeholder}</p>
                )}
                {needsPicklistOptions && formData.picklistOptions.length > 0 && (
                  <div>
                    <strong>Options:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {formData.picklistOptions.slice(0, 3).map((option, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800"
                        >
                          {option || `Option ${index + 1}`}
                        </span>
                      ))}
                      {formData.picklistOptions.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{formData.picklistOptions.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
            disabled={loading || !formData.name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </div>
            ) : (
              'Create Field'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateCustomFieldForm