import React, { useState, useEffect } from 'react'
import { AgencyOpenAIService } from '../services/AgencyOpenAIService'

// Available OpenAI models
const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o mini - Fast, affordable small model' },
  { id: 'gpt-4o', name: 'GPT-4o - Fast, intelligent, flexible GPT model' },
  { id: 'gpt-4.1', name: 'GPT-4.1 - Flagship GPT model for complex tasks' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini - Balanced for intelligence, speed, and cost' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 nano - Fastest, most cost-effective GPT-4.1 model' },
  { id: 'o4-mini', name: 'o4-mini - Faster, more affordable reasoning model' },
  { id: 'o3', name: 'o3 - Most powerful reasoning model' },
  { id: 'o3-pro', name: 'o3-pro - Version of o3 with more compute' },
  { id: 'o3-mini', name: 'o3-mini - A small model alternative to o3' },
  { id: 'o1', name: 'o1 - Previous full o-series reasoning model' }
]

function AgencyOpenAIManager({ user, authService }) {
  const [keys, setKeys] = useState([])
  const [permissions, setPermissions] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingKey, setEditingKey] = useState(null)
  const [saving, setSaving] = useState(false)

  const openaiService = new AgencyOpenAIService(authService)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('Loading OpenAI data for user:', {
        userId: user.userId,
        type: user.type,
        companyId: user.companyId
      })

      // Agency users always have permission
      const isAgency = user.type === 'agency'

      if (isAgency) {
        console.log('User is agency type, skipping permission check')
        setPermissions({
          can_use_own_openai_key: true,
          is_agency_plan: true
        })
        setUpgradeRequired(false)
      } else {
        // For non-agency users, check permissions
        try {
          const canUse = await openaiService.canUseCustomOpenAIKey(user.companyId)
          const isAgencyPlan = await openaiService.isAgencyPlan()
          
          setPermissions({
            can_use_own_openai_key: canUse,
            is_agency_plan: isAgencyPlan
          })
          
          setUpgradeRequired(!canUse)
        } catch (permError) {
          console.error('Error checking permissions:', permError)
          setPermissions({
            can_use_own_openai_key: false,
            is_agency_plan: false
          })
          setUpgradeRequired(true)
        }
      }

      // Load keys for agency users or users with permission
      if (isAgency || permissions?.can_use_own_openai_key) {
        // Load keys
        try {
          console.log('Loading OpenAI keys for company ID:', user.companyId)
          const keysResult = await openaiService.getAgencyOpenAIKeys(user.companyId)
          if (keysResult.success) {
            setKeys(keysResult.data)
            console.log(`Loaded ${keysResult.data.length} OpenAI keys`)
          } else {
            console.warn('Failed to load OpenAI keys:', keysResult.error)
          }
        } catch (keysError) {
          console.error('Error loading OpenAI keys:', keysError)
        }

        // Load usage statistics
        try {
          console.log('Loading usage statistics for company ID:', user.companyId)
          const usageResult = await openaiService.getUsageStatistics(user.companyId, '30d')
          if (usageResult.success) {
            setUsage(usageResult.data)
            console.log('Loaded usage statistics:', usageResult.data)
          } else {
            console.warn('Failed to load usage statistics:', usageResult.error)
          }
        } catch (usageError) {
          console.error('Error loading usage statistics:', usageError)
        }
      }
    } catch (error) {
      console.error('Error loading OpenAI data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddKey = async (keyData) => {
    try {
      setSaving(true)
      console.log('Adding new OpenAI key for company ID:', user.companyId)
      const result = await openaiService.addOpenAIKey(user.companyId, keyData)
      
      if (result.success) {
        console.log('Successfully added OpenAI key')
        setKeys(prev => [result.data, ...prev])
        setShowAddForm(false)
        await loadData() // Refresh usage data
      } else {
        console.error('Failed to add OpenAI key:', result.error)
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error adding OpenAI key:', error)
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditKey = (key) => {
    setEditingKey(key)
    setShowEditForm(true)
  }

  const handleUpdateKey = async (keyData) => {
    try {
      setSaving(true)
      console.log('Updating OpenAI key:', { id: editingKey.id, model: keyData.openai_model })
      const result = await openaiService.updateOpenAIKey(editingKey.id, user.companyId, {
        openai_model: keyData.openai_model
      })
      
      if (result.success) {
        console.log('Successfully updated OpenAI key')
        // Update the key in the local state
        setKeys(prev => prev.map(k => 
          k.id === editingKey.id ? { ...k, openai_model: keyData.openai_model } : k
        ))
        setShowEditForm(false)
        setEditingKey(null)
      } else {
        console.error('Failed to update OpenAI key:', result.error)
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error updating OpenAI key:', error)
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to delete this OpenAI key?')) {
      return
    }

    try {
      console.log('Deleting OpenAI key:', keyId)
      const result = await openaiService.deleteOpenAIKey(keyId, user.companyId)

      if (result.success) {
        console.log('Successfully deleted OpenAI key')
        setKeys(prev => prev.filter(key => key.id !== keyId))
      } else {
        console.error('Failed to delete OpenAI key:', result.error)
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error deleting OpenAI key:', error)
      setError(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-gray-600">Loading OpenAI settings...</span>
      </div>
    )
  }

  if (user.type !== 'agency' && !permissions?.is_agency_plan) {
    // For non-agency users without permissions, show upgrade message
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">OpenAI API Keys</h2>
        </div>
        <div className="p-6">
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-yellow-800">Agency Feature</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Custom OpenAI key management is only available for agency accounts or premium plans.</p>
                <p className="mt-1">Please contact your agency administrator or upgrade your plan to use this feature.</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    )
  }

  // For agency users, never require upgrade
  if (!user.type === 'agency' && upgradeRequired) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">OpenAI API Keys</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your agency's OpenAI API keys for AI-powered data extraction.
          </p>
        </div>
        
        <div className="p-6">
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-yellow-800">Upgrade Required</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Your current plan does not include custom OpenAI key management.</p>
                  <p className="mt-1">Upgrade to the Business or Agency plan to use your own OpenAI API keys.</p>
                </div>
                <div className="mt-4">
                  <a href="/subscription" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500">
                    View Subscription Options
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Benefits of Using Your Own OpenAI Keys</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Direct control over API usage and billing</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Access to the latest OpenAI models</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Set custom usage limits for better cost management</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Improved reliability with your dedicated API access</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">OpenAI API Keys</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your agency's OpenAI API keys for AI-powered data extraction.
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary"
              disabled={loading}
            >
              Add API Key
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="error-card mb-6">
              <h3 className="text-red-800 font-medium">Error</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}

          {/* API Keys List */}
          <OpenAIKeysList
            keys={keys}
            onDelete={handleDeleteKey}
            onEdit={handleEditKey}
          />
        </div>
      </div>

      {/* Usage Statistics */}
      {usage && (
        <UsageStatistics usage={usage} />
      )}

      {/* Add Key Modal */}
      {showAddForm && (
        <AddOpenAIKeyForm
          saving={saving}
          onSubmit={handleAddKey}
          onCancel={() => setShowAddForm(false)}
        />
      )}
      
      {/* Edit Key Modal */}
      {showEditForm && editingKey && (
        <EditOpenAIKeyForm
          key={editingKey.id}
          keyData={editingKey}
          saving={saving}
          onSubmit={handleUpdateKey}
          onCancel={() => {
            setShowEditForm(false)
            setEditingKey(null)
          }}
        />
      )}
    </div>
  )
}

function OpenAIKeysList({ keys, onDelete, onEdit }) {
  if (keys.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <p className="text-gray-600 font-medium">No API keys configured</p>
        <p className="text-sm text-gray-500 mt-1">Add your first OpenAI API key to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-2">
        You have {keys.length} API key{keys.length !== 1 ? 's' : ''} configured.
      </p>
      {keys.map((key) => (
        <div key={key.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="font-medium text-gray-900">{key.key_name}</h3>
                <span className={`field-badge ${key.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {key.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="field-badge bg-blue-100 text-blue-800">
                  {key.openai_model || 'gpt-4o-mini'}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                {key.openai_org_id && (
                  <p><span className="font-medium">Organization ID:</span> {key.openai_org_id}</p>
                )}
                {key.usage_limit_monthly && (
                  <p>
                    <span className="font-medium">Monthly Limit:</span> ${key.usage_limit_monthly}
                    {key.current_usage_monthly && (
                      <span className="ml-2">
                        (Used: ${key.current_usage_monthly.toFixed(2)})
                      </span>
                    )}
                  </p>
                )}
                <p><span className="font-medium">Added:</span> {new Date(key.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="ml-4">
              <button
                onClick={() => onEdit(key)}
                className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50"
                title="Edit API key model"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(key.id)}
                className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 ml-2"
                title="Delete API key"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function UsageStatistics({ usage }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Usage Statistics (Last 30 Days)</h3>
      </div>
      
      <div className="p-6">
       {usage.total_requests === 0 ? (
         <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
           <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
           <p className="text-gray-600 font-medium">No usage data yet</p>
           <p className="text-sm text-gray-500 mt-1">
             Usage statistics will appear here once you start processing conversations with your custom OpenAI key.
           </p>
           <div className="mt-4 info-card mx-auto max-w-md">
             <p className="text-sm text-blue-800">
               <strong>Troubleshooting:</strong> If you're sending messages but not seeing usage data:
             </p>
             <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc pl-5">
               <li>Make sure your OpenAI key has proper permissions</li>
               <li>Check that conversations are being processed (see Logs section)</li>
               <li>Try sending a test message to trigger extraction</li>
               <li>Verify your subscription plan allows custom keys</li>
             </ul>
           </div>
         </div>
       ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{usage.total_requests}</div>
            <div className="text-sm text-gray-600">Total Requests</div>
          </div>
          <div className="text-center bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{usage.total_tokens.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Tokens</div>
          </div>
          <div className="text-center bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">${usage.total_cost.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Total Cost</div>
          </div>
          <div className="text-center bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{Object.keys(usage.by_model).length}</div>
            <div className="text-sm text-gray-600">Models Used</div>
          </div>
        </div>

        {/* Usage by Model */}
        {Object.keys(usage.by_model).length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Usage by Model Type</h4>
            <div className="space-y-2">
              {Object.entries(usage.by_model).map(([model, stats]) => (
                <div key={model} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="font-medium">{model}</span>
                  <div className="text-sm text-gray-600">
                    {stats.requests} requests • {stats.tokens.toLocaleString()} tokens • ${stats.cost.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
       )}
      </div>
    </div>
  )
}

function EditOpenAIKeyForm({ keyData, onSubmit, onCancel, saving = false }) {
  const [formData, setFormData] = useState({
    openai_model: keyData.openai_model || 'gpt-4o-mini'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      await onSubmit({
        openai_model: formData.openai_model
      })
    } catch (error) {
      console.error('Error submitting form:', error)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-2xl">
        <div className="modal-header">
          <h3 className="text-lg font-medium text-gray-900">Edit OpenAI Model</h3>
          <p className="text-sm text-gray-600 mt-1">
            Change the OpenAI model used for "{keyData.key_name}"
          </p>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">OpenAI Model</label>
              <select
                value={formData.openai_model}
                onChange={(e) => setFormData(prev => ({ ...prev, openai_model: e.target.value }))}
                className="form-select"
                disabled={saving}
              >
                {OPENAI_MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the OpenAI model to use with this API key.
              </p>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={saving}
          >
            {saving ? 'Please wait...' : 'Cancel'}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </div>
            ) : (
              'Update Model'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddOpenAIKeyForm({ onSubmit, onCancel, saving = false }) {
  const [formData, setFormData] = useState({
    key_name: '',
    api_key: '',
    org_id: '',
    usage_limit: '',
    openai_model: 'gpt-4o-mini'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      await onSubmit({
        key_name: formData.key_name,
        api_key: formData.api_key,
        org_id: formData.org_id || null,
        usage_limit: formData.usage_limit ? parseFloat(formData.usage_limit) : null,
        openai_model: formData.openai_model
      })
    } catch (error) {
      console.error('Error submitting form:', error)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-2xl">
        <div className="modal-header">
          <h3 className="text-lg font-medium text-gray-900">Add OpenAI API Key</h3>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Key Name *</label>
              <input
                type="text"
                value={formData.key_name}
                onChange={(e) => setFormData(prev => ({ ...prev, key_name: e.target.value }))}
                className="form-input"
                placeholder="e.g., Production Key"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label className="form-label">OpenAI API Key *</label>
              <input
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                className="form-input"
                placeholder="sk-..."
                required
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Your API key will be encrypted and stored securely.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Example: sk-1234...
              </p>
            </div>

            <div>
              <label className="form-label">Organization ID (Optional)</label>
              <input
                type="text"
                value={formData.org_id}
                onChange={(e) => setFormData(prev => ({ ...prev, org_id: e.target.value }))}
                className="form-input"
                placeholder="org-..."
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: Only needed if you're using an organization-specific API key.
              </p>
            </div>

            <div>
              <label className="form-label">Monthly Usage Limit (Optional)</label>
              <input
                type="number"
                step="0.01"
                value={formData.usage_limit}
                onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value }))}
                className="form-input"
                placeholder="100.00"
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-2">
                Set a monthly spending limit in USD to control costs.
              </p>
            </div>

            <div>
              <label className="form-label">OpenAI Model</label>
              <select
                value={formData.openai_model}
                onChange={(e) => setFormData(prev => ({ ...prev, openai_model: e.target.value }))}
                className="form-select"
                disabled={saving}
              >
                {OPENAI_MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the OpenAI model to use with this API key.
              </p>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={saving}
          >
            {saving ? 'Please wait...' : 'Cancel'}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving || !formData.key_name || !formData.api_key}
            className="btn-primary"
          >
            {saving ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Adding...
              </div>
            ) : (
              'Add API Key'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AgencyOpenAIManager