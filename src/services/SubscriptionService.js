export class SubscriptionService {
  constructor(authService = null) {
    this.authService = authService
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutes
  }

  // Get current subscription for a location
  async getCurrentSubscription(locationId) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      // Try to use the RPC function first
      const { data: subscriptionData, error: rpcError } = await supabase
        .rpc('get_my_subscription_direct')

      if (!rpcError && subscriptionData) {
        return this.formatSubscriptionData(subscriptionData)
      }

      // Fallback to direct query if RPC fails
      const { data: locationSub, error: subError } = await supabase
        .from('location_subscriptions')
        .select(`
          id,
          location_id,
          start_date,
          end_date,
          is_active,
          payment_status,
          subscription_plans (
            id,
            name,
            code,
            price_monthly,
            price_annual,
            max_users,
            messages_included,
            overage_price,
            can_use_own_openai_key,
            can_white_label
          )
        `)
        .eq('location_id', locationId)
        .eq('is_active', true)
        .single()

      if (subError && subError.code !== 'PGRST116') { // PGRST116 is "not found"
        throw subError
      }

      if (locationSub) {
        return {
          subscription_id: locationSub.id,
          location_id: locationSub.location_id,
          plan_id: locationSub.subscription_plans.id,
          plan_name: locationSub.subscription_plans.name,
          plan_code: locationSub.subscription_plans.code,
          price_monthly: locationSub.subscription_plans.price_monthly,
          price_annual: locationSub.subscription_plans.price_annual,
          max_users: locationSub.subscription_plans.max_users,
          messages_included: locationSub.subscription_plans.messages_included,
          overage_price: locationSub.subscription_plans.overage_price,
          can_use_own_openai_key: locationSub.subscription_plans.can_use_own_openai_key,
          can_white_label: locationSub.subscription_plans.can_white_label,
          start_date: locationSub.start_date,
          end_date: locationSub.end_date,
          is_active: locationSub.is_active,
          payment_status: locationSub.payment_status
        }
      }

      // If no subscription found, return free plan
      const { data: freePlan, error: freeError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('code', 'free')
        .single()

      if (freeError) {
        throw freeError
      }

      return {
        subscription_id: null,
        location_id: locationId,
        plan_id: freePlan.id,
        plan_name: freePlan.name,
        plan_code: freePlan.code,
        price_monthly: freePlan.price_monthly,
        price_annual: freePlan.price_annual,
        max_users: freePlan.max_users,
        messages_included: freePlan.messages_included,
        overage_price: freePlan.overage_price,
        can_use_own_openai_key: freePlan.can_use_own_openai_key,
        can_white_label: freePlan.can_white_label,
        is_active: true,
        payment_status: 'free'
      }
    } catch (error) {
      console.error('Error getting subscription:', error)
      // Return a default subscription on error
      return {
        subscription_id: null,
        location_id: locationId,
        plan_name: 'Free',
        plan_code: 'free',
        price_monthly: 0,
        max_users: 1,
        messages_included: 100,
        overage_price: 0.08,
        can_use_own_openai_key: false,
        can_white_label: false,
        is_active: true,
        payment_status: 'free'
      }
    }
  }

  // Format subscription data from RPC function
  formatSubscriptionData(data) {
    if (!data || !data.plan) return null
    
    return {
      subscription_id: data.subscription_id,
      location_id: data.location_id,
      plan_id: data.plan.id,
      plan_name: data.plan.name,
      plan_code: data.plan.code,
      price_monthly: data.plan.price_monthly,
      price_annual: data.plan.price_annual,
      max_users: data.plan.max_users,
      messages_included: data.plan.messages_included,
      overage_price: data.plan.overage_price,
      can_use_own_openai_key: data.plan.can_use_own_openai_key,
      can_white_label: data.plan.can_white_label,
      start_date: data.start_date,
      end_date: data.end_date,
      is_active: data.is_active,
      payment_status: data.payment_status
    }
  }

  // Get available subscription plans
  async getAvailablePlans() {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true })

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error getting available plans:', error)
      return []
    }
  }

  // Get usage statistics for a location
  async getUsageStats(locationId) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase
      
      // Try to use the RPC function first
      const { data: usageData, error: rpcError } = await supabase
        .rpc('get_my_usage_with_limits')

      if (!rpcError && usageData) {
        return {
          messages_used: usageData.messages_used,
          tokens_used: usageData.tokens_used,
          cost_estimate: usageData.cost_estimate,
          messages_included: usageData.messages_included,
          messages_remaining: usageData.messages_remaining,
          usage_percentage: usageData.usage_percentage,
          limit_reached: usageData.limit_reached
        }
      }

      // Fallback to direct query
      const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
      
      const { data: usage, error: usageError } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('location_id', locationId)
        .eq('month_year', currentMonth)
        .maybeSingle()

      if (usageError && usageError.code !== 'PGRST116') {
        throw usageError
      }

      // Get subscription for message limits
      const subscription = await this.getCurrentSubscription(locationId)
      
      const messagesUsed = usage?.messages_used || 0
      const messagesIncluded = subscription?.messages_included || 100
      const messagesRemaining = Math.max(0, messagesIncluded - messagesUsed)
      const usagePercentage = messagesIncluded > 0 ? (messagesUsed / messagesIncluded) * 100 : 0
      const limitReached = messagesUsed >= messagesIncluded && subscription?.plan_code !== 'agency'

      return {
        messages_used: messagesUsed,
        tokens_used: usage?.tokens_used || 0,
        cost_estimate: usage?.cost_estimate || 0,
        messages_included: messagesIncluded,
        messages_remaining: messagesRemaining,
        usage_percentage: usagePercentage,
        limit_reached: limitReached
      }
    } catch (error) {
      console.error('Error getting usage stats:', error)
      return {
        messages_used: 0,
        tokens_used: 0,
        cost_estimate: 0,
        messages_included: 100,
        messages_remaining: 100,
        usage_percentage: 0,
        limit_reached: false
      }
    }
  }

  // Change subscription plan
  async changePlan(locationId, planId) {
    try {
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      // Get plan code from ID
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('code')
        .eq('id', planId)
        .single()

      if (planError) {
        throw planError
      }

      // Try to use the RPC function first
      const { data, error } = await supabase
        .rpc('force_change_subscription_plan', {
          p_location_id: locationId,
          p_plan_code: plan.code
        })

      if (error) {
        // Fallback to direct update
        const { error: updateError } = await supabase
          .from('location_subscriptions')
          .upsert({
            location_id: locationId,
            plan_id: planId,
            start_date: new Date().toISOString(),
            is_active: true,
            payment_status: 'active',
            updated_at: new Date().toISOString()
          })

        if (updateError) {
          throw updateError
        }
      }

      // Clear cache
      this.clearCacheForLocation(locationId)

      return { success: true }
    } catch (error) {
      console.error('Error changing plan:', error)
      return { success: false, error: error.message }
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