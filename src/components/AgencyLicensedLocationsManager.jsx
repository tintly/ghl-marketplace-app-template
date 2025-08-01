import React, { useState, useEffect } from 'react'

function AgencyLicensedLocationsManager({ user, authService }) {
  const [licensedLocations, setLicensedLocations] = useState([])
  const [agencyPermissions, setAgencyPermissions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLocationId, setNewLocationId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.type === 'agency' && user?.companyId) {
      loadLicensedLocations()
    }
  }, [user])

  const loadLicensedLocations = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('Loading licensed locations for agency:', user.companyId)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/manage-licensed-locations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          agency_ghl_id: user.companyId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load licensed locations')
      }

      const data = await response.json()
      setLicensedLocations(data.licensed_locations || [])
      setAgencyPermissions(data.agency_permissions)

      console.log('Loaded licensed locations:', {
        count: data.licensed_locations?.length || 0,
        tier: data.agency_tier,
        maxLocations: data.max_locations
      })

    } catch (err) {
      console.error('Error loading licensed locations:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddLocation = async (e) => {
    e.preventDefault()
    
    if (!newLocationId.trim()) {
      setError('Location ID is required')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/manage-licensed-locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          agency_ghl_id: user.companyId,
          location_ghl_id: newLocationId.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add licensed location')
      }

      const data = await response.json()
      console.log('Added licensed location:', data)

      // Refresh the list
      await loadLicensedLocations()
      
      // Reset form
      setNewLocationId('')
      setShowAddForm(false)

    } catch (err) {
      console.error('Error adding licensed location:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (licenseId, currentStatus) => {
    try {
      setSaving(true)
      setError(null)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/manage-licensed-locations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          id: licenseId,
          agency_ghl_id: user.companyId,
          is_active: !currentStatus
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update licensed location')
      }

      // Refresh the list
      await loadLicensedLocations()

    } catch (err) {
      console.error('Error updating licensed location:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLocation = async (licenseId) => {
    if (!window.confirm('Are you sure you want to remove this licensed location? This will immediately block access for that location.')) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/manage-licensed-locations`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          id: licenseId,
          agency_ghl_id: user.companyId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete licensed location')
      }

      // Refresh the list
      await loadLicensedLocations()

    } catch (err) {
      console.error('Error deleting licensed location:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Check if user has permission to manage licensed locations
  if (user?.type !== 'agency') {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Agency Feature</h3>
        <p className="text-gray-600">
          Licensed location management is only available for agency accounts.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-gray-600">Loading licensed locations...</span>
      </div>
    )
  }

  const currentCount = licensedLocations.length
  const maxLocations = agencyPermissions?.max_locations || 3
  const agencyTier = agencyPermissions?.agency_tier || 'Tier 1'
  const canAddMore = agencyTier === 'Tier 3' || currentCount < maxLocations

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Licensed Locations</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage which locations can access your agency's data extraction service.
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary"
              disabled={!canAddMore || saving}
            >
              Add Location
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

          {/* Agency Tier Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-blue-900">{agencyTier}</h3>
                <p className="text-sm text-blue-700">
                  {currentCount} of {agencyTier === 'Tier 3' ? 'unlimited' : maxLocations} locations licensed
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-900">{currentCount}</div>
                <div className="text-xs text-blue-600">Licensed</div>
              </div>
            </div>
            
            {agencyTier === 'Tier 3' && currentCount > 10 && (
              <div className="mt-2 text-xs text-blue-700">
                Additional locations beyond 10 are billed at $10/location/month
              </div>
            )}
          </div>

          {/* Licensed Locations List */}
          <LicensedLocationsList
            locations={licensedLocations}
            onToggleActive={handleToggleActive}
            onDelete={handleDeleteLocation}
            saving={saving}
          />
        </div>
      </div>

      {/* Add Location Modal */}
      {showAddForm && (
        <AddLocationForm
          newLocationId={newLocationId}
          setNewLocationId={setNewLocationId}
          onSubmit={handleAddLocation}
          onCancel={() => {
            setShowAddForm(false)
            setNewLocationId('')
            setError(null)
          }}
          saving={saving}
          canAddMore={canAddMore}
          currentCount={currentCount}
          maxLocations={maxLocations}
          agencyTier={agencyTier}
        />
      )}
    </div>
  )
}

function LicensedLocationsList({ locations, onToggleActive, onDelete, saving }) {
  if (locations.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 3h10M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4M9 7h6m-6 4h6m-6 4h6" />
        </svg>
        <p className="text-gray-600 font-medium">No licensed locations</p>
        <p className="text-sm text-gray-500 mt-1">Add your first licensed location to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-4">
        You have {locations.length} licensed location{locations.length !== 1 ? 's' : ''}.
      </p>
      
      {locations.map((location) => (
        <div key={location.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="font-medium text-gray-900">
                  {location.ghl_configurations?.business_name || 'Unknown Business'}
                </h3>
                <span className={`field-badge ${
                  location.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {location.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Location ID:</span> {location.location_ghl_id}</p>
                {location.ghl_configurations?.business_email && (
                  <p><span className="font-medium">Email:</span> {location.ghl_configurations.business_email}</p>
                )}
                <p><span className="font-medium">Licensed:</span> {new Date(location.licensed_at).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="ml-4 flex space-x-2">
              <button
                onClick={() => onToggleActive(location.id, location.is_active)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  location.is_active
                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                }`}
                disabled={saving}
                title={location.is_active ? 'Deactivate location' : 'Activate location'}
              >
                {location.is_active ? 'Deactivate' : 'Activate'}
              </button>
              
              <button
                onClick={() => onDelete(location.id)}
                className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50"
                disabled={saving}
                title="Remove licensed location"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

function AddLocationForm({ 
  newLocationId, 
  setNewLocationId, 
  onSubmit, 
  onCancel, 
  saving, 
  canAddMore, 
  currentCount, 
  maxLocations, 
  agencyTier 
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-2xl">
        <div className="modal-header">
          <h3 className="text-lg font-medium text-gray-900">Add Licensed Location</h3>
          <p className="text-sm text-gray-600 mt-1">
            Add a new location to your agency's licensed locations list.
          </p>
        </div>

        <div className="modal-body">
          {!canAddMore && (
            <div className="error-card mb-4">
              <h4 className="text-red-800 font-medium">License Limit Reached</h4>
              <p className="text-sm text-red-600 mt-1">
                Your {agencyTier} plan allows up to {maxLocations} licensed locations. 
                You currently have {currentCount} locations licensed.
              </p>
              {agencyTier !== 'Tier 3' && (
                <p className="text-sm text-red-600 mt-1">
                  Upgrade to a higher tier to license more locations.
                </p>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="form-label">
                GoHighLevel Location ID *
              </label>
              <input
                type="text"
                value={newLocationId}
                onChange={(e) => setNewLocationId(e.target.value)}
                className="form-input"
                placeholder="Enter the GHL location ID..."
                required
                disabled={saving || !canAddMore}
              />
              <p className="text-xs text-gray-500 mt-1">
                This is the location ID from GoHighLevel that you want to license for data extraction access.
              </p>
            </div>

            <div className="info-card">
              <h4 className="text-blue-800 font-medium mb-2">What happens when you add a location?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• The location will be able to access your agency's data extraction service</li>
                <li>• Usage will be tracked and billed according to your agency tier</li>
                <li>• You can deactivate access at any time</li>
                <li>• The location will use your agency's OpenAI API keys</li>
              </ul>
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
            onClick={onSubmit}
            disabled={saving || !canAddMore || !newLocationId.trim()}
            className="btn-primary"
          >
            {saving ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Adding...
              </div>
            ) : (
              'Add Location'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AgencyLicensedLocationsManager