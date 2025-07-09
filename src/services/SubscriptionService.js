export class SubscriptionService {
  constructor(authService = null) {
    this.authService = authService
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutes
  }

  // Get current subscription for a location
  async getCurrentSubscription(locationId) {
    try {
      console.log('Getting current subscription for location:', locationId)
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      // Direct query for subscription data
      console.log('Querying location_subscriptions table...')
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

      if (subError) {
        console.log('Subscription query error:', subError)
        if (subError.code !== 'PGRST116') { // PGRST116 is "not found"
          throw subError
        }
      }

      if (locationSub) {
        console.log('Found subscription:', locationSub)
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
      console.log('No subscription found, getting free plan...')
      const { data: freePlan, error: freeError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('code', 'free')
        .single()

      if (freeError && freeError.code !== 'PGRST116') {
        console.log('Free plan query error:', freeError)
        throw freeError
      }

      if (freePlan) {
        console.log('Using free plan:', freePlan)
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
      }
      
      // Fallback to hardcoded free plan if database query fails
      console.log('Using hardcoded free plan')
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
      console.log('Getting available subscription plans')
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true })

      if (error) {
        console.log('Error fetching plans:', error)
        throw error
      }

      console.log(`Found ${data?.length || 0} subscription plans`)
      return data || []
    } catch (error) {
      console.error('Error getting available plans:', error)
      return []
    }
  }

  // Get usage statistics for a location
  async getUsageStats(locationId) {
    try {
      console.log('Getting usage stats for location:', locationId)
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase
      
      const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
      console.log('Current month:', currentMonth)
      
      const { data: usage, error: usageError } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('location_id', locationId)
        .eq('month_year', currentMonth)
        .maybeSingle()

      if (usageError) {
        console.log('Usage tracking query error:', usageError)
        if (usageError.code !== 'PGRST116') { // PGRST116 is "not found"
        throw usageError
        }
      }

      console.log('Usage data:', usage)
      
      // Get subscription for message limits
      const subscription = await this.getCurrentSubscription(locationId)
      console.log('Subscription for usage limits:', subscription)
      
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
      console.log('Changing subscription plan:', { locationId, planId })
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase

      // Get plan code from ID
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('code')
        .eq('id', planId)
        .single()

      if (planError) {
        console.log('Error getting plan code:', planError)
        throw planError
      }

      console.log('Updating subscription with plan code:', plan.code)
      
      // Direct update
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
        console.log('Error updating subscription:', updateError)
        throw updateError
      }

      // Clear cache
      this.clearCacheForLocation(locationId)

      console.log('Subscription updated successfully')
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