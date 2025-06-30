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
  const [tokenValidation, setTokenValidation] = useState(null)

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
        // Validate token status
        const validation = validateTokenStatus(config)
        setTokenValidation(validation)
        
        if (validation.isValid) {
          // Load custom fields and extraction fields in parallel
          await Promise.all([
            loadCustomFields(config),
            loadExtractionFields(config.id)
          ])
        } else {
          setConfigError(`Token issue: ${validation.message}`)
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
        message: 'Access token is missing. Please reinstall the app.',
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
      message: 'Access token is valid and ready for use.',
      severity: 'success'
    }
  }

  const getGHLConfiguration = async () => {
    console.log('=== CONFIGURATION LOOKUP START ===')
    console.log('User context:', {
      userId: user.userId,
      locationId: user.locationId,
      configValidated: user.configValidated,
      configId: user.configId,
      tokenStatus: user.tokenStatus
    })

    try {
      // Strategy 1: If we have a configId from auth, try to fetch it directly
      if (user.configId) {
        console.log('Strategy 1: Direct config fetch by ID:', user.configId)
        
        const { data: directConfig, error: directError } = await supabase
          .from('ghl_configurations')
          .select('*')
          .eq('id', user.configId)
          .eq('is_active', true)
          .maybeSingle()

        if (directError) {
          console.error('Error fetching config by ID:', directError)
        } else if (directConfig) {
          console.log('✅ Found config by direct ID lookup')
          return directConfig
        } else {
          console.log('❌ Config ID provided but not found in database')
        }
      }

      // Strategy 2: Try to find by ghl_account_id (location ID) - most reliable
      if (user.locationId) {
        console.log('Strategy 2: Finding config by ghl_account_id:', user.locationId)
        
        const { data: locationConfigs, error: locationError } = await supabase
          .from('ghl_configurations')
          .select('*')
          .eq('ghl_account_id', user.locationId)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })

        if (locationError) {
          console.error('Error querying by ghl_account_id:', locationError)
          setConfigError(`Database query failed: ${locationError.message}`)
        } else if (locationConfigs && locationConfigs.length > 0) {
          const locationData = locationConfigs[0] // Get the most recently updated one
          
          console.log('✅ Found config(s) by ghl_account_id:', {
            count: locationConfigs.length,
            selectedId: locationData.id,
            userId: locationData.user_id,
            businessName: locationData.business_name,
            hasAccessToken: !!locationData.access_token,
            hasRefreshToken: !!locationData.refresh_token
          })
          
          // If user_id doesn't match current user, update it
          if (!locationData.user_id || locationData.user_id !== user.userId) {
            console.log('Updating config user_id to match current SSO user...')
            
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
              console.error('Failed to update user_id:', updateError)
              // Still return original data
              return locationData
            }

            console.log('✅ Successfully updated config with current user_id')
            return updatedData
          }

          return locationData
        } else {
          console.log('❌ No configs found for location:', user.locationId)
        }
      }

      // Strategy 3: Try to find by user_id as fallback
      console.log('Strategy 3: Finding config by user_id:', user.userId)
      
      const { data: userConfigs, error: userError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', user.userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      if (userError) {
        console.error('Error querying by user_id:', userError)
      } else if (userConfigs && userConfigs.length > 0) {
        const userData = userConfigs[0]
        console.log('✅ Found config by user_id:', userData.id)
        return userData
      }

      // Strategy 4: Debug - show all configs for this location (ignore user_id)
      console.log('Strategy 4: Debug - checking ALL configs for location')
      
      const { data: allLocationConfigs, error: allError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('ghl_account_id', user.locationId)
        .order('created_at', { ascending: false })

      if (allError) {
        console.error('Error in debug query:', allError)
      } else {
        console.log('All configs for location:', allLocationConfigs?.map(c => ({
          id: c.id,
          user_id: c.user_id,
          is_active: c.is_active,
          business_name: c.business_name,
          created_at: c.created_at,
          hasTokens: !!(c.access_token && c.refresh_token)
        })))
        
        // If we found any config for this location, use the most recent active one
        const activeConfigs = allLocationConfigs?.filter(c => c.is_active) || []
        if (activeConfigs.length > 0) {
          const bestConfig = activeConfigs[0]
          console.log('Using most recent active config:', bestConfig.id)
          
          // Update it with current user_id
          const { data: updatedConfig, error: updateError } = await supabase
            .from('ghl_configurations')
            .update({ 
              user_id: user.userId,
              updated_at: new Date().toISOString()
            })
            .eq('id', bestConfig.id)
            .select()
            .single()

          if (updateError) {
            console.error('Failed to update best config:', updateError)
            return bestConfig
          }

          console.log('✅ Updated and using best available config')
          return updatedConfig
        }
      }

      // No configuration found at all
      console.log('❌ No configuration found anywhere')
      setConfigError(
        'No configuration found for this location. ' +
        'Please install the app via the GoHighLevel marketplace to get proper access tokens.'
      )
      return null

    } catch (error) {
      console.error('Unexpected error in getGHLConfiguration:', error)
      setConfigError(`Unexpected error: ${error.message}`)
      return null
    }
  }

  const loadCustomFields = async (config) => {
    try {
      const ghlService = new GHLApiService(config.access_token)
      const fields = await ghlService.getCustomFields(config.ghl_account_id)
      setCustomFields(fields)
    } catch (error) {
      console.error('Error loading custom fields:', error)
      throw new Error('Failed to load custom fields from GoHighLevel')
    }
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

  const handleReinstallApp = () => {
    const EXACT_INSTALL_URL = 'https://marketplace.leadconnectorhq.com/oauth/chooselocation?response_type=code&redirect_uri=https%3A%2F%2Feloquent-moonbeam-8a5386.netlify.app%2Foauth%2Fcallback&client_id=685c90c16a67491ca1f5f7de-mcf0wxc1&scope=conversations.readonly+conversations%2Fmessage.readonly+conversations%2Freports.readonly+contacts.readonly+contacts.write+locations.readonly+locations%2FcustomFields.readonly+locations%2FcustomFields.write+oauth.readonly+oauth.write'
    window.open(EXACT_INSTALL_URL, '_blank')
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
        <h3 className="text-yellow-800 font-medium">Configuration Issue</h3>
        <p className="text-yellow-600 text-sm mt-1">
          {configError || 'Unable to load GoHighLevel configuration.'}
        </p>
        <div className="mt-3 text-xs text-yellow-700 space-y-1">
          <p><strong>User ID:</strong> {user.userId}</p>
          <p><strong>Location ID:</strong> {user.locationId}</p>
          <p><strong>Config Validated:</strong> {user.configValidated ? 'Yes' : 'No'}</p>
          <p><strong>Config ID:</strong> {user.configId || 'None'}</p>
          <p><strong>Token Status:</strong> {user.tokenStatus || 'Unknown'}</p>
          {configError && (
            <p><strong>Error:</strong> {configError}</p>
          )}
        </div>
        <div className="mt-3 space-x-2">
          <button
            onClick={loadData}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            Retry Loading
          </button>
          <button
            onClick={handleReinstallApp}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            Reinstall App
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Token Status Alert */}
      {tokenValidation && !tokenValidation.isValid && (
        <div className={`border rounded-lg p-4 ${
          tokenValidation.severity === 'error' 
            ? 'bg-red-50 border-red-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h3 className={`font-medium ${
            tokenValidation.severity === 'error' ? 'text-red-800' : 'text-yellow-800'
          }`}>
            Token Issue Detected
          </h3>
          <p className={`text-sm mt-1 ${
            tokenValidation.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {tokenValidation.message}
          </p>
          {tokenValidation.severity === 'error' && (
            <div className="mt-3">
              <button
                onClick={handleReinstallApp}
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
          <div className="mt-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
            Config ID: {ghlConfig.id} | Location: {ghlConfig.ghl_account_id}
          </div>
          {tokenValidation && tokenValidation.isValid && (
            <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
              Token Status: {tokenValidation.message}
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