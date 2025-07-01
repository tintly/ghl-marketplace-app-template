import React, { useState, useEffect } from 'react'
import { getFieldTypeIcon, getFieldTypeLabel } from '../../utils/customFieldUtils'

function CustomFieldEditForm({ customField, onSubmit, onCancel, onDelete }) {
  const [formData, setFormData] = useState({
    name: '',
    placeholder: '',
    picklistOptions: [],
    position: 0
  })
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    if (customField) {
      setFormData({
        name: customField.name || '',
        placeholder: customField.placeholder || '',
        picklistOptions: customField.picklistOptions || [],
        position: customField.position || 0
      })
    }
  }, [customField])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (loading || deleting) return
    
    setLoading(true)
    setError(null)

    try {
      // Validate form data
      if (!formData.name.trim()) {
        throw new Error('Field name is required')
      }

      if (needsPicklistOptions && formData.picklistOptions.length === 0) {
        throw new Error(`${getFieldTypeLabel(customField.dataType)} requires at least one option`)
      }

      // Prepare update data
      const updateData = {
        name: formData.name.trim(),
        placeholder: formData.placeholder.trim(),
        position: formData.position,
        dataType: customField.dataType,
        parentId: customField.parentId // Preserve existing parentId
      }

      // Add options for choice fields
      if (needsPicklistOptions) {
        updateData.picklistOptions = formData.picklistOptions.filter(opt => opt.trim())
      }

      console.log('Updating custom field with data:', updateData)
      await onSubmit(updateData)
    } catch (error) {
      console.error('Form submission error:', error)
      setError(error.message)
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('You must type "DELETE" to confirm deletion')
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await onDelete(customField.id)
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Delete error:', error)
      setError(error.message)
      setDeleting(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
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

  const needsPicklistOptions = isChoiceField(customField?.dataType)

  if (!customField) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Edit Custom Field</h3>
              <p className="text-sm text-gray-600 mt-1">
                Update the custom field in GoHighLevel
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
              disabled={loading || deleting}
              title="Delete field"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-md p-3 flex-shrink-0">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Field Info */}
        <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-md p-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getFieldTypeIcon(customField.dataType)}</span>
            <div>
              <p className="text-sm font-medium text-blue-900">
                {getFieldTypeLabel(customField.dataType)} Field
              </p>
              <p className="text-xs text-blue-700">
                Field Key: {customField.fieldKey}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                required
                disabled={loading || deleting}
              />
            </div>

            {/* Placeholder Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placeholder Text
              </label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => handleChange('placeholder', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading || deleting}
              />
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position
              </label>
              <input
                type="number"
                value={formData.position}
                onChange={(e) => handleChange('position', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="50"
                disabled={loading || deleting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Lower numbers appear first. Use increments of 50.
              </p>
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
                        disabled={loading || deleting}
                      />
                      <button
                        type="button"
                        onClick={() => removePicklistOption(index)}
                        className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50"
                        disabled={loading || deleting || formData.picklistOptions.length <= 1}
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
                    disabled={loading || deleting}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Option
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            disabled={loading || deleting}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || deleting || !formData.name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </div>
            ) : (
              'Update Field'
            )}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-red-900">⚠️ Delete Custom Field</h3>
            </div>
            
            <div className="px-6 py-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <h4 className="text-sm font-medium text-red-800 mb-2">This action is irreversible!</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• The custom field will be permanently deleted from GoHighLevel</li>
                  <li>• All existing contact data in this field will be lost</li>
                  <li>• Any extraction configurations will be removed</li>
                  <li>• This cannot be undone</li>
                </ul>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  Field to delete: <strong>{customField.name}</strong>
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  Type: <strong>{getFieldTypeLabel(customField.dataType)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type "DELETE" to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Type DELETE here"
                  disabled={deleting}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                  setError(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-md transition-colors"
              >
                {deleting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </div>
                ) : (
                  'Delete Field'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomFieldEditForm