import React, { useState, useEffect } from 'react'

function AgencySettings({ user, authService }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [hasKey, setHasKey] = useState(false)
  const [keyInfo, setKeyInfo] = useState(null)
  const [formData, setFormData] = useState({
    openai_api_key: '',
    openai_org_id: ''
  })
  const [showKey, setShowKey] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')

  useEffect(() => {
    loadAgencySettings()
  }, [])

  const loadAgencySettings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Loading agency settings...')
      
      // Get the authenticated Supabase client
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase
      
      // Call the manage-agency-keys Edge Function to get current key info
      const { data, error } = await supabase.functions.invoke('manage-agency-keys', {
        method: 'GET'
      })
      
      if (error) {
        console.error('Error loading agency settings:', error)
        throw new Error(`Failed to load agency settings: ${error.message}`)
      }
      
      console.log('Agency settings loaded:', data)
      
      setHasKey(data.hasKey)
      if (data.hasKey && data.keyInfo) {
        setKeyInfo(data.keyInfo)
      }
    } catch (error) {
      console.error('Error loading agency settings:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      
      // Validate API key format
      if (!formData.openai_api_key.startsWith('sk-')) {
        throw new Error('Invalid OpenAI API key format. Keys should start with "sk-"')
      }
      
      console.log('Saving OpenAI API key...')
      
      // Get the authenticated Supabase client
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase
      
      // Call the manage-agency-keys Edge Function to save the key
      const { data, error } = await supabase.functions.invoke('manage-agency-keys', {
        method: 'POST',
        body: {
          openai_api_key: formData.openai_api_key,
          openai_org_id: formData.openai_org_id || null
        }
      })
      
      if (error) {
        console.error('Error saving API key:', error)
        throw new Error(`Failed to save API key: ${error.message}`)
      }
      
      console.log('API key saved successfully:', data)
      
      setSuccess('OpenAI API key saved successfully')
      setFormData({
        openai_api_key: '',
        openai_org_id: ''
      })
      
      // Reload settings to get updated info
      await loadAgencySettings()
      
    } catch (error) {
      console.error('Error saving API key:', error)
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (confirmDelete !== 'DELETE') {
      setError('Please type "DELETE" to confirm')
      return
    }
    
    try {
      setDeleting(true)
      setError(null)
      setSuccess(null)
      
      console.log('Deleting OpenAI API key...')
      
      // Get the authenticated Supabase client
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase
      
      // Call the manage-agency-keys Edge Function to delete the key
      const { data, error } = await supabase.functions.invoke('manage-agency-keys', {
        method: 'DELETE'
      })
      
      if (error) {
        console.error('Error deleting API key:', error)
        throw new Error(`Failed to delete API key: ${error.message}`)
      }
      
      console.log('API key deleted successfully:', data)
      
      setSuccess('OpenAI API key deleted successfully')
      setConfirmDelete('')
      setHasKey(false)
      setKeyInfo(null)
      
    } catch (error) {
      console.error('Error deleting API key:', error)
      setError(error.message)
    } finally {
      setDeleting(false)
    }
  }

  // Check if user is an agency on a premium plan
  const isEligibleAgency = user && 
                          user.type === 'agency' && 
                          ['premium', 'enterprise'].includes(user.paymentPlan || 'standard')

  if (!isEligibleAgency) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Agency Settings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your agency's OpenAI API key and branding settings.
          </p>
        </div>
        
        <div className="p-6">
          <div className="error-card">
            <h3 className="text-red-800 font-medium">Access Restricted</h3>
            <p className="text-red-600 text-sm mt-1">
              Only agency users on premium or enterprise plans can access these settings.
            </p>
            <p className="text-red-600 text-sm mt-1">
              Your current user type: {user?.type || 'Unknown'}
            </p>
            <p className="text-red-600 text-sm mt-1">
              Your current plan: {user?.paymentPlan || 'standard'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Agency Settings</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage your agency's OpenAI API key and branding settings.
        </p>
      </div>
      
      <div className="p-6">
        {error && (
          <div className="error-card">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="success-card">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}
        
        <div className="space-y-8">
          {/* OpenAI API Key Management */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">OpenAI API Key Management</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading settings...</span>
              </div>
            ) : hasKey ? (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Current API Key</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Masked Key:</span> {keyInfo.masked_key}
                    </p>
                    {keyInfo.has_org_id && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Organization ID:</span> Set
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Last Updated:</span> {new Date(keyInfo.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Update API Key</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Enter a new API key to replace your existing one.
                  </p>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="form-label">
                        OpenAI API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showKey ? "text" : "password"}
                          name="openai_api_key"
                          value={formData.openai_api_key}
                          onChange={handleChange}
                          className="form-input pr-10"
                          placeholder="sk-..."
                          required
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                          onClick={() => setShowKey(!showKey)}
                        >
                          {showKey ? "Hide" : "Show"}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Your API key is encrypted before storage and never exposed in plaintext.
                      </p>
                    </div>
                    
                    <div>
                      <label className="form-label">
                        OpenAI Organization ID (Optional)
                      </label>
                      <input
                        type="text"
                        name="openai_org_id"
                        value={formData.openai_org_id}
                        onChange={handleChange}
                        className="form-input"
                        placeholder="org-..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Only required if you're using an organization-specific API key.
                      </p>
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary"
                      >
                        {saving ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                          </div>
                        ) : (
                          'Update API Key'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">Delete API Key</h4>
                  <p className="text-sm text-red-600 mb-4">
                    Removing your API key will revert to using the system default key.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-1">
                        Type "DELETE" to confirm
                      </label>
                      <input
                        type="text"
                        value={confirmDelete}
                        onChange={(e) => setConfirmDelete(e.target.value)}
                        className="form-input border-red-300 focus:ring-red-500 focus:border-red-500"
                        placeholder="Type DELETE here"
                      />
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting || confirmDelete !== 'DELETE'}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                      >
                        {deleting ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Deleting...
                          </div>
                        ) : (
                          'Delete API Key'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="info-card">
                  <h4 className="text-blue-800 font-medium mb-2">No API Key Configured</h4>
                  <p className="text-blue-700 text-sm">
                    As a premium agency, you can use your own OpenAI API key for all AI operations.
                    This gives you more control over costs and usage.
                  </p>
                </div>
                
                <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="form-label">
                      OpenAI API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        name="openai_api_key"
                        value={formData.openai_api_key}
                        onChange={handleChange}
                        className="form-input pr-10"
                        placeholder="sk-..."
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? "Hide" : "Show"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Your API key is encrypted before storage and never exposed in plaintext.
                    </p>
                  </div>
                  
                  <div>
                    <label className="form-label">
                      OpenAI Organization ID (Optional)
                    </label>
                    <input
                      type="text"
                      name="openai_org_id"
                      value={formData.openai_org_id}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="org-..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only required if you're using an organization-specific API key.
                    </p>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary"
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </div>
                      ) : (
                        'Save API Key'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
          
          {/* Agency Branding Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Agency Branding</h3>
            <p className="text-sm text-gray-600 mb-4">
              Coming soon: Customize the branding of this application with your agency's name and logo.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Feature in Development</h4>
              <p className="text-sm text-yellow-700">
                Agency branding customization will be available in an upcoming update.
                This will allow you to replace "GoHighLevel" references with your own agency name.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgencySettings