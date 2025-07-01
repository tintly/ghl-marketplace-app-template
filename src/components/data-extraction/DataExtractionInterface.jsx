import React, { useState, useEffect } from 'react'
import CustomFieldsList from './CustomFieldsList'
import ExtractionFieldForm from './ExtractionFieldForm'
import ExtractionFieldsList from './ExtractionFieldsList'
import CreateCustomFieldForm from './CreateCustomFieldForm'
import CustomFieldEditForm from './CustomFieldEditForm'
import CustomFieldsLoader from './CustomFieldsLoader'
import { GHLApiService } from '../../services/GHLApiService'
import { FieldRecreationService } from './FieldRecreationService'

function DataExtractionInterface({ config, user, authService }) {
  const [customFields, setCustomFields] = useState([])
  const [extractionFields, setExtractionFields] = useState([])
  const [selectedCustomField, setSelectedCustomField] = useState(null)
  const [editingCustomField, setEditingCustomField] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recreating, setRecreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)

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
    const loader = new CustomFieldsLoader(authService)
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

  const handleCreateNewField = () => {
    setShowCreateForm(true)
  }

  const handleEditField = (customField) => {
    setEditingCustomField(customField)
    setShowEditForm(true)
  }

  const handleUpdateFieldSubmit = async (updateData) => {
    try {
      setUpdating(true)
      setError(null)

      console.log('=== UPDATING CUSTOM FIELD ===')
      console.log('Field ID:', editingCustomField.id)
      console.log('Update data:', updateData)

      // Update the field in GoHighLevel
      const ghlService = new GHLApiService(config.access_token)
      const updatedField = await ghlService.updateCustomField(
        config.ghl_account_id, 
        editingCustomField.id, 
        updateData
      )
      
      console.log('✅ Field updated successfully in GHL:', updatedField)

      // Close the edit form
      setShowEditForm(false)
      setEditingCustomField(null)

      // Refresh the custom fields list to show the updated field
      console.log('🔄 Refreshing custom fields list...')
      await refreshInterface()

      console.log('🎉 Field update completed successfully!')

    } catch (error) {
      console.error('❌ Field update failed:', error)
      setError(`Failed to update custom field: ${error.message}`)
      setUpdating(false)
    }
  }

  const handleDeleteField = async (fieldId) => {
    try {
      setUpdating(true)
      setError(null)

      console.log('=== DELETING CUSTOM FIELD ===')
      console.log('Field ID:', fieldId)

      // Delete the field from GoHighLevel
      const ghlService = new GHLApiService(config.access_token)
      await ghlService.deleteCustomField(config.ghl_account_id, fieldId)
      
      console.log('✅ Field deleted successfully from GHL')

      // Close the edit form
      setShowEditForm(false)
      setEditingCustomField(null)

      // Refresh the interface to remove the deleted field
      console.log('🔄 Refreshing interface after deletion...')
      await refreshInterface()

      console.log('🎉 Field deletion completed successfully!')

    } catch (error) {
      console.error('❌ Field deletion failed:', error)
      setError(`Failed to delete custom field: ${error.message}`)
      setUpdating(false)
    }
  }

  const handleCreateFieldSubmit = async (fieldData) => {
    try {
      setCreating(true)
      setError(null)

      console.log('=== CREATING NEW CUSTOM FIELD ===')
      console.log('Field data:', fieldData)

      // Create the field in GoHighLevel
      const ghlService = new GHLApiService(config.access_token)
      const createdField = await ghlService.createCustomField(config.ghl_account_id, fieldData)
      
      console.log('✅ Field created successfully in GHL:', createdField)

      // Close the create form
      setShowCreateForm(false)

      // Refresh the custom fields list to show the new field
      console.log('🔄 Refreshing custom fields list...')
      await refreshInterface()

      // Extract the new field from the response
      const newField = createdField.customField || createdField
      if (newField && newField.id) {
        console.log('🎯 Auto-configuring new field for extraction...')
        
        // Wait a moment for the field to be available
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Refresh again to ensure we have the latest data
        await loadCustomFields()
        
        // Find the newly created field in our list
        const freshFields = await new CustomFieldsLoader(authService).loadFields(config)
        const createdFieldInList = freshFields.find(f => f.id === newField.id)
        
        if (createdFieldInList) {
          // Automatically open the extraction configuration form
          handleCreateExtraction(createdFieldInList)
        } else {
          console.log('⚠️ Could not find newly created field in list, manual configuration needed')
        }
      }

      console.log('🎉 Field creation and setup completed successfully!')

    } catch (error) {
      console.error('❌ Field creation failed:', error)
      setError(`Failed to create custom field: ${error.message}`)
      setCreating(false)
    }
  }

  const handleCreateFieldCancel = () => {
    setShowCreateForm(false)
    setCreating(false)
  }

  const handleEditFieldCancel = () => {
    setShowEditForm(false)
    setEditingCustomField(null)
    setUpdating(false)
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

      // Debug the original field metadata to understand folder structure
      recreationService.debugFieldMetadata(extractionField.original_ghl_field_data)

      // Recreate the field in GoHighLevel with proper folder placement
      console.log('🔄 Recreating field in GoHighLevel with folder preservation...')
      const recreatedField = await recreationService.recreateField(config.ghl_account_id, extractionField)
      
      console.log('✅ Field recreation completed:', recreatedField)

      // Extract the new field ID from the response
      const newFieldId = recreatedField.customField?.id || recreatedField.id
      if (!newFieldId) {
        throw new Error('Failed to get new field ID from recreation response')
      }

      console.log('🔄 Updating extraction field with new ID:', newFieldId)

      // Update the extraction field with the new GHL field ID and updated field data
      const supabase = authService?.getSupabaseClient() || (await import('../../services/supabase')).supabase

      const updatedFieldData = recreatedField.customField || recreatedField
      const { error: updateError } = await supabase
        .from('data_extraction_fields')
        .update({
          target_ghl_key: newFieldId, // This is the key fix - update to new field ID
          original_ghl_field_data: updatedFieldData, // Store the new field data
          updated_at: new Date().toISOString()
        })
        .eq('id', extractionField.id)

      if (updateError) {
        console.error('Error updating extraction field:', updateError)
        throw new Error('Field was recreated but failed to update the configuration. Please refresh the page.')
      }

      console.log('✅ Extraction field updated with new ID successfully')

      // Force refresh the interface to show updated state
      console.log('🔄 Refreshing interface to show updated state...')
      await refreshInterface()

      console.log('🎉 Field recreation process completed successfully!')

    } catch (error) {
      console.error('❌ Field recreation failed:', error)
      setError(`Failed to recreate field: ${error.message}`)
    } finally {
      setRecreating(false)
    }
  }

  const refreshInterface = async () => {
    try {
      setRefreshing(true)
      console.log('🔄 Refreshing interface and updating stored field data...')
      
      // Wait a moment for GHL to process any changes
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Reload both custom fields and extraction fields
      // The loadCustomFields will automatically update stored field data
      await Promise.all([
        loadCustomFields(),
        loadExtractionFields()
      ])
      
      console.log('✅ Interface refresh completed with updated field data')
    } catch (error) {
      console.error('Error refreshing interface:', error)
      setError('Failed to refresh interface. Please reload the page.')
    } finally {
      setRefreshing(false)
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
    setCreating(false)
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

  const handleRefreshFields = async () => {
    try {
      setRefreshing(true)
      console.log('🔄 Manual refresh triggered - updating stored field data...')
      
      // This will automatically update stored field data for existing extraction fields
      await loadCustomFields()
      
      // Also reload extraction fields to show any updates
      await loadExtractionFields()
      
      console.log('✅ Manual refresh completed with updated field data')
    } catch (error) {
      console.error('Error refreshing fields:', error)
      setError('Failed to refresh custom fields')
    } finally {
      setRefreshing(false)
    }
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
        <div className="mt-3 space-x-2">
          <button
            onClick={loadData}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => setError(null)}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            Dismiss
          </button>
        </div>
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

      {/* Creation Loading Indicator */}
      {creating && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
            <span className="text-green-800">Creating new custom field in GoHighLevel...</span>
          </div>
          <p className="text-green-700 text-xs mt-1">
            This may take a few moments. The field will be created and automatically configured for extraction.
          </p>
        </div>
      )}

      {/* Update Loading Indicator */}
      {updating && (
        <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-blue-800">Updating custom field in GoHighLevel...</span>
          </div>
          <p className="text-blue-700 text-xs mt-1">
            This may take a few moments. The field will be updated with new settings.
          </p>
        </div>
      )}

      {/* Recreation Loading Indicator */}
      {recreating && (
        <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-blue-800">Recreating field in GoHighLevel...</span>
          </div>
          <p className="text-blue-700 text-xs mt-1">
            This may take a few moments. The field will be recreated in the same folder and get a new ID.
          </p>
        </div>
      )}

      {/* Refresh Loading Indicator */}
      {refreshing && (
        <div className="mx-6 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
            <span className="text-yellow-800">Refreshing and updating field data...</span>
          </div>
          <p className="text-yellow-700 text-xs mt-1">
            Updating field status, configurations, and stored metadata.
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
              onCreateNewField={handleCreateNewField}
              onEditField={handleEditField}
              refreshing={refreshing}
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
              recreating={recreating}
            />
          </div>
        </div>
      </div>

      {/* Create Custom Field Form Modal */}
      {showCreateForm && (
        <CreateCustomFieldForm
          customFields={customFields}
          onSubmit={handleCreateFieldSubmit}
          onCancel={handleCreateFieldCancel}
        />
      )}

      {/* Edit Custom Field Form Modal */}
      {showEditForm && editingCustomField && (
        <CustomFieldEditForm
          customField={editingCustomField}
          onSubmit={handleUpdateFieldSubmit}
          onCancel={handleEditFieldCancel}
          onDelete={handleDeleteField}
        />
      )}

      {/* Extraction Configuration Form Modal */}
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