import React, { useState, useEffect } from 'react'
import { DatabaseService } from '../services/DatabaseService'

function ConfigurationDebugger({ user, authService, onConfigurationFound }) {
  const [loading, setLoading] = useState(false)
  const [debugData, setDebugData] = useState(null)
  const [allConfigs, setAllConfigs] = useState([])
  const [error, setError] = useState(null)
  const [rlsTest, setRlsTest] = useState(null)

  useEffect(() => {
    runDiagnostics()
  }, [user])

  const runDiagnostics = async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('=== CONFIGURATION DIAGNOSTICS ===')
      
      // Test RLS policies first
      console.log('Testing RLS policies...')
      try {
        const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase
        const { data: rlsTestData, error: rlsError } = await supabase
          .rpc('test_ghl_configuration_access')

        if (rlsError) {
          console.error('RLS test failed:', rlsError)
          setRlsTest({ error: rlsError.message })
        } else {
          console.log('RLS test result:', rlsTestData)
          setRlsTest(rlsTestData?.[0] || null)
        }
      } catch (rlsTestError) {
        console.error('RLS test error:', rlsTestError)
        setRlsTest({ error: rlsTestError.message })
      }

      // Get all configurations for debugging
      const allConfigsResult = await DatabaseService.getAllConfigurations(authService)
      if (allConfigsResult.error) {
        console.error('Failed to fetch configurations:', allConfigsResult.error)
        setAllConfigs([])
      } else {
        setAllConfigs(allConfigsResult.data)
        console.log('Total configurations in database:', allConfigsResult.data.length)
      }

      // Try comprehensive lookup
      const lookupResult = await DatabaseService.findConfiguration(user.userId, user.locationId, authService)
      
      setDebugData({
        targetUserId: user.userId,
        targetLocationId: user.locationId,
        lookupResult,
        totalConfigs: allConfigsResult.data?.length || 0,
        matchingLocation: allConfigsResult.data?.filter(c => c.ghl_account_id === user.locationId) || [],
        matchingUser: allConfigsResult.data?.filter(c => c.user_id === user.userId) || [],
        databaseError: allConfigsResult.error
      })

      if (lookupResult.found && onConfigurationFound) {
        onConfigurationFound(lookupResult.data)
      }

    } catch (error) {
      console.error('Diagnostics error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const createTestConfiguration = async () => {
    setLoading(true)
    try {
      const configData = {
        user_id: user.userId,
        ghl_account_id: user.locationId,
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        access_token: 'test-access-token-' + Date.now(),
        refresh_token: 'test-refresh-token-' + Date.now(),
        token_expires_at: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(),
        business_name: 'Test Configuration',
        business_description: 'Test configuration created by debugger',
        is_active: true,
        created_by: user.userId
      }

      const result = await DatabaseService.createConfiguration(configData, authService)
      
      if (result.success) {
        console.log('✅ Test configuration created:', result.data.id)
        if (onConfigurationFound) {
          onConfigurationFound(result.data)
        }
        // Re-run diagnostics to show the new config
        await runDiagnostics()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error creating test configuration:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const linkExistingConfiguration = async (configId) => {
    setLoading(true)
    try {
      const result = await DatabaseService.linkConfigurationToUser(configId, user.userId, authService)
      
      if (result.success) {
        console.log('✅ Configuration linked:', result.data.id)
        if (onConfigurationFound) {
          onConfigurationFound(result.data)
        }
        await runDiagnostics()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error linking configuration:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-blue-800">Running configuration diagnostics...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration Diagnostics</h3>
      
      {error && (
        <div className="error-card">
          <p className="text-red-600 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* RLS Test Results */}
      {rlsTest && (
        <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-2">Database Access Test</h4>
          {rlsTest.error ? (
            <div className="text-sm text-red-600">
              <p><strong>Error:</strong> {rlsTest.error}</p>
            </div>
          ) : (
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Total Configs:</strong> {rlsTest.total_configs}</p>
              <p><strong>Accessible:</strong> {rlsTest.accessible_configs}</p>
              <p><strong>Status:</strong> {rlsTest.test_result}</p>
            </div>
          )}
        </div>
      )}

      {debugData && (
        <div className="space-y-4">
          {/* Target Information */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-2">Target Information</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>User ID:</strong> {debugData.targetUserId}</p>
              <p><strong>Location ID:</strong> {debugData.targetLocationId}</p>
              <p><strong>Auth Service:</strong> {authService ? 'Available' : 'Not Available'}</p>
              <p><strong>JWT:</strong> {authService?.getJWT() ? 'Available' : 'Not Available'}</p>
            </div>
          </div>

          {/* Lookup Results */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-2">Lookup Results</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Found:</strong> {debugData.lookupResult.found ? '✅ Yes' : '❌ No'}</p>
              <p><strong>Strategy:</strong> {debugData.lookupResult.strategy}</p>
              {debugData.lookupResult.data && (
                <p><strong>Config ID:</strong> {debugData.lookupResult.data.id}</p>
              )}
              {debugData.lookupResult.error && (
                <p><strong>Error:</strong> {debugData.lookupResult.error}</p>
              )}
            </div>
          </div>

          {/* Database Statistics */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-2">Database Statistics</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Total Configurations:</strong> {debugData.totalConfigs}</p>
              <p><strong>Matching Location:</strong> {debugData.matchingLocation.length}</p>
              <p><strong>Matching User:</strong> {debugData.matchingUser.length}</p>
              {debugData.databaseError && (
                <p><strong>Database Error:</strong> <span className="text-red-600">{debugData.databaseError}</span></p>
              )}
            </div>
          </div>

          {/* Available Configurations */}
          {allConfigs.length > 0 && (
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-gray-800 mb-2">Available Configurations</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {allConfigs.map(config => (
                  <div key={config.id} className="text-xs bg-gray-50 p-3 rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <p><strong>ID:</strong> {config.id.substring(0, 8)}...</p>
                        <p><strong>User:</strong> {config.user_id || 'null'}</p>
                        <p><strong>Location:</strong> {config.ghl_account_id}</p>
                        <p><strong>Name:</strong> {config.business_name}</p>
                      </div>
                      {config.ghl_account_id === user.locationId && config.user_id !== user.userId && (
                        <button
                          onClick={() => linkExistingConfiguration(config.id)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                          disabled={loading}
                        >
                          Link
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-2">Actions</h4>
            <div className="space-y-2">
              <button
                onClick={runDiagnostics}
                className="btn-secondary text-sm mr-2"
                disabled={loading}
              >
                Re-run Diagnostics
              </button>
              
              {!debugData.lookupResult.found && (
                <button
                  onClick={createTestConfiguration}
                  className="btn-success text-sm"
                  disabled={loading}
                >
                  Create Test Configuration
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConfigurationDebugger