import React, { useState, useEffect } from 'react'

function LogViewer() {
  const [contactId, setContactId] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(null)
  const [error, setError] = useState(null)
  const [recentContacts, setRecentContacts] = useState([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsError, setContactsError] = useState(null)

  const [fetchingRecent, setFetchingRecent] = useState(false)
  
  const fetchRecentLogs = () => {
    setFetchingRecent(true)
    setContactId('')
    setConversationId('')
    fetchLogs()
    setFetchingRecent(false)
  }

  // Auto-refresh logs when enabled
  useEffect(() => {
    if (refreshInterval) {
      const timer = setInterval(() => {
        console.log('Auto-refreshing logs...')
        fetchLogs(true) // Pass true to indicate this is an auto-refresh
      }, refreshInterval * 1000)
      
      return () => clearInterval(timer)
    }
  }, [refreshInterval, contactId, conversationId])
  
  useEffect(() => {
    // Make recent contacts loading optional and non-blocking
    fetchRecentContacts()
  }, [])

  const fetchRecentContacts = async () => {
    try {
      setLoadingContacts(true)
      setContactsError(null)
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Supabase environment variables not configured')
        return
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/get-recent-contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ limit: 10 })
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch recent contacts: ${response.status}`)
      }

      const data = await response.json()
      setRecentContacts(data.contacts || [])
    } catch (error) {
      console.error('Error fetching recent contacts:', error)
      setContactsError(error.message)
      // Don't block the component - just show empty contacts
      setRecentContacts([])
    } finally {
      setLoadingContacts(false)
    }
  }

  const fetchLogs = async (isAutoRefresh = false) => {
    // Allow fetching recent logs without any ID
    if (!contactId && !conversationId && !fetchingRecent) {
      setError('Please enter either a Contact ID or Conversation ID, or use "View Recent Logs"')
      return
    }

    try {
      if (!isAutoRefresh) setLoading(true)
      setError(null)
      
      let queryParams = {
        limit: 50 // Increase limit to show more logs
      }
      
      if (contactId) {
        queryParams.contact_id = contactId
      }
      
      if (conversationId) {
        queryParams.conversation_id = conversationId
      }
      
      if (fetchingRecent) {
        queryParams.recent = true
        queryParams.limit = 20
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables not configured')
      }

     console.log('Fetching logs for:', {
       ...queryParams
     })

      const response = await fetch(`${supabaseUrl}/functions/v1/view-extraction-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify(queryParams)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch logs')
      }

      const data = await response.json()
      setLogs(data)
     
     // Check if we have usage logs but they're not showing up in the UI
     if (data.usage_logs.length === 0 && data.conversations.length > 0) {
       console.log('⚠️ Found conversations but no usage logs. This might indicate a tracking issue.')
     }
    } catch (error) {
      console.error('Error fetching logs:', error)
      setError(error.message)
    } finally {
      if (!isAutoRefresh) setLoading(false)
    }
  }

  const handleContactSelect = (contact) => {
    setContactId(contact.id)
    setConversationId('')
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleString()
  }

  const formatCost = (cost) => {
    if (cost === null || cost === undefined) return 'N/A'
    return `$${parseFloat(cost).toFixed(2)}`
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Extraction Log Viewer</h3>
        <p className="text-sm text-gray-600 mt-1">
          View message processing and AI extraction logs for contacts and conversations
        </p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="text-md font-medium text-gray-800 mb-3">Search by ID</h4>
            <div className="space-y-4">
              <div>
                <label className="form-label">Contact ID</label>
                <input
                  type="text"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="form-input"
                  placeholder="Enter Contact ID"
                />
              </div>
              <div>
                <label className="form-label">Conversation ID (optional)</label>
                <input
                  type="text"
                  value={conversationId}
                  onChange={(e) => setConversationId(e.target.value)}
                  className="form-input"
                  placeholder="Enter Conversation ID"
                />
              </div>
              <div>
                <button
                  onClick={fetchLogs}
                  disabled={loading}
                  className="btn-primary"
                  className="btn-primary"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Fetching Logs...
                    </>
                  ) : (
                    'View Logs'
                  )}
                </button>
                <button
                  onClick={fetchRecentLogs}
                  disabled={loading || fetchingRecent}
                  className="btn-secondary ml-2"
                  className="btn-secondary ml-2"
                >
                  View Recent Logs
                </button>
                
                {/* Auto-refresh controls */}
                <div className="mt-4 flex items-center">
                  <label className="text-sm text-gray-700 mr-2">Auto-refresh:</label>
                  <select
                    value={refreshInterval || ''}
                    onChange={(e) => setRefreshInterval(e.target.value ? parseInt(e.target.value) : null)}
                    className="form-select text-sm py-1 px-2 w-auto"
                  >
                    <option value="">Disabled</option>
                    <option value="5">Every 5 seconds</option>
                    <option value="10">Every 10 seconds</option>
                    <option value="30">Every 30 seconds</option>
                    <option value="60">Every minute</option>
                  </select>
                  {refreshInterval && (
                    <span className="ml-2 text-xs text-green-600">
                      Auto-refreshing every {refreshInterval} seconds
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-md font-medium text-gray-800 mb-3">Recent Contacts</h4>
            {loadingContacts ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">Loading contacts...</span>
              </div>
            ) : contactsError ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 text-sm">
                  <strong>Note:</strong> Could not load recent contacts: {contactsError}
                </p>
                <p className="text-yellow-700 text-xs mt-1">
                  You can still search by entering a Contact ID or Conversation ID manually.
                </p>
              </div>
            ) : recentContacts.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">No recent contacts found</p>
                <p className="text-gray-400 text-xs mt-1">
                  Enter a Contact ID manually to search for logs
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {recentContacts.map(contact => (
                  <div 
                    key={contact.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      contactId === contact.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => handleContactSelect(contact)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{contact.name || 'Unnamed Contact'}</p>
                        <p className="text-xs text-gray-500">ID: {contact.id}</p>
                        {contact.email && <p className="text-xs text-gray-600">{contact.email}</p>}
                        {contact.phone && <p className="text-xs text-gray-600">{contact.phone}</p>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTimestamp(contact.last_message)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {error && (
          <div className="error-card mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {logs && (
          <div className="space-y-6">
            {/* Conversations Section */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Conversations ({logs.conversations.length})
              </h4>
              
              {logs.conversations.length === 0 ? (
                <p className="text-gray-500 text-sm">No conversation records found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-left">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logs.conversations.map((conv) => (
                        <tr key={conv.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                            {formatTimestamp(conv.date_added)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <span className="field-badge bg-blue-100 text-blue-800">
                              {conv.message_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <span className={`field-badge ${conv.direction === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                              {conv.direction}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900">
                            {conv.body ? (
                              <div className="max-w-xs truncate">{conv.body}</div>
                            ) : (
                              <span className="text-gray-400">No message body</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            {conv.processed ? (
                              <span className="field-badge bg-green-100 text-green-800">Processed</span>
                            ) : (
                             <span className="field-badge bg-yellow-100 text-yellow-800">
                               {conv.processing_error ? 'Failed' : 'Pending'}
                             </span>
                            )}
                            {conv.processing_error && (
                              <div className="text-red-600 mt-1">Error: {conv.processing_error}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Usage Logs Section */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                AI Usage Logs ({logs.usage_logs.length})
              </h4>
              
              {logs.usage_logs.length === 0 ? (
                <p className="text-gray-500 text-sm">No AI usage logs found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-left">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message Cost</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logs.usage_logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                            {formatTimestamp(log.created_at)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <span className="field-badge bg-purple-100 text-purple-800">
                              {log.model}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <div>Input: {log.input_tokens}</div>
                            <div>Output: {log.output_tokens}</div>
                            <div className="font-medium">Total: {log.total_tokens}</div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-medium">
                            {formatCost(log.customer_cost_estimate || log.cost_estimate)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            {log.success ? (
                              <span className="field-badge bg-green-100 text-green-800">Success</span>
                            ) : (
                              <span className="field-badge bg-red-100 text-red-800">Failed</span>
                            )}
                            {log.error_message && (
                              <div className="text-red-600 mt-1">{log.error_message}</div>
                            )}
                            {log.response_time_ms && (
                              <div className="text-gray-500 mt-1">{log.response_time_ms}ms</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LogViewer