import React, { useState, useEffect } from 'react'
import StandardFieldsList from './StandardFieldsList'
import StandardExtractionFieldsList from './StandardExtractionFieldsList'
import ExtractionFieldForm from './data-extraction/ExtractionFieldForm'
import { isStandardField } from '../utils/standardContactFields'

function StandardFieldsExtractionModule({ config, user, authService }) {
  const [extractionFields, setExtractionFields] = useState([])
  const [selectedStandardField, setSelectedStandardField] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadExtractionFields()
  }, [config])

  const loadExtractionFields = async () => {
    try {
      setLoading(true)
      setError(null)

      // Use the authenticated Supabase client
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase

      const { data, error } = await supabase
        .from('data_extraction_fields')
        .select('*')
        .eq('config_id', config.id)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error loading extraction fields:', error)
        throw new Error('Failed to load extraction fields')
      }

      // Filter to only include standard fields
      const standardFields = (data || []).filter(field => 
        isStandardField(field.target_ghl_key)
      )

      setExtractionFields(standardFields)
    } catch (error) {
      console.error('Error loading standard extraction fields:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateExtraction = (standardField) => {
    setSelectedStandardField(standardField)
    setEditingField(null)
    setShowForm(true)
  }

  const handleEditExtraction = (extractionField) => {
    setEditingField(extractionField)
    setSelectedStandardField(null)
    setShowForm(true)
  }

  const handleFormSubmit = async (formData) => {
    const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase

    if (editingField) {
      // Update existing field
      const { error } = await supabase
        .from('data_extraction_fields')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingField.id)

      if (error) throw error
    } else {
      // Create new field
      const { error } = await supabase
        .from('data_extraction_fields')
        .insert({
          config_id: config.id,
          ...formData
        })

      if (error) throw error
    }

    // Reload extraction fields and close form
    await loadExtractionFields()
    handleFormClose()
  }

  const handleFormClose = () => {
    setShowForm(false)
    setSelectedStandardField(null)
    setEditingField(null)
  }

  const handleDeleteExtraction = async (fieldId) => {
    try {
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase

      const { error } = await supabase
        .from('data_extraction_fields')
        .delete()
        .eq('id', fieldId)

      if (error) throw error

      // Reload extraction fields
      await loadExtractionFields()
    } catch (error) {
      console.error('Error deleting extraction field:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading standard fields...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error Loading Standard Fields</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={loadExtractionFields}
          className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Standard Contact Fields</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure AI extraction for built-in GoHighLevel contact fields like name, email, phone, and address.
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Standard Fields */}
          <div>
            <StandardFieldsList
              extractionFields={extractionFields}
              onCreateExtraction={handleCreateExtraction}
            />
          </div>

          {/* Configured Standard Fields */}
          <div>
            <StandardExtractionFieldsList
              extractionFields={extractionFields}
              onEdit={handleEditExtraction}
              onDelete={handleDeleteExtraction}
            />
          </div>
        </div>
      </div>

      {/* Extraction Configuration Form Modal */}
      {showForm && (
        <ExtractionFieldForm
          customField={selectedStandardField}
          editingField={editingField}
          onSubmit={handleFormSubmit}
          onCancel={handleFormClose}
        />
      )}
    </div>
  )
}

export default StandardFieldsExtractionModule