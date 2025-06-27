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
  const [retryCount, setRetryCount] = useState(0)
  const [tokenStatus, setTokenStatus] = useState(null)

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
        // Check token status
        const status = validateTokenStatus(config)
        setTokenStatus(status)
        
        if (status.isValid) {
          // Load custom fields and extraction fields in parallel
          await Promise.all([
            loadCustomFields(config),
            loadExtractionFields(config.id)
          ])
        } else {
          setConfigError(`Token issue: ${status.message}`)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const validateTokenStatus = (config) => {
    if (!config.access_token) {
      return {
        isValid: false,
        status: 'missing_access_token',
        message: 'Access token is missing. Please reinstall the app or contact support.',
        severity: 'error'
      }
    }
    
    if (!config.refresh_token) {
      return {
        isValid: false,
        status: 'missing_refresh_token',
        message: 'Refresh token is missing. Please reinstall the app.',
        severity: 'error'
      }
    }
    
    if (config.token_expires_at) {
      const expiryDate = new Date(config.token_expires_at)
      const now = new Date()
      const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      if (hoursUntilExpiry < 0) {
        return {
          isValid: false,
          status: 'expired',
          message: 'Access token has expired. The system will attempt to refresh it automatically.',
          severity: 'warning'
        }
      } else if (hoursUntilExpiry < 24) {
        return {
          isValid: true,
          status: 'expiring_soon',
          message: `Access token expires in ${Math.round(hoursUntilExpiry)} hours.`,
          severity: 'info'
        }
      }
    }
    
    return {
      isValid: true,
      status: 'valid',
      message: 'Access token is valid.',
      severity: 'success'
    }
  }

  const getGHLConfiguration = async () => {
    console.log('=== CONFIGURATION LOOKUP START ===')
    console.log('User context:', {
      userId: user.userId,
      locationId: user.locationId,
      devMode: user.devMode,
      configCreated: user.configCreated,
      configId: user.configId,
      tokenStatus: user.tokenStatus
    })

    try {
      // Strategy 1: Try to find by ghl_account_id (location ID) first
      if (user.locationId) {
        console.log('Strategy 1: Finding config by ghl_account_id:', user.locationId)
        
        const { data: locationData, error: locationError } = await supabase
          .from('ghl_configurations')
          .select('*')
          .eq('ghl_account_id', user.locationId)
          .eq('is_active', true)
          .maybeSingle()

        if (locationError) {
          console.error('Error querying by ghl_account_id:', {
            code: locationError.code,
            message: locationError.message,
            details: locationError.details
          })
          setConfigError(`Database query failed: ${locationError.message}`)
        } else if (locationData) {
          console.log('Found config by ghl_account_id:', {
            id: locationData.id,
            userId: locationData.user_id,
            businessName: locationData.business_name,
            hasAccessToken: !!locationData.access_token,
            hasRefreshToken: !!locationData.refresh_token,
            tokenExpiry: locationData.token_expires_at
          })
          
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
      console.log('Strategy 2: Finding config by user_id:', user.userId)
      
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
        console.log('Strategy 3: Dev mode - attempting to create configuration...')
        
        if (retryCount < 3) {
          console.log(`Retry attempt ${retryCount + 1}/3 - waiting for auth system to create config...`)
          setConfigError(`No configuration found. Attempting to create one... (Attempt ${retryCount + 1}/3)`)
          
          // Wait and retry
          setTimeout(() => {
            setRetryCount(prev => prev + 1)
            loadData()
          }, 2000)
          
          return null
        } else {
          console.log('Max retries reached, attempting manual creation...')
          const manualConfig = await createDevConfiguration()
          if (manualConfig) {
            setRetryCount(0) // Reset retry count on success
            return manualConfig
          }
        }
      } else {
        // Production mode - configuration should exist from OAuth flow
        setConfigError(
          'No configuration found for this location. ' +
          'Please ensure the app is properly installed via the GoHighLevel marketplace.'
        )
      }

      // No configuration found
      console.log('No configuration found for user')
      return null

    } catch (error) {
      console.error('Unexpected error in getGHLConfiguration:', error)
      setConfigError(`Unexpected error: ${error.message}`)
      return null
    }
  }

  const createDevConfiguration = async () => {
    try {
      console.log('=== MANUAL DEV CONFIG CREATION ===')
      
      const configData = {
        user_id: user.userId,
        ghl_account_id: user.locationId,
        client_id: 'dev-client-id',
        client_secret: 'dev-client-secret',
        access_token: 'dev-access-token-' + Date.now(),
        refresh_token: 'dev-refresh-token-' + Date.now(),
        token_expires_at: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(),
        business_name: 'Development Business',
        business_address: '123 Dev Street',
        business_phone: '+1-555-0123',
        business_email: user.email,
        business_website: 'https://dev.example.com',
        business_description: 'Development environment business for testing',
        target_audience: 'Developers and testers',
        services_offered: 'Software development and testing services',
        business_context: 'This is a development environment configuration for testing purposes',
        is_active: true,
        created_by: user.userId
      }

      console.log('Creating config with data:', {
        user_id: configData.user_id,
        ghl_account_id: configData.ghl_account_id,
        business_name: configData.business_name
      })

      const { data: newConfig, error: insertError } = await supabase
        .from('ghl_configurations')
        .insert(configData)
        .select()
        .single()

      if (insertError) {
        console.error('Manual config creation failed:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details
        })
        
        // If unique constraint violation, try to fetch existing
        if (insertError.code === '23505') {
          const { data: existing } = await supabase
            .from('ghl_configurations')
            .select('*')
            .eq('ghl_account_id', user.locationId)
            .single()
          
          if (existing) {
            console.log('Found existing config after constraint violation')
            return existing
          }
        }
        
        throw new Error(`Failed to create configuration: ${insertError.message}`)
      }

      console.log('Manual config creation successful:', newConfig.id)
      return newConfig
      
    } catch (error) {
      console.error('Manual config creation error:', error)
      setConfigError(`Failed to create configuration: ${error.message}`)
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

  const handleRetryConfiguration = () => {
    setRetryCount(0)
    loadData()
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
          {user.devMode 
            ? ' The configuration should be created automatically by the auth system.'
            : ' Please ensure the app is properly installed via the GoHighLevel marketplace.'
          }
        </p>
        <div className="mt-3 text-xs text-yellow-700 space-y-1">
          <p><strong>User ID:</strong> {user.userId}</p>
          <p><strong>Location ID:</strong> {user.locationId}</p>
          <p><strong>Dev Mode:</strong> {user.devMode ? 'Yes' : 'No'}</p>
          <p><strong>Config Created:</strong> {user.configCreated ? 'Yes' : 'No'}</p>
          <p><strong>Config ID:</strong> {user.configId || 'None'}</p>
          <p><strong>Token Status:</strong> {user.tokenStatus || 'Unknown'}</p>
          <p><strong>Retry Count:</strong> {retryCount}/3</p>
          {configError && (
            <p><strong>Error:</strong> {configError}</p>
          )}
        </div>
        <div className="mt-3 space-x-2">
          <button
            onClick={handleRetryConfiguration}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            Retry Loading
          </button>
          {user.devMode && (
            <button
              onClick={createDevConfiguration}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
            >
              Force Create Config
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Token Status Alert */}
      {tokenStatus && !tokenStatus.isValid && (
        <div className={`border rounded-lg p-4 ${
          tokenStatus.severity === 'error' 
            ? 'bg-red-50 border-red-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h3 className={`font-medium ${
            tokenStatus.severity === 'error' ? 'text-red-800' : 'text-yellow-800'
          }`}>
            Token Issue Detected
          </h3>
          <p className={`text-sm mt-1 ${
            tokenStatus.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {tokenStatus.message}
          </p>
          {tokenStatus.severity === 'error' && (
            <div className="mt-3">
              <button
                onClick={() => window.open('https://marketplace.gohighlevel.com', '_blank')}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
              >
                Reinstall App
              </button>
            </div>
          )}
        </div>
      )}

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
          {tokenStatus && tokenStatus.isValid && (
            <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
              Token Status: {tokenStatus.message}
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