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
  const [configError, setConfigError] = useState(null)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      setConfigError(null)

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
    console.log('Looking for GHL configuration...', {
      userId: user.userId,
      locationId: user.locationId,
      devMode: user.devMode
    })

    try {
      // Strategy 1: Try to find by ghl_account_id (location ID) first
      if (user.locationId) {
        console.log('Trying to find config by ghl_account_id:', user.locationId)
        
        const { data: locationData, error: locationError } = await supabase
          .from('ghl_configurations')
          .select('*')
          .eq('ghl_account_id', user.locationId)
          .eq('is_active', true)
          .maybeSingle()

        if (locationError) {
          console.error('Error querying by ghl_account_id:', locationError)
          setConfigError(`Database query failed: ${locationError.message}`)
        } else if (locationData) {
          console.log('Found config by ghl_account_id:', locationData.id)
          
          // If found but no user_id, link it to current user
          if (!locationData.user_id) {
            console.log('Config found but not linked to user, linking now...')
            
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
              setConfigError(`Failed to link configuration: ${updateError.message}`)
              return locationData // Return original data even if linking fails
            }

            console.log('Successfully linked config to user')
            return updatedData
          }

          return locationData
        }
      }

      // Strategy 2: Try to find by user_id
      console.log('Trying to find config by user_id:', user.userId)
      
      const { data: userData, error: userError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', user.userId)
        .eq('is_active', true)
        .maybeSingle()

      if (userError) {
        console.error('Error querying by user_id:', userError)
        setConfigError(`Database query failed: ${userError.message}`)
      } else if (userData) {
        console.log('Found config by user_id:', userData.id)
        return userData
      }

      // Strategy 3: In dev mode, try to create configuration if none exists
      if (user.devMode) {
        console.log('Dev mode: No configuration found, attempting to create one...')
        setConfigError('No configuration found. In dev mode, this should be created automatically by the auth system.')
        
        // Wait a moment and try again - the auth system might still be creating it
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const { data: retryData, error: retryError } = await supabase
          .from('ghl_configurations')
          .select('*')
          .eq('ghl_account_id', user.locationId)
          .eq('is_active', true)
          .maybeSingle()

        if (!retryError && retryData) {
          console.log('Found config on retry:', retryData.id)
          setConfigError(null)
          return retryData
        }
      }

      // No configuration found
      console.log('No configuration found for user')
      setConfigError('No configuration found. This should be created automatically.')
      return null

    } catch (error) {
      console.error('Unexpected error in getGHLConfiguration:', error)
      setConfigError(`Unexpected error: ${error.message}`)
      return null
    }
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
          {user.devMode && ' The configuration should be created automatically by the auth system.'}
        </p>
        <div className="mt-3 text-xs text-yellow-700 space-y-1">
          <p><strong>User ID:</strong> {user.userId}</p>
          <p><strong>Location ID:</strong> {user.locationId}</p>
          <p><strong>Dev Mode:</strong> {user.devMode ? 'Yes' : 'No'}</p>
          {configError && (
            <p><strong>Error:</strong> {configError}</p>
          )}
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
              Dev Mode: Using configuration ID {ghlConfig.id} for location {ghlConfig.ghl_account_id}
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