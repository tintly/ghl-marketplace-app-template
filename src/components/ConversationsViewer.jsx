import React, { useState, useEffect } from 'react'

function ConversationsViewer({ user, authService }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    messageType: 'all',
    direction: 'all',
    processed: 'all',
    dateRange: '7d'
  })
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    unprocessed: 0,
    byType: {}
  })

  useEffect(() => {
    loadConversations()
  }, [user, filters])

  const loadConversations = async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase

      // Build query with filters
      let query = supabase
        .from('ghl_conversations')
        .select('*')
        .eq('location_id', user.locationId)
        .order('date_added', { ascending: false })
        .limit(100)

      // Apply filters
      if (filters.messageType !== 'all') {
        query = query.eq('message_type', filters.messageType)
      }

      if (filters.direction !== 'all') {
        query = query.eq('direction', filters.direction)
      }

      if (filters.processed !== 'all') {
        query = query.eq('processed', filters.processed === 'true')
      }

      // Apply date range filter
      if (filters.dateRange !== 'all') {
        const days = parseInt(filters.dateRange.replace('d', ''))
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        query = query.gte('date_added', cutoffDate.toISOString())
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`Failed to load conversations: ${error.message}`)
      }

      setConversations(data || [])
      
      // Calculate stats
      await loadStats()

    } catch (error) {
      console.error('Error loading conversations:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase

      // Get basic stats
      const { data: statsData, error: statsError } = await supabase
        .from('ghl_conversations')
        .select('processed, message_type')
        .eq('location_id', user.locationId)

      if (statsError) {
        console.error('Error loading stats:', statsError)
        return
      }

      const total = statsData.length
      const processed = statsData.filter(item => item.processed).length
      const unprocessed = total - processed

      // Group by message type
      const byType = statsData.reduce((acc, item) => {
        acc[item.message_type] = (acc[item.message_type] || 0) + 1
        return acc
      }, {})

      setStats({
        total,
        processed,
        unprocessed,
        byType
      })

    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const getMessageTypeIcon = (messageType) => {
    const icons = {
      'SMS': '💬',
      'CALL': '📞',
      'Email': '📧',
      'WhatsApp': '💚',
      'Facebook': '📘',
      'Instagram': '📷'
    }
    return icons[messageType] || '📝'
  }

  const getDirectionIcon = (direction) => {
    return direction === 'inbound' ? '📥' : '📤'
  }

  const getStatusColor = (processed) => {
    return processed ? 'text-green-600' : 'text-orange-600'
  }

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading conversations...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error Loading Conversations</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={loadConversations}
          className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Conversation Messages</h2>
        <p className="text-sm text-gray-600 mt-1">
          View and monitor incoming messages from GoHighLevel webhooks.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-blue-800">Total Messages</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
            <div className="text-sm text-green-800">Processed</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.unprocessed}</div>
            <div className="text-sm text-orange-800">Pending</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">
              {Object.keys(stats.byType).length}
            </div>
            <div className="text-sm text-purple-800">Message Types</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message Type
            </label>
            <select
              value={filters.messageType}
              onChange={(e) => handleFilterChange('messageType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="SMS">SMS</option>
              <option value="CALL">Calls</option>
              <option value="Email">Email</option>
              <option value="WhatsApp">WhatsApp</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Direction
            </label>
            <select
              value={filters.direction}
              onChange={(e) => handleFilterChange('direction', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Directions</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Processing Status
            </label>
            <select
              value={filters.processed}
              onChange={(e) => handleFilterChange('processed', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="true">Processed</option>
              <option value="false">Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="p-6">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.697-.413l-3.178 1.059a1 1 0 01-1.272-1.272l1.059-3.178A8.955 8.955 0 013 12a8 8 0 018-8 8 8 0 018 8z" />
            </svg>
            <p>No conversations found</p>
            <p className="text-sm mt-1">Messages will appear here when webhooks are received from GoHighLevel.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">
                        {getMessageTypeIcon(conversation.message_type)}
                      </span>
                      <span className="text-lg">
                        {getDirectionIcon(conversation.direction)}
                      </span>
                      <span className="font-medium text-gray-900">
                        {conversation.message_type} - {conversation.direction}
                      </span>
                      <span className={`text-sm ${getStatusColor(conversation.processed)}`}>
                        {conversation.processed ? '✅ Processed' : '⏳ Pending'}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Date:</strong> {formatDate(conversation.date_added)}</p>
                      <p><strong>Conversation ID:</strong> {conversation.conversation_id}</p>
                      {conversation.contact_id && (
                        <p><strong>Contact ID:</strong> {conversation.contact_id}</p>
                      )}
                      {conversation.status && (
                        <p><strong>Status:</strong> {conversation.status}</p>
                      )}
                      {conversation.call_duration && (
                        <p><strong>Call Duration:</strong> {conversation.call_duration} seconds</p>
                      )}
                      {conversation.email_subject && (
                        <p><strong>Subject:</strong> {conversation.email_subject}</p>
                      )}
                    </div>
                    
                    {conversation.body && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-800">
                          {conversation.body.length > 200 
                            ? `${conversation.body.substring(0, 200)}...` 
                            : conversation.body
                          }
                        </p>
                      </div>
                    )}
                    
                    {conversation.attachments && conversation.attachments.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700">Attachments:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {conversation.attachments.map((attachment, index) => (
                            <a
                              key={index}
                              href={attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                            >
                              📎 Attachment {index + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4 text-xs text-gray-500">
                    <p>Received: {formatDate(conversation.webhook_received_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ConversationsViewer