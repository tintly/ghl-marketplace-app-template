export class AgencyBrandingService {
  constructor(authService = null) {
    this.authService = authService
    this.cache = new Map()
    this.cacheTimeout = 10 * 60 * 1000 // 10 minutes
  }

  // Get agency branding for current user's location
  async getAgencyBranding(locationId) {
    const cacheKey = `branding-${locationId}`
    console.log('Getting agency branding for location:', locationId)
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('Returning cached branding data')
        return cached.data
      }
      this.cache.delete(cacheKey)
    }

    try {
      // Check if user is agency type
      const isAgency = this.authService?.getCurrentUser()?.type === 'agency';
      
      // For agency users, try to get branding directly by company ID first
      if (isAgency && this.authService?.getCurrentUser()?.companyId) {
        const companyId = this.authService.getCurrentUser().companyId;
        console.log('User is agency type, trying to get branding directly by company ID:', companyId);
        
        let supabase
        try {
          if (this.authService?.getSupabaseClient) {
            supabase = await this.authService.getSupabaseClient()
          } else {
            const { supabase: defaultClient } = await import('./supabase')
            supabase = defaultClient
          }
        } catch (error) {
          console.error('Error getting Supabase client:', error)
          throw new Error('Database connection error: ' + error.message)
        }
        
        const { data: directBranding, error: directError } = await supabase
          .from('agency_branding')
          .select('*')
          .eq('agency_ghl_id', companyId)
          .maybeSingle();
          
        if (!directError && directBranding) {
          console.log('Found branding directly by company ID:', directBranding);
          
          // Cache the result
          this.cache.set(cacheKey, {
            data: directBranding,
            timestamp: Date.now()
          });
          
          return directBranding;
        }
      }

      let supabase
      try {
        if (this.authService?.getSupabaseClient) {
          supabase = await this.authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

      // First try to get branding by location
      console.log('Fetching agency branding by location ID')
      const { data: locationConfig, error: locationError } = await supabase
        .from('ghl_configurations')
        .select('agency_ghl_id')
        .eq('ghl_account_id', locationId)
        .maybeSingle();

      if (locationError) {
        console.error('Error fetching location config:', locationError)
        return this.getDefaultBranding()
      }

      if (!locationConfig || !locationConfig.agency_ghl_id) {
        console.log('No agency ID found for location, returning default branding')
        return this.getDefaultBranding()
      }

      console.log('Found agency ID for location:', locationConfig.agency_ghl_id)
      
      // Now get the branding for this agency
      console.log('Fetching branding for agency')
      const { data, error } = await supabase
        .from('agency_branding')
        .select('*')
        .eq('agency_ghl_id', locationConfig.agency_ghl_id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching agency branding:', error)
        return this.getDefaultBranding()
      }

      const branding = data || this.getDefaultBranding()
      console.log('Fetched branding data:', branding)
      
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
      console.log('Updating agency branding for agency ID:', agencyId)
      let supabase
      try {
        if (this.authService?.getSupabaseClient) {
          supabase = await this.authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

      // First check if a record exists
      const { data: existingData, error: checkError } = await supabase
        .from('agency_branding')
        .select('id')
        .eq('agency_ghl_id', agencyId)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing branding:', checkError)
        throw new Error(`Failed to check existing branding: ${checkError.message}`)
      }

      let result;
      
      if (existingData) {
        // Update existing record
        console.log('Updating existing branding record with ID:', existingData.id)
        const { data, error } = await supabase
          .from('agency_branding')
          .update({
            ...brandingData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id)
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to update branding: ${error.message}`)
        }
        
        result = data
      } else {
        // Insert new record
        console.log('Creating new branding record for agency ID:', agencyId)
        const { data, error } = await supabase
          .from('agency_branding')
          .insert({
            agency_ghl_id: agencyId,
            ...brandingData,
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to create branding: ${error.message}`)
        }
        
        result = data
      }

      // Clear cache for this agency
      this.clearCacheForAgency(agencyId)

      return { success: true, data: result }
    } catch (error) {
      console.error('Error updating agency branding:', error)
      return { success: false, error: error.message }
    }
  }

  // Get agency permissions
  async getAgencyPermissions(agencyId) {
    try {
      let supabase
      try {
        if (this.authService?.getSupabaseClient) {
          supabase = await this.authService.getSupabaseClient()
        } else {
          const { supabase: defaultClient } = await import('./supabase')
          supabase = defaultClient
        }
      } catch (error) {
        console.error('Error getting Supabase client:', error)
        throw new Error('Database connection error: ' + error.message)
      }

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