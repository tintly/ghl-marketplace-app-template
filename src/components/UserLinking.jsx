import React, { useState, useEffect } from 'react'

function UserLinking({ user, authService, onLinkingComplete }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [unlinkedConfigs, setUnlinkedConfigs] = useState([])

  useEffect(() => {
    checkForUnlinkedConfigurations()
  }, [user])

  const checkForUnlinkedConfigurations = async () => {
    try {
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase

      // Look for configurations that match this user's location but have no user_id
      const { data, error } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('ghl_account_id', user.locationId)
        .is('user_id', null)

      if (error) {
        console.error('Error checking for unlinked configurations:', error)
        return
      }

      if (data && data.length > 0) {
        setUnlinkedConfigs(data)
      }
    } catch (error) {
      console.error('Error checking unlinked configurations:', error)
    }
  }

  const linkConfiguration = async (configId) => {
    setLoading(true)
    setError(null)

    try {
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase

      const { error } = await supabase
        .from('ghl_configurations')
        .update({ 
          user_id: user.userId,
          created_by: user.userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', configId)

      if (error) {
        throw error
      }

      // Remove the linked config from the list
      setUnlinkedConfigs(prev => prev.filter(config => config.id !== configId))
      
      if (onLinkingComplete) {
        onLinkingComplete()
      }
    } catch (error) {
      console.error('Error linking configuration:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (unlinkedConfigs.length === 0) {
    return null
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-blue-900 mb-2">
        Link Your Installation
      </h3>
      <p className="text-blue-800 mb-4">
        We found an existing installation for this location that needs to be linked to your account.
      </p>
      
      {error && (
        <div className="error-card">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {unlinkedConfigs.map((config) => (
          <div key={config.id} className="bg-white border border-blue-200 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{config.business_name}</p>
                <p className="text-sm text-gray-600">
                  Installed: {new Date(config.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => linkConfiguration(config.id)}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Linking...' : 'Link to My Account'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default UserLinking