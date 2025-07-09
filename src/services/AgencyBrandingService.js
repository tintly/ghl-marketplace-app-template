export class AgencyBrandingService {
  constructor(authService = null) {
    this.authService = authService
    this.cache = new Map()
    this.cacheTimeout = 10 * 60 * 1000 // 10 minutes
  }

  // Get agency branding for current user's location
  async getAgencyBranding(locationId) {
    const cacheKey = `branding-${locationId}`
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }
      this.cache.delete(cacheKey)
    }

    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { data, error } = await supabase
        .rpc('get_agency_branding_for_location', {
          location_id: locationId
        })

      if (error) {
        console.error('Error fetching agency branding:', error)
        return this.getDefaultBranding()
      }

      const branding = data || this.getDefaultBranding()
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: branding,
        timestamp: Date.now()
      })

      return branding
    } catch (error) {
      console.error('Agency branding service error:', error)
      return this.getDefaultBranding()
    }
  }

  // Get default branding when no agency branding is available
  getDefaultBranding() {
    return {
      agency_name: 'GoHighLevel',
      custom_app_name: 'Data Extractor',
      primary_color: '#3B82F6',
      secondary_color: '#1F2937',
      accent_color: '#10B981',
      hide_ghl_branding: false,
      welcome_message: 'Welcome to your conversation data extractor.',
      support_email: 'support@gohighlevel.com'
    }
  }

  // Update agency branding (for agency users only)
  async updateAgencyBranding(agencyId, brandingData) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      // First check if a record exists
      const { data: existingData, error: checkError } = await supabase
        .from('agency_branding')
        .select('id')
        .eq('agency_ghl_id', agencyId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing branding:', checkError);
        throw new Error(`Failed to check existing branding: ${checkError.message}`);
      }

      let result;
      
      if (existingData) {
        // Update existing record
        const { data, error } = await supabase
          .from('agency_branding')
          .update({
            ...brandingData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to update branding: ${error.message}`);
        }
        
        result = data;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('agency_branding')
          .insert({
            agency_ghl_id: agencyId,
            ...brandingData,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create branding: ${error.message}`);
        }
        
        result = data;
      }

      // Clear cache for this agency
      this.clearCacheForAgency(agencyId)

      return { success: true, data: result };
    } catch (error) {
      console.error('Error updating agency branding:', error)
      return { success: false, error: error.message }
    }
  }

  // Get agency permissions
  async getAgencyPermissions(agencyId) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { data, error } = await supabase
        .rpc('get_agency_permissions', {
          agency_id: agencyId
        })

      if (error) {
        console.error('Error fetching agency permissions:', error)
        return this.getDefaultPermissions()
      }

      return data || this.getDefaultPermissions()
    } catch (error) {
      console.error('Agency permissions service error:', error)
      return this.getDefaultPermissions()
    }
  }

  // Get default permissions
  getDefaultPermissions() {
    return {
      plan_type: 'basic',
      max_locations: 10,
      max_extractions_per_month: 1000,
      can_use_own_openai_key: false,
      can_customize_branding: false,
      can_use_custom_domain: false,
      can_access_usage_analytics: false,
      can_manage_team_members: false
    }
  }

  // Apply branding to CSS variables
  applyBrandingToCSS(branding) {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    
    root.style.setProperty('--primary-color', branding.primary_color || '#3B82F6')
    root.style.setProperty('--secondary-color', branding.secondary_color || '#1F2937')
    root.style.setProperty('--accent-color', branding.accent_color || '#10B981')
    
    // Update page title if custom app name is provided
    if (branding.custom_app_name) {
      document.title = branding.custom_app_name
    }
  }

  // Clear cache for specific agency
  clearCacheForAgency(agencyId) {
    for (const [key] of this.cache) {
      if (key.includes(agencyId)) {
        this.cache.delete(key)
      }
    }
  }

  // Clear all cache
  clearCache() {
    this.cache.clear()
  }
}