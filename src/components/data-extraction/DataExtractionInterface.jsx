import React, { useState, useEffect } from 'react'
import CustomFieldsList from './CustomFieldsList'
import ExtractionFieldForm from './ExtractionFieldForm'
import ExtractionFieldsList from './ExtractionFieldsList'
import CreateCustomFieldForm from './CreateCustomFieldForm'
import CustomFieldEditForm from './CustomFieldEditForm'
import CustomFieldsLoader from './CustomFieldsLoader'
import { GHLApiService } from '../../services/GHLApiService'
import { FieldRecreationService } from './FieldRecreationService'
import { isStandardField } from '../../utils/standardContactFields'

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

  // Make custom fields available globally for the extraction form
  useEffect(() => {
    window.currentCustomFields = customFields
    return () => {
      delete window.currentCustomFields
    }
  }, [customFields])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

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

    // CRITICAL FIX: Filter out standard fields from custom fields extraction list
    // Only show extraction fields that correspond to actual custom fields (not standard fields)
    const customFieldExtractions = (data || []).filter(field => {
      // Exclude standard fields - they should only appear in the Standard Fields tab
      const isStandard = isStandardField(field.target_ghl_key)
      if (isStandard) {
        console.log(`Filtering out standard field from custom fields list: ${field.field_name} (${field.target_ghl_key})`)
      }
      return !isStandard
    })

    console.log(`Loaded ${data?.length || 0} total extraction fields, ${customFieldExtractions.length} custom field extractions`)
    setExtractionFields(customFieldExtractions)
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

      const ghlService = new GHLApiService(config.access_token)
      const updatedField = await ghlService.updateCustomField(
        config.ghl_account_id, 
        editingCustomField.id, 
        updateData
      )
      
      console.log('✅ Field updated successfully in GHL:', updatedField)

      setShowEditForm(false)
      setEditingCustomField(null)

      console.log('🔄 Refreshing custom fields list...')
      await refreshInterface()

      console.log('🎉 Field update completed successfully!')

    } catch (error) {
      console.error('❌ Field update failed:', error)
      setError(`Failed to update custom field: ${error.message}`)
    } finally {
      // CRITICAL FIX: Always reset updating state
      setUpdating(false)
    }
  }

  const handleDeleteField = async (fieldId) => {
    try {
      setUpdating(true)
      setError(null)

      console.log('=== DELETING CUSTOM FIELD ===')
      console.log('Field ID:', fieldId)

      // Step 1: Delete the field from GoHighLevel
      const ghlService = new GHLApiService(config.access_token)
      await ghlService.deleteCustomField(config.ghl_account_id, fieldId)
      
      console.log('✅ Field deleted successfully from GHL')

      // Step 2: Clean up any extraction configurations that reference this field
      console.log('🧹 Cleaning up extraction configurations...')
      await cleanupExtractionConfigurations(fieldId)

      // Step 3: Close the edit form
      setShowEditForm(false)
      setEditingCustomField(null)

      // Step 4: Refresh the interface
      console.log('🔄 Refreshing interface after deletion...')
      await refreshInterface()

      console.log('🎉 Field deletion and cleanup completed successfully!')

    } catch (error) {
      console.error('❌ Field deletion failed:', error)
      setError(`Failed to delete custom field: ${error.message}`)
    } finally {
      // CRITICAL FIX: Always reset updating state
      setUpdating(false)
    }
  }

  // NEW: Function to clean up extraction configurations when a field is deleted
  const cleanupExtractionConfigurations = async (deletedFieldId) => {
    try {
      const supabase = authService?.getSupabaseClient() || (await import('../../services/supabase')).supabase

      console.log('Looking for extraction configurations to clean up for field:', deletedFieldId)

      // Find extraction fields that reference the deleted custom field
      const { data: extractionsToDelete, error: findError } = await supabase
        .from('data_extraction_fields')
        .select('id, field_name, target_ghl_key')
        .eq('config_id', config.id)
        .eq('target_ghl_key', deletedFieldId)

      if (findError) {
        console.error('Error finding extraction configurations to clean up:', findError)
        return
      }

      if (!extractionsToDelete || extractionsToDelete.length === 0) {
        console.log('No extraction configurations found for deleted field')
        return
      }

      console.log(`Found ${extractionsToDelete.length} extraction configurations to clean up:`, 
        extractionsToDelete.map(e => e.field_name))

      // Delete the extraction configurations
      const { error: deleteError } = await supabase
        .from('data_extraction_fields')
        .delete()
        .eq('config_id', config.id)
        .eq('target_ghl_key', deletedFieldId)

      if (deleteError) {
        console.error('Error deleting extraction configurations:', deleteError)
        throw new Error(`Failed to clean up extraction configurations: ${deleteError.message}`)
      }

      console.log('✅ Successfully cleaned up extraction configurations')

    } catch (error) {
      console.error('Error in cleanup process:', error)
      // Don't throw here - we want the field deletion to succeed even if cleanup fails
      console.warn('⚠️ Field was deleted but extraction cleanup may have failed')
    }
  }

  const handleCreateFieldSubmit = async (fieldData) => {
    try {
      setCreating(true)
      setError(null)

      console.log('=== CREATING NEW CUSTOM FIELD ===')
      console.log('Field data:', fieldData)

      const ghlService = new GHLApiService(config.access_token)
      const createdField = await ghlService.createCustomField(config.ghl_account_id, fieldData)
      
      console.log('✅ Field created successfully in GHL:', createdField)

      setShowCreateForm(false)

      console.log('🔄 Refreshing custom fields list...')
      await refreshInterface()

      const newField = createdField.customField || createdField
      if (newField && newField.id) {
        console.log('🎯 Auto-configuring new field for extraction...')
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        await loadCustomFields()
        
        const freshFields = await new CustomFieldsLoader(authService).loadFields(config)
        const createdFieldInList = freshFields.find(f => f.id === newField.id)
        
        if (createdFieldInList) {
          handleCreateExtraction(createdFieldInList)
        } else {
          console.log('⚠️ Could not find newly created field in list, manual configuration needed')
        }
      }

      console.log('🎉 Field creation and setup completed successfully!')

    } catch (error) {
      console.error('❌ Field creation failed:', error)
      setError(`Failed to create custom field: ${error.message}`)
    } finally {
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

      if (!extractionField.original_ghl_field_data || Object.keys(extractionField.original_ghl_field_data).length === 0) {
        throw new Error('No original field data available for recreation. This field cannot be recreated.')
      }

      const ghlService = new GHLApiService(config.access_token)
      const recreationService = new FieldRecreationService(ghlService)

      recreationService.debugFieldMetadata(extractionField.original_ghl_field_data)

      console.log('🔄 Recreating field in GoHighLevel with folder preservation...')
      const recreatedField = await recreationService.recreateField(config.ghl_account_id, extractionField)
      
      console.log('✅ Field recreation completed:', recreatedField)

      const newFieldId = recreatedField.customField?.id || recreatedField.id
      if (!newFieldId) {
        throw new Error('Failed to get new field ID from recreation response')
      }

      console.log('🔄 Updating extraction field with new ID:', newFieldId)

      const supabase = authService?.getSupabaseClient() || (await import('../../services/supabase')).supabase

      const updatedFieldData = recreatedField.customField || recreatedField
      const { error: updateError } = await supabase
        .from('data_extraction_fields')
        .update({
          target_ghl_key: newFieldId,
          original_ghl_field_data: updatedFieldData,
          updated_at: new Date().toISOString()
        })
        .eq('id', extractionField.id)

      if (updateError) {
        console.error('Error updating extraction field:', updateError)
        throw new Error('Field was recreated but failed to update the configuration. Please refresh the page.')
      }

      console.log('✅ Extraction field updated with new ID successfully')

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
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
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

    try {
      // Check if this is a custom field (not standard field) and if options were modified
      const isCustomField = selectedCustomField && !selectedCustomField.key
      const isEditingCustomField = editingField && !isStandardField(editingField.target_ghl_key)
      
      if ((isCustomField || isEditingCustomField) && needsGHLUpdate(formData)) {
        console.log('=== SYNCING OPTIONS TO GHL CUSTOM FIELD ===')
        
        // Get the field ID to update
        const fieldId = editingField ? editingField.target_ghl_key : selectedCustomField.id
        
        // Prepare options for GHL API (convert from enhanced format back to simple strings)
        const ghlOptions = formData.picklist_options.map(opt => 
          typeof opt === 'string' ? opt : opt.value
        ).filter(Boolean)
        
        console.log('Updating GHL field with options:', ghlOptions)
        
        // Update the custom field in GHL
        const ghlService = new GHLApiService(config.access_token)
        await ghlService.updateCustomField(config.ghl_account_id, fieldId, {
          name: selectedCustomField?.name || editingField?.field_name,
          picklistOptions: ghlOptions,
          dataType: selectedCustomField?.dataType || mapFieldTypeToGHL(formData.field_type)
        })
        
        console.log('✅ Successfully updated GHL custom field with new options')
      }

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
      
      // If we updated a custom field, refresh the custom fields list too
      if (isCustomField || isEditingCustomField) {
        await loadCustomFields()
      }
      
      handleFormClose()
    } catch (error) {
      console.error('Error in form submission:', error)
      throw error
    }
  }

  const needsGHLUpdate = (formData) => {
    // Check if this field type supports options and has options
    return ['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS'].includes(formData.field_type) && 
           formData.picklist_options && 
           formData.picklist_options.length > 0
  }

  const mapFieldTypeToGHL = (extractionFieldType) => {
    const mapping = {
      'SINGLE_OPTIONS': 'SINGLE_OPTIONS',
      'MULTIPLE_OPTIONS': 'MULTIPLE_OPTIONS',
      'TEXT': 'TEXT',
      'NUMERICAL': 'NUMERICAL',
      'DATE': 'DATE'
    }
    return mapping[extractionFieldType] || 'TEXT'
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
      
      await loadCustomFields()
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

      {/* Loading Indicators */}
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

      {updating && (
        <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-blue-800">
              {editingCustomField ? 'Updating custom field in GoHighLevel...' : 'Processing field operation...'}
            </span>
          </div>
          <p className="text-blue-700 text-xs mt-1">
            This may take a few moments. {editingCustomField ? 'The field will be updated with new settings.' : 'Please wait while the operation completes.'}
          </p>
        </div>
      )}

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

      {/* Modals */}
      {showCreateForm && (
        <CreateCustomFieldForm
          customFields={customFields}
          onSubmit={handleCreateFieldSubmit}
          onCancel={handleCreateFieldCancel}
        />
      )}

      {showEditForm && editingCustomField && (
        <CustomFieldEditForm
          customField={editingCustomField}
          onSubmit={handleUpdateFieldSubmit}
          onCancel={handleEditFieldCancel}
          onDelete={handleDeleteField}
        />
      )}

      {showForm && (
        <ExtractionFieldForm
          customField={selectedCustomField}
          editingField={editingField}
          onSubmit={handleFormSubmit}
          onCancel={handleFormClose}
          customFields={customFields}
        />
      )}
    </div>
  )
}

export default DataExtractionInterface