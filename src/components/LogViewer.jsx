import React, { useState } from 'react'

function LogViewer() {
  const [contactId, setContactId] = useState('3eEkzpdKeXk19ndqBHNd')
  const [conversationId, setConversationId] = useState('')
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchLogs = async () => {
    if (!contactId && !conversationId) {
      setError('Please enter either a Contact ID or Conversation ID')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/view-extraction-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          contact_id: contactId || undefined,
          conversation_id: conversationId || undefined,
          limit: 20
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch logs')
      }

      const data = await response.json()
      setLogs(data)
    } catch (error) {
      console.error('Error fetching logs:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleString()
  }

  const formatCost = (cost) => {
    if (cost === null || cost === undefined) return 'N/A'
    return `$${parseFloat(cost).toFixed(6)}`
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Extraction Log Viewer</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
      </div>
      
      <div className="mb-6">
        <button
          onClick={fetchLogs}
          disabled={loading}
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
                    <tr>
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
                            <span className="field-badge bg-yellow-100 text-yellow-800">Pending</span>
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
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
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
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {formatCost(log.cost_estimate)}
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
  )
}

export default LogViewer