import React, { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import CustomFieldsList from './data-extraction/CustomFieldsList'
import ExtractionFieldForm from './data-extraction/ExtractionFieldForm'
import ExtractionFieldsList from './data-extraction/ExtractionFieldsList'
import { GHLApiService } from '../services/GHLApiService'

function DataExtractionModule({ user, authService }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [customFields, setCustomFields] = useState([])
  const [extractionFields, setExtractionFields] = useState([])
  const [selectedCustomField, setSelectedCustomField] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [ghlConfig, setGhlConfig] = useState(null)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get GHL configuration
      const config = await getGHLConfiguration()
      setGhlConfig(config)

      if (config) {
        // Load custom fields and extraction fields in parallel
        await Promise.all([
          loadCustomFields(config),
          loadExtractionFields(config.id)
        ])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const getGHLConfiguration = async () => {
    // First try to find by user_id
    let { data, error } = await supabase
      .from('ghl_configurations')
      .select('*')
      .eq('user_id', user.userId)
      .eq('is_active', true)
      .single()

    // If not found by user_id, try to find by location_id (for dev mode or unlinked configs)
    if (error && error.code === 'PGRST116' && user.locationId) {
      console.log('No config found by user_id, trying by location_id...')
      
      const { data: locationData, error: locationError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('ghl_account_id', user.locationId)
        .eq('is_active', true)
        .single()

      if (locationError && locationError.code !== 'PGRST116') {
        throw new Error('Failed to load GHL configuration')
      }

      // If found by location but no user_id, link it to current user
      if (locationData && !locationData.user_id) {
        console.log('Found unlinked config, linking to current user...')
        
        const { data: updatedData, error: updateError } = await supabase
          .from('ghl_configurations')
          .update({ 
            user_id: user.userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', locationData.id)
          .select()
          .single()

        if (updateError) {
          console.error('Failed to link configuration:', updateError)
          // Still return the original data even if linking fails
          return locationData
        }

        return updatedData
      }

      return locationData
    }

    if (error && error.code !== 'PGRST116') {
      throw new Error('Failed to load GHL configuration')
    }

    return data
  }

  const loadCustomFields = async (config) => {
    try {
      // In dev mode, use mock data if API call fails
      if (user.devMode) {
        try {
          const ghlService = new GHLApiService(config.access_token)
          const fields = await ghlService.getCustomFields(config.ghl_account_id)
          setCustomFields(fields)
        } catch (error) {
          console.log('API call failed in dev mode, using mock data:', error.message)
          setCustomFields(getMockCustomFields())
        }
      } else {
        const ghlService = new GHLApiService(config.access_token)
        const fields = await ghlService.getCustomFields(config.ghl_account_id)
        setCustomFields(fields)
      }
    } catch (error) {
      console.error('Error loading custom fields:', error)
      if (user.devMode) {
        console.log('Using mock data due to error in dev mode')
        setCustomFields(getMockCustomFields())
      } else {
        throw new Error('Failed to load custom fields from GoHighLevel')
      }
    }
  }

  const getMockCustomFields = () => {
    return [
      {
        id: "mock-text-field",
        name: "Customer Name",
        model: "contact",
        fieldKey: "contact.customer_name",
        placeholder: "Enter customer name",
        dataType: "TEXT",
        position: 50,
        standard: false
      },
      {
        id: "mock-phone-field",
        name: "Phone Number",
        model: "contact",
        fieldKey: "contact.phone_number",
        placeholder: "",
        dataType: "PHONE",
        position: 100,
        standard: false
      },
      {
        id: "mock-service-field",
        name: "Service Type",
        model: "contact",
        fieldKey: "contact.service_type",
        placeholder: "",
        dataType: "SINGLE_OPTIONS",
        position: 150,
        standard: false,
        picklistOptions: ["Consultation", "Installation", "Maintenance", "Repair"]
      },
      {
        id: "mock-date-field",
        name: "Appointment Date",
        model: "contact",
        fieldKey: "contact.appointment_date",
        placeholder: "",
        dataType: "DATE",
        position: 200,
        standard: false
      }
    ]
  }

  const loadExtractionFields = async (configId) => {
    const { data, error } = await supabase
      .from('data_extraction_fields')
      .select('*')
      .eq('config_id', configId)
      .order('sort_order', { ascending: true })

    if (error) {
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

  const handleFormSubmit = async (formData) => {
    try {
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
            config_id: ghlConfig.id,
            ...formData
          })

        if (error) throw error
      }

      // Reload extraction fields
      await loadExtractionFields(ghlConfig.id)
      setShowForm(false)
      setSelectedCustomField(null)
      setEditingField(null)
    } catch (error) {
      console.error('Error saving extraction field:', error)
      throw error
    }
  }

  const handleDeleteExtraction = async (fieldId) => {
    try {
      const { error } = await supabase
        .from('data_extraction_fields')
        .delete()
        .eq('id', fieldId)

      if (error) throw error

      // Reload extraction fields
      await loadExtractionFields(ghlConfig.id)
    } catch (error) {
      console.error('Error deleting extraction field:', error)
      throw error
    }
  }

  const handleRefreshFields = () => {
    if (ghlConfig) {
      loadCustomFields(ghlConfig)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading data extraction settings...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error Loading Data</h3>
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

  if (!ghlConfig) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-yellow-800 font-medium">No Configuration Found</h3>
        <p className="text-yellow-600 text-sm mt-1">
          No GoHighLevel configuration found for this location. 
          {user.devMode && ' In dev mode, a configuration should be automatically created.'}
        </p>
        <div className="mt-3 text-xs text-yellow-700">
          <p>User ID: {user.userId}</p>
          <p>Location ID: {user.locationId}</p>
          <p>Dev Mode: {user.devMode ? 'Yes' : 'No'}</p>
        </div>
        <button
          onClick={loadData}
          className="mt-3 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
        >
          Retry Loading
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Data Extraction Configuration</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure which custom fields should be automatically populated by AI during conversations.
          </p>
          {user.devMode && (
            <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
              Dev Mode: Using configuration ID {ghlConfig.id}
            </div>
          )}
        </div>

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
              />
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <ExtractionFieldForm
          customField={selectedCustomField}
          editingField={editingField}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false)
            setSelectedCustomField(null)
            setEditingField(null)
          }}
        />
      )}
    </div>
  )
}

export default DataExtractionModule