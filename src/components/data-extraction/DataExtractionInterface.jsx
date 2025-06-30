import React, { useState, useEffect } from 'react'
import CustomFieldsList from './CustomFieldsList'
import ExtractionFieldForm from './ExtractionFieldForm'
import ExtractionFieldsList from './ExtractionFieldsList'
import CustomFieldsLoader from './CustomFieldsLoader'
import { GHLApiService } from '../../services/GHLApiService'
import { FieldRecreationService } from './FieldRecreationService'

function DataExtractionInterface({ config, user, authService }) {
  const [customFields, setCustomFields] = useState([])
  const [extractionFields, setExtractionFields] = useState([])
  const [selectedCustomField, setSelectedCustomField] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recreating, setRecreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [config])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load custom fields and extraction fields in parallel
      await Promise.all([
        loadCustomFields(),
        loadExtractionFields()
      ])
    } catch (error) {
      console.error('Error loading interface data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomFields = async () => {
    const loader = new CustomFieldsLoader()
    const fields = await loader.loadFields(config)
    setCustomFields(fields)
  }

  const loadExtractionFields = async () => {
    // Use the authenticated Supabase client
    const supabase = authService?.getSupabaseClient() || (await import('../../services/supabase')).supabase

    const { data, error } = await supabase
      .from('data_extraction_fields')
      .select('*')
      .eq('config_id', config.id)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error loading extraction fields:', error)
      throw new Error('Failed to load extraction fields')
    }

    setExtractionFields(data || [])
  }

  const handleCreateExtraction = (customField) => {
    setSelectedCustomField(customField)
    setEditingField(null)
    setShowForm(true)
  }

  const handleEditExtraction = (extractionField) => {
    setEditingField(extractionField)
    setSelectedCustomField(null)
    setShowForm(true)
  }

  const handleRecreateExtraction = async (extractionField) => {
    try {
      setRecreating(true)
      setError(null)

      console.log('=== STARTING FIELD RECREATION ===')
      console.log('Extraction field:', extractionField)

      // Validate that we have the necessary data
      if (!extractionField.original_ghl_field_data || Object.keys(extractionField.original_ghl_field_data).length === 0) {
        throw new Error('No original field data available for recreation. This field cannot be recreated.')
      }

      // Initialize GHL API service and recreation service
      const ghlService = new GHLApiService(config.access_token)
      const recreationService = new FieldRecreationService(ghlService)

      // Recreate the field
      const recreatedField = await recreationService.recreateField(config.ghl_account_id, extractionField)
      
      console.log('Field recreation completed:', recreatedField)

      // Extract the new field ID from the response
      const newFieldId = recreatedField.customField?.id || recreatedField.id
      if (!newFieldId) {
        throw new Error('Failed to get new field ID from recreation response')
      }

      // Update the extraction field with the new GHL field ID
      const supabase = authService?.getSupabaseClient() || (await import('../../services/supabase')).supabase

      const { error: updateError } = await supabase
        .from('data_extraction_fields')
        .update({
          target_ghl_key: newFieldId,
          original_ghl_field_data: recreatedField.customField || recreatedField,
          updated_at: new Date().toISOString()
        })
        .eq('id', extractionField.id)

      if (updateError) {
        console.error('Error updating extraction field:', updateError)
        throw new Error('Field was recreated but failed to update the configuration. Please refresh the page.')
      }

      // Reload both custom fields and extraction fields to reflect changes
      await Promise.all([
        loadCustomFields(),
        loadExtractionFields()
      ])

      console.log('✅ Field recreation completed successfully')

    } catch (error) {
      console.error('❌ Field recreation failed:', error)
      setError(`Failed to recreate field: ${error.message}`)
    } finally {
      setRecreating(false)
    }
  }

  const handleFormSubmit = async (formData) => {
    const supabase = authService?.getSupabaseClient() || (await import('../../services/supabase')).supabase

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
    setSelectedCustomField(null)
    setEditingField(null)
  }

  const handleDeleteExtraction = async (fieldId) => {
    try {
      const supabase = authService?.getSupabaseClient() || (await import('../../services/supabase')).supabase

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

  const handleRefreshFields = () => {
    loadCustomFields()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading interface...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Interface Error</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={loadData}
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
        <h2 className="text-xl font-semibold text-gray-900">Data Extraction Configuration</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure which custom fields should be automatically populated by AI during conversations.
        </p>
      </div>

      {/* Recreation Loading Indicator */}
      {recreating && (
        <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-blue-800">Recreating field in GoHighLevel...</span>
          </div>
          <p className="text-blue-700 text-xs mt-1">
            This may take a few moments. Please do not refresh the page.
          </p>
        </div>
      )}

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Custom Fields */}
          <div>
            <CustomFieldsList
              customFields={customFields}
              extractionFields={extractionFields}
              onCreateExtraction={handleCreateExtraction}
              onRefresh={handleRefreshFields}
            />
          </div>

          {/* Configured Extraction Fields */}
          <div>
            <ExtractionFieldsList
              extractionFields={extractionFields}
              customFields={customFields}
              onEdit={handleEditExtraction}
              onDelete={handleDeleteExtraction}
              onRecreate={handleRecreateExtraction}
            />
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <ExtractionFieldForm
          customField={selectedCustomField}
          editingField={editingField}
          onSubmit={handleFormSubmit}
          onCancel={handleFormClose}
        />
      )}
    </div>
  )
}

export default DataExtractionInterface