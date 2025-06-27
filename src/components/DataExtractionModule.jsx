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
      configFound: user.configFound,
      configId: user.configId,
      tokenStatus: user.tokenStatus
    })

    try {
      // Try to find by ghl_account_id (location ID)
      if (user.locationId) {
        console.log('Finding config by ghl_account_id:', user.locationId)
        
        const { data: locationData, error: locationError } = await supabase
          .from('ghl_configurations')
          .select('*')
          .eq('ghl_account_id', user.locationId)
          .eq('is_active', true)
          .maybeSingle()

        if (locationError) {
          console.error('Error querying by ghl_account_id:', locationError)
          setConfigError(`Database query failed: ${locationError.message}`)
          return null
        } 
        
        if (locationData) {
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

      // Try to find by user_id as fallback
      console.log('Finding config by user_id:', user.userId)
      
      const { data: userData, error: userError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('user_id', user.userId)
        .eq('is_active', true)
        .maybeSingle()

      if (userError) {
        console.error('Error querying by user_id:', userError)
        setConfigError(`Database query failed: ${userError.message}`)
        return null
      } 
      
      if (userData) {
        console.log('Found config by user_id:', userData.id)
        return userData
      }

      // No configuration found
      console.log('No configuration found for user')
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
    window.open('https://marketplace.gohighlevel.com', '_blank')
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
          Please install the app via the GoHighLevel marketplace to get proper access tokens.
        </p>
        <div className="mt-3 text-xs text-yellow-700 space-y-1">
          <p><strong>User ID:</strong> {user.userId}</p>
          <p><strong>Location ID:</strong> {user.locationId}</p>
          <p><strong>Config Found:</strong> {user.configFound ? 'Yes' : 'No'}</p>
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
            Install App
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