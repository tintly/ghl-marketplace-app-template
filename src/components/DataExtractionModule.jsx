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
  const [tokenStatus, setTokenStatus] = useState(null)
  const [debugInfo, setDebugInfo] = useState(null)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      setConfigError(null)

      // Get GHL configuration with detailed debugging
      const config = await getGHLConfigurationWithDebug()
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

  const getGHLConfigurationWithDebug = async () => {
    console.log('=== CONFIGURATION LOOKUP START ===')
    console.log('Target user_id:', user.userId)
    console.log('Target location_id:', user.locationId)

    try {
      // Strategy 1: Exact match lookup
      console.log('Strategy 1: Exact match lookup')
      const { data: exactMatch, error: exactError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', user.userId)
        .eq('ghl_account_id', user.locationId)
        .eq('is_active', true)
        .maybeSingle()

      if (exactError) {
        console.error('Exact match error:', exactError)
      } else if (exactMatch) {
        console.log('✅ Found exact match:', exactMatch.id)
        setDebugInfo({ strategy: 'exact_match', config: exactMatch })
        return exactMatch
      }

      // Strategy 2: Location-based lookup
      console.log('Strategy 2: Location-based lookup')
      const { data: locationMatch, error: locationError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('ghl_account_id', user.locationId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      if (locationError) {
        console.error('Location lookup error:', locationError)
      } else if (locationMatch && locationMatch.length > 0) {
        console.log('✅ Found by location:', locationMatch[0].id)
        console.log('Location match user_id:', locationMatch[0].user_id)
        console.log('Target user_id:', user.userId)
        
        const config = locationMatch[0]
        
        // If found but no user_id or different user_id, try to link it
        if (!config.user_id || config.user_id !== user.userId) {
          console.log('Attempting to link configuration to user...')
          const linkedConfig = await linkConfigurationToUser(config.id, user.userId)
          if (linkedConfig) {
            setDebugInfo({ strategy: 'location_linked', config: linkedConfig })
            return linkedConfig
          }
        }
        
        setDebugInfo({ strategy: 'location_match', config })
        return config
      }

      // Strategy 3: User-based lookup
      console.log('Strategy 3: User-based lookup')
      const { data: userMatch, error: userError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', user.userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      if (userError) {
        console.error('User lookup error:', userError)
      } else if (userMatch && userMatch.length > 0) {
        console.log('✅ Found by user:', userMatch[0].id)
        setDebugInfo({ strategy: 'user_match', config: userMatch[0] })
        return userMatch[0]
      }

      // Strategy 4: Debug - show all configs
      console.log('Strategy 4: Debug - showing all configs')
      const { data: allConfigs, error: allError } = await supabase
        .from('ghl_configurations')
        .select('id, user_id, ghl_account_id, business_name, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10)

      if (allError) {
        console.error('Debug query error:', allError)
      } else {
        console.log('Recent configurations in database:')
        allConfigs.forEach(config => {
          console.log(`- ID: ${config.id}, User: ${config.user_id}, Location: ${config.ghl_account_id}, Name: ${config.business_name}`)
        })
        
        // Check if our target location exists with any user
        const targetLocationConfig = allConfigs.find(c => c.ghl_account_id === user.locationId)
        if (targetLocationConfig) {
          console.log('🎯 Found target location with different user_id!')
          console.log('Config user_id:', targetLocationConfig.user_id)
          console.log('Current user_id:', user.userId)
          
          // Try to link this configuration
          const linkedConfig = await linkConfigurationToUser(targetLocationConfig.id, user.userId)
          if (linkedConfig) {
            setDebugInfo({ strategy: 'debug_linked', config: linkedConfig })
            return linkedConfig
          }
        }
        
        setDebugInfo({ strategy: 'debug_failed', allConfigs })
      }

      console.log('❌ No configuration found anywhere')
      return null

    } catch (error) {
      console.error('Configuration lookup error:', error)
      setDebugInfo({ strategy: 'error', error: error.message })
      throw error
    }
  }

  const linkConfigurationToUser = async (configId, userId) => {
    try {
      console.log('Linking configuration to user:', { configId, userId })
      
      const { data, error } = await supabase
        .from('ghl_configurations')
        .update({
          user_id: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', configId)
        .select()
        .single()

      if (error) {
        console.error('Failed to link configuration:', error)
        return null
      }

      console.log('✅ Successfully linked configuration')
      return data

    } catch (error) {
      console.error('Link configuration error:', error)
      return null
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
        <h3 className="text-yellow-800 font-medium">❌ No Configuration Found</h3>
        <p className="text-yellow-600 text-sm mt-1">
          {configError || 'No GoHighLevel configuration found for this location.'}
        </p>
        
        {/* Debug Information */}
        {debugInfo && (
          <div className="mt-4 bg-white border border-yellow-300 rounded p-3">
            <h4 className="font-semibold text-yellow-900 mb-2">Debug Information:</h4>
            <div className="text-xs text-yellow-800 space-y-1">
              <p><strong>Strategy Used:</strong> {debugInfo.strategy}</p>
              <p><strong>Target User ID:</strong> {user.userId}</p>
              <p><strong>Target Location ID:</strong> {user.locationId}</p>
              
              {debugInfo.allConfigs && (
                <div className="mt-2">
                  <p><strong>Available Configurations:</strong></p>
                  {debugInfo.allConfigs.map(config => (
                    <div key={config.id} className="ml-2 text-xs">
                      • ID: {config.id.substring(0, 8)}..., User: {config.user_id || 'null'}, Location: {config.ghl_account_id}
                    </div>
                  ))}
                </div>
              )}
              
              {debugInfo.error && (
                <p><strong>Error:</strong> {debugInfo.error}</p>
              )}
            </div>
          </div>
        )}
        
        <div className="mt-3 text-xs text-yellow-700 space-y-1">
          <p><strong>Expected Config ID:</strong> 5cad15db-9da3-4d45-b09e-6196bcd1ef96</p>
          <p><strong>Expected User ID:</strong> qNgrB0T9EG975nt0FVQk</p>
          <p><strong>Expected Location ID:</strong> 3lkoUn4O7jExzrkx3shg</p>
        </div>
        
        <div className="mt-3">
          <button
            onClick={handleRetryConfiguration}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-green-800 font-medium">✅ Configuration Found!</h3>
        <div className="text-xs text-green-700 mt-2 space-y-1">
          <p><strong>Config ID:</strong> {ghlConfig.id}</p>
          <p><strong>Strategy:</strong> {debugInfo?.strategy || 'unknown'}</p>
          <p><strong>User ID:</strong> {ghlConfig.user_id}</p>
          <p><strong>Location ID:</strong> {ghlConfig.ghl_account_id}</p>
          <p><strong>Business Name:</strong> {ghlConfig.business_name}</p>
        </div>
      </div>

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
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Data Extraction Configuration</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure which custom fields should be automatically populated by AI during conversations.
          </p>
          <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
            Using configuration ID: {ghlConfig.id} for location {ghlConfig.ghl_account_id}
          </div>
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