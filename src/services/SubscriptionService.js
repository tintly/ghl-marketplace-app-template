export class SubscriptionService {
  constructor(authService = null) {
    this.authService = authService
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutes
  }

  // Get subscription plan for a location
  async getLocationSubscription(locationId) {
    const cacheKey = `subscription-${locationId}`
    
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
        .rpc('get_location_subscription_plan', {
          p_location_id: locationId
        })

      if (error) {
        console.error('Error fetching subscription plan:', error)
        return this.getDefaultPlan()
      }

      const plan = data || this.getDefaultPlan()
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: plan,
        timestamp: Date.now()
      })

      return plan
    } catch (error) {
      console.error('Subscription service error:', error)
      return this.getDefaultPlan()
    }
  }

  // Get default free plan
  getDefaultPlan() {
    return {
      plan_id: null,
      plan_name: 'Free',
      plan_code: 'free',
      max_users: 1,
      messages_included: 100,
      overage_price: 0.08,
      can_use_own_openai_key: false,
      can_white_label: false,
      is_active: true,
      payment_status: 'free'
    }
  }

  // Check if a location has reached its message limit
  async checkMessageLimit(locationId) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { data, error } = await supabase
        .rpc('check_location_message_limit', {
          p_location_id: locationId
        })

      if (error) {
        console.error('Error checking message limit:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error checking message limit:', error)
      throw error
    }
  }

  // Increment message usage for a location
  async incrementMessageUsage(locationId, messagesCount = 1, tokensUsed = 0, costEstimate = 0) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { data, error } = await supabase
        .rpc('increment_location_message_usage', {
          p_location_id: locationId,
          p_messages_count: messagesCount,
          p_tokens_used: tokensUsed,
          p_cost_estimate: costEstimate
        })

      if (error) {
        console.error('Error incrementing message usage:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error incrementing message usage:', error)
      throw error
    }
  }

  // Get usage statistics for a location
  async getUsageStatistics(locationId, timeframe = 'current_month') {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      let query = supabase
        .from('usage_tracking')
        .select('*')
        .eq('location_id', locationId)
      
      // Filter by timeframe
      if (timeframe === 'current_month') {
        const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
        query = query.eq('month_year', currentMonth)
      } else if (timeframe === 'last_3_months') {
        // Get last 3 months
        const now = new Date()
        const months = []
        for (let i = 0; i < 3; i++) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
          months.push(month.toISOString().substring(0, 7))
        }
        query = query.in('month_year', months)
      }

      const { data, error } = await query.order('month_year', { ascending: false })

      if (error) {
        console.error('Error fetching usage statistics:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error fetching usage statistics:', error)
      throw error
    }
  }

  // Update subscription for a location
  async updateSubscription(locationId, planCode) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      // First get the plan ID
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('code', planCode)
        .eq('is_active', true)
        .single()

      if (planError || !planData) {
        console.error('Error fetching plan:', planError)
        throw new Error('Invalid plan code')
      }

      // Update or insert subscription
      const { data, error } = await supabase
        .from('location_subscriptions')
        .upsert({
          location_id: locationId,
          plan_id: planData.id,
          start_date: new Date().toISOString(),
          is_active: true,
          payment_status: 'active',
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error updating subscription:', error)
        throw error
      }

      // Clear cache
      this.clearCacheForLocation(locationId)

      return { success: true, data }
    } catch (error) {
      console.error('Error updating subscription:', error)
      return { success: false, error: error.message }
    }
  }

  // Get all available subscription plans
  async getAvailablePlans() {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true })

      if (error) {
        console.error('Error fetching plans:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error fetching plans:', error)
      throw error
    }
  }

  // Clear cache for a specific location
  clearCacheForLocation(locationId) {
    const cacheKey = `subscription-${locationId}`
    this.cache.delete(cacheKey)
  }

  // Clear all cache
  clearCache() {
    this.cache.clear()
  }
}