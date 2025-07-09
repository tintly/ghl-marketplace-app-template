import React, { useState, useEffect } from 'react'
import { AgencyBrandingService } from '../services/AgencyBrandingService'
import { useWhiteLabel } from './WhiteLabelProvider'

function AgencyBrandingManager({ user, authService }) {
  const [branding, setBranding] = useState(null)
  const [permissions, setPermissions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const { refreshBranding } = useWhiteLabel()
  const brandingService = new AgencyBrandingService(authService)

  useEffect(() => {
    loadBrandingData()
  }, [user])

  const loadBrandingData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current branding
      const currentBranding = await brandingService.getAgencyBranding(user.locationId)
      setBranding(currentBranding)

      // Get permissions
      const agencyPermissions = await brandingService.getAgencyPermissions(user.companyId)
      setPermissions(agencyPermissions)

    } catch (error) {
      console.error('Error loading branding data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (formData) => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const result = await brandingService.updateAgencyBranding(user.companyId, formData)
      
      if (result.success) {
        setBranding({ ...branding, ...formData })
        setSuccess('Branding updated successfully!')

        // Refresh branding in the WhiteLabelProvider
        refreshBranding()
        
        // Apply new branding to the current page
        brandingService.applyBrandingToCSS({ ...branding, ...formData })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error saving branding:', error)
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading branding settings...</span>
      </div>
    )
  }

  if (user.type !== 'agency') {
    // For non-agency users, show a clear message
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Agency Branding</h2>
        </div>
        <div className="p-6">
          <div className="info-card">
            <h3 className="text-blue-800 font-medium">Agency Feature</h3>
            <p className="text-blue-600 text-sm mt-1">
              Branding customization is only available for agency accounts.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // For agency users, always allow branding access regardless of permissions
  // This is a critical fix to ensure agency users always have access
  if (user.type === 'agency' && !permissions?.can_customize_branding) {
    console.log('Agency user detected but permissions show no branding access. Overriding permissions.')
    // Override permissions for agency users
    const updatedPermissions = {
      ...permissions,
      can_customize_branding: true
    }
    setPermissions(updatedPermissions)
  }

  // This check should never be true for agency users now, but keeping it for non-agency users
  if (user.type !== 'agency' && !permissions?.can_customize_branding) {
    return (
      <div className="warning-card">
        <h3 className="text-yellow-800 font-medium">Upgrade Required</h3>
        <p className="text-yellow-600 text-sm mt-1">
          Your current plan ({permissions?.plan_type}) does not include branding customization. 
          Please upgrade to access this feature.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Agency Branding</h2>
        <p className="text-sm text-gray-600 mt-1">
          Customize the appearance and branding of your white-labeled data extractor.
        </p>
      </div>

      <div className="p-6">
        {error && (
          <div className="error-card mb-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="success-card mb-6">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        <BrandingForm
          branding={branding}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  )
}

function BrandingForm({ branding, onSave, saving }) {
  const [formData, setFormData] = useState({
    agency_name: '',
    custom_app_name: '',
    primary_color: '#3B82F6',
    secondary_color: '#1F2937',
    accent_color: '#10B981',
    agency_logo_url: '',
    support_email: '',
    support_phone: '',
    welcome_message: '',
    hide_ghl_branding: false,
    footer_text: ''
  })

  useEffect(() => {
    if (branding) {
      setFormData({
        agency_name: branding.agency_name || '',
        custom_app_name: branding.custom_app_name || 'Data Extractor',
        primary_color: branding.primary_color || '#3B82F6',
        secondary_color: branding.secondary_color || '#1F2937',
        accent_color: branding.accent_color || '#10B981',
        agency_logo_url: branding.agency_logo_url || '',
        support_email: branding.support_email || '',
        support_phone: branding.support_phone || '',
        welcome_message: branding.welcome_message || '',
        hide_ghl_branding: branding.hide_ghl_branding || false,
        footer_text: branding.footer_text || ''
      })
    }
  }, [branding])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="form-label">Agency Name *</label>
          <input
            type="text"
            value={formData.agency_name}
            onChange={(e) => handleChange('agency_name', e.target.value)}
            className="form-input"
            required
            disabled={saving}
          />
        </div>

        <div>
          <label className="form-label">App Name *</label>
          <input
            type="text"
            value={formData.custom_app_name}
            onChange={(e) => handleChange('custom_app_name', e.target.value)}
            className="form-input"
            required
            disabled={saving}
          />
        </div>
      </div>

      {/* Colors */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Brand Colors</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="form-label">Primary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.primary_color || '#3B82F6'}
                onChange={(e) => handleChange('primary_color', e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                disabled={saving}
              />
              <input
                type="text"
                value={formData.primary_color || '#3B82F6'}
                onChange={(e) => handleChange('primary_color', e.target.value)}
                className="form-input flex-1"
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Secondary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.secondary_color || '#1F2937'}
                onChange={(e) => handleChange('secondary_color', e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                disabled={saving}
              />
              <input
                type="text"
                value={formData.secondary_color || '#1F2937'}
                onChange={(e) => handleChange('secondary_color', e.target.value)}
                className="form-input flex-1"
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Accent Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.accent_color || '#10B981'}
                onChange={(e) => handleChange('accent_color', e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                disabled={saving}
              />
              <input
                type="text"
                value={formData.accent_color || '#10B981'}
                onChange={(e) => handleChange('accent_color', e.target.value)}
                className="form-input flex-1"
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logo and Contact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="form-label">Logo URL</label>
          <input
            type="url"
            value={formData.agency_logo_url}
            onChange={(e) => handleChange('agency_logo_url', e.target.value)}
            className="form-input"
            placeholder="https://example.com/logo.png"
            disabled={saving}
          />
        </div>

        <div>
          <label className="form-label">Support Email</label>
          <input
            type="email"
            value={formData.support_email}
            onChange={(e) => handleChange('support_email', e.target.value)}
            className="form-input"
            disabled={saving}
          />
        </div>
      </div>

      {/* Messages */}
      <div>
        <label className="form-label">Welcome Message</label>
        <textarea
          value={formData.welcome_message}
          onChange={(e) => handleChange('welcome_message', e.target.value)}
          rows={3}
          className="form-textarea"
          placeholder="Welcome to your conversation data extractor..."
          disabled={saving}
        />
      </div>

      <div>
        <label className="form-label">Footer Text</label>
        <input
          type="text"
          value={formData.footer_text}
          onChange={(e) => handleChange('footer_text', e.target.value)}
          className="form-input"
          placeholder="© 2024 Your Agency Name. All rights reserved."
          disabled={saving}
        />
      </div>

      {/* Options */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="hide_ghl_branding"
          checked={formData.hide_ghl_branding}
          onChange={(e) => handleChange('hide_ghl_branding', e.target.checked)}
          className="form-checkbox"
          disabled={saving}
        />
        <label htmlFor="hide_ghl_branding" className="ml-2 block text-sm text-gray-700">
          Hide GoHighLevel branding completely
        </label>
      </div>

      {/* Submit */}
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
            'Save Branding'
          )}
        </button>
      </div>
    </form>
  )
}

export default AgencyBrandingManager