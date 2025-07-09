import React, { useState, useEffect } from 'react';
import { AgencyBrandingService } from '../services/AgencyBrandingService.js';

const AgencyBrandingManager = ({ user, authService, onBrandingUpdate }) => {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const brandingService = new AgencyBrandingService(authService);
  const agencyId = user?.companyId;

  useEffect(() => {
    loadBranding();
  }, [agencyId]);

  const loadBranding = async () => {
    if (!agencyId) {
      console.log('No agency ID provided to AgencyBrandingManager');
      
      // For agency users without company ID, use location ID as fallback
      if (user?.type === 'agency' && user?.locationId) {
        console.log('Using location ID as fallback for agency ID:', user.locationId);
        const brandingData = await brandingService.getAgencyBranding(user.locationId);
        console.log('Branding data loaded using location ID:', brandingData);
        setBranding(brandingData);
        setLoading(false);
        return;
      }
      
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading branding for agency ID:', agencyId);
      const brandingData = await brandingService.getAgencyBranding(agencyId);
      console.log('Branding data loaded:', brandingData);
      setBranding(brandingData);
    } catch (err) {
      setError('Failed to load branding settings');
      console.error('Error loading branding:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData) => {
    setSaving(true);
    setError(null);

    // Use agency ID or location ID as fallback
    const targetId = agencyId || user?.locationId;
    
    if (!targetId) {
      setError('No agency ID available for saving branding');
      setSaving(false);
      return;
    }
    
    try {
      const result = await brandingService.updateAgencyBranding(targetId, formData);
      
      if (result?.success === false) {
        throw new Error(result.error || 'Failed to save branding');
      }
      
      setBranding({ ...branding, ...formData });
      onBrandingUpdate?.(formData);
    } catch (err) {
      setError(err.message || 'Failed to save branding settings');
      console.error('Error saving branding:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setBranding(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading branding settings...</span>
      </div>
    );
  }

  if (!branding) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-800">Failed to load branding settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Agency Branding</h3>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={(e) => {
          e.preventDefault();
          handleSave(branding);
        }} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agency Name
            </label>
            <input
              type="text"
              value={branding.agency_name || ''}
              onChange={(e) => handleInputChange('agency_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter agency name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom App Name
            </label>
            <input
              type="text"
              value={branding.custom_app_name || ''}
              onChange={(e) => handleInputChange('custom_app_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Data Extractor"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Color
              </label>
              <input
                type="color"
                value={branding.primary_color || '#3B82F6'}
                onChange={(e) => handleInputChange('primary_color', e.target.value)}
                className="w-full h-10 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secondary Color
              </label>
              <input
                type="color"
                value={branding.secondary_color || '#1F2937'}
                onChange={(e) => handleInputChange('secondary_color', e.target.value)}
                className="w-full h-10 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accent Color
              </label>
              <input
                type="color"
                value={branding.accent_color || '#10B981'}
                onChange={(e) => handleInputChange('accent_color', e.target.value)}
                className="w-full h-10 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agency Logo URL
            </label>
            <input
              type="url"
              value={branding.agency_logo_url || ''}
              onChange={(e) => handleInputChange('agency_logo_url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Welcome Message
            </label>
            <textarea
              value={branding.welcome_message || ''}
              onChange={(e) => handleInputChange('welcome_message', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Welcome to your conversation data extractor."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Support Email
            </label>
            <input
              type="email"
              value={branding.support_email || ''}
              onChange={(e) => handleInputChange('support_email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="support@youragency.com"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="hide_ghl_branding"
              checked={branding.hide_ghl_branding || false}
              onChange={(e) => handleInputChange('hide_ghl_branding', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="hide_ghl_branding" className="ml-2 block text-sm text-gray-900">
              Hide GoHighLevel Branding
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgencyBrandingManager;