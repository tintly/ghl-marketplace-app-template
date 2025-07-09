import React, { useState, useEffect } from 'react'
import { AgencyOpenAIService } from '../services/AgencyOpenAIService'

function AgencyOpenAIManager({ user, authService }) {
  const [keys, setKeys] = useState([])
  const [permissions, setPermissions] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const openaiService = new AgencyOpenAIService(authService)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check permissions
      // For agency users, we'll check both methods
      const isAgency = user.type === 'agency'
      
      // For agency users, always allow access regardless of database permissions
      let canUse = isAgency
      let isAgencyPlan = isAgency
      
      // Only check database permissions for non-agency users
      if (!isAgency) {
        canUse = await openaiService.canUseCustomOpenAIKey(user.companyId)
        isAgencyPlan = await openaiService.isAgencyPlan()
      }
      
      setPermissions({ 
        can_use_own_openai_key: canUse,
        is_agency_plan: isAgencyPlan
      })
      
      // Only require upgrade if not agency type and can't use keys
      setUpgradeRequired(!isAgency && !canUse)

      if (canUse) {
        // Load keys
        const keysResult = await openaiService.getAgencyOpenAIKeys(user.companyId)
        if (keysResult.success) {
          setKeys(keysResult.data)
        }

        // Load usage statistics
        const usageResult = await openaiService.getUsageStatistics(user.companyId, '30d')
        if (usageResult.success) {
          setUsage(usageResult.data)
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
      const result = await openaiService.addOpenAIKey(user.companyId, keyData)
      
      if (result.success) {
        setKeys(prev => [result.data, ...prev])
        setShowAddForm(false)
        await loadData() // Refresh usage data
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error adding OpenAI key:', error)
      setError(error.message)
    }
  }

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to delete this OpenAI key?')) {
      return
    }

    try {
      const result = await openaiService.deleteOpenAIKey(keyId, user.companyId)
      
      if (result.success) {
        setKeys(prev => prev.filter(key => key.id !== keyId))
      } else {
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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading OpenAI settings...</span>
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
          <div className="info-card">
            <h3 className="text-blue-800 font-medium">Agency Feature</h3>
            <p className="text-blue-600 text-sm mt-1">
              Custom OpenAI key management is only available for agency accounts.
            </p>
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">OpenAI API Keys</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your agency's OpenAI API keys for AI-powered data extraction.
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary"
            >
              Add API Key
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="error-card mb-6">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* API Keys List */}
          <OpenAIKeysList
            keys={keys}
            onDelete={handleDeleteKey}
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
          onSubmit={handleAddKey}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}

function OpenAIKeysList({ keys, onDelete }) {
  if (keys.length === 0) {
    return (
      <div className="text-center py-8">
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
      {keys.map((key) => (
        <div key={key.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="font-medium text-gray-900">{key.key_name}</h3>
                <span className={`field-badge ${key.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {key.is_active ? 'Active' : 'Inactive'}
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
                onClick={() => onDelete(key.id)}
                className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50"
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
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Usage Statistics (Last 30 Days)</h3>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{usage.total_requests}</div>
            <div className="text-sm text-gray-600">Total Requests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{usage.total_tokens.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Tokens</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">${usage.total_cost.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Total Cost</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{Object.keys(usage.by_model).length}</div>
            <div className="text-sm text-gray-600">Models Used</div>
          </div>
        </div>

        {/* Usage by Model */}
        {Object.keys(usage.by_model).length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Usage by Model</h4>
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
      </div>
    </div>
  )
}

function AddOpenAIKeyForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    key_name: '',
    api_key: '',
    org_id: '',
    usage_limit: ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      await onSubmit({
        key_name: formData.key_name,
        api_key: formData.api_key,
        org_id: formData.org_id || null,
        usage_limit: formData.usage_limit ? parseFloat(formData.usage_limit) : null
      })
    } finally {
      setSaving(false)
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
              <p className="text-xs text-gray-500 mt-1">
                Set a monthly spending limit in USD to control costs.
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
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving || !formData.key_name || !formData.api_key}
            className="btn-primary"
          >
            {saving ? 'Adding...' : 'Add API Key'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AgencyOpenAIManager