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
      
      // Check if this is an agency user
      const isAgency = this.authService?.getCurrentUser()?.type === 'agency'
      if (isAgency) {
        console.log('User is agency type, returning agency plan')
        return {
          subscription_id: null,
          location_id: locationId,
          plan_name: 'Agency',
          plan_code: 'agency',
          price_monthly: 499,
          max_users: 999999,
          messages_included: 999999,
          overage_price: 0.005,
          can_use_own_openai_key: true,
          can_white_label: true,
          is_active: true,
          payment_status: 'active'
        }
      }
      
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
            can_white_label,
            daily_cap_messages,
            custom_fields_limit,
            ai_summary_included,
            call_extraction_rate_per_minute,
            call_package_1_minutes,
            call_package_1_price,
            call_package_2_minutes,
            call_package_2_price
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
          daily_cap_messages: locationSub.subscription_plans.daily_cap_messages,
          custom_fields_limit: locationSub.subscription_plans.custom_fields_limit,
          ai_summary_included: locationSub.subscription_plans.ai_summary_included,
          call_extraction_rate_per_minute: locationSub.subscription_plans.call_extraction_rate_per_minute,
          call_package_1_minutes: locationSub.subscription_plans.call_package_1_minutes,
          call_package_1_price: locationSub.subscription_plans.call_package_1_price,
          call_package_2_minutes: locationSub.subscription_plans.call_package_2_minutes,
          call_package_2_price: locationSub.subscription_plans.call_package_2_price,
          start_date: locationSub.start_date,
          end_date: locationSub.end_date,
          is_active: locationSub.is_active,
          payment_status: locationSub.payment_status
        }
      }

      // If no subscription found, return free plan
      console.log('No subscription found, getting free plan...')
      const { data: starterPlan, error: starterError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('code', 'starter')
        .single()

      if (starterError && starterError.code !== 'PGRST116') {
        console.log('Starter plan query error:', starterError)
        throw starterError
      }

      if (starterPlan) {
        console.log('Using starter plan:', starterPlan)
        return {
          subscription_id: null,
          location_id: locationId,
          plan_id: starterPlan.id,
          plan_name: starterPlan.name,
          plan_code: starterPlan.code,
          price_monthly: starterPlan.price_monthly,
          price_annual: starterPlan.price_annual,
          max_users: starterPlan.max_users,
          messages_included: starterPlan.messages_included,
          overage_price: starterPlan.overage_price,
          can_use_own_openai_key: starterPlan.can_use_own_openai_key,
          can_white_label: starterPlan.can_white_label,
          daily_cap_messages: starterPlan.daily_cap_messages,
          custom_fields_limit: starterPlan.custom_fields_limit,
          ai_summary_included: starterPlan.ai_summary_included,
          call_extraction_rate_per_minute: starterPlan.call_extraction_rate_per_minute,
          call_package_1_minutes: starterPlan.call_package_1_minutes,
          call_package_1_price: starterPlan.call_package_1_price,
          call_package_2_minutes: starterPlan.call_package_2_minutes,
          call_package_2_price: starterPlan.call_package_2_price,
          is_active: true,
          payment_status: 'active'
        }
      }
      
      // Fallback to hardcoded starter plan if database query fails
      console.log('Using hardcoded starter plan')
      return {
        subscription_id: null,
        location_id: locationId,
        plan_name: 'Starter',
        plan_code: 'starter',
        price_monthly: 0,
        max_users: 1,
        messages_included: 500,
        overage_price: 0.01,
        can_use_own_openai_key: false,
        can_white_label: false,
        daily_cap_messages: 100,
        custom_fields_limit: 1,
        ai_summary_included: false,
        call_extraction_rate_per_minute: 0.25,
        call_package_1_minutes: 0,
        call_package_1_price: 0,
        call_package_2_minutes: 0,
        call_package_2_price: 0,
        is_active: true,
        payment_status: 'active'
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
      
      if (!locationId) {
        throw new Error('Location ID is required to get usage statistics')
      }
      
      // Check if this is an agency user
      const isAgency = this.authService?.getCurrentUser()?.type === 'agency'
      
      const supabase = this.authService?.getSupabaseClient() || (await import('./supabase')).supabase
      
      if (!supabase) {
        throw new Error('Supabase client not available')
      }
      
      const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
      console.log('Current month:', currentMonth)
      
      const { data: usage, error: usageError } = await supabase
        .from('usage_tracking')
        .select(`
          messages_used,
          tokens_used,
          cost_estimate,
          custom_key_used,
          daily_messages_used,
          daily_call_minutes_used,
          call_minutes_used_monthly,
          call_cost_estimate_monthly
        `)
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
      let subscription
      try {
        subscription = await this.getCurrentSubscription(locationId)
      } catch (subError) {
        console.error('Error getting subscription:', subError)
        // Use default values if subscription can't be fetched
        subscription = {
          messages_included: isAgency ? 999999 : 100
          daily_cap_messages: isAgency ? 999999 : 100
        }
      }
      
      console.log('Subscription for usage limits:', subscription)

      // For agency users, always set unlimited messages
      const messagesIncluded = isAgency ? 999999 : (subscription?.messages_included || 100)
      const dailyCapMessages = isAgency ? 999999 : (subscription?.daily_cap_messages || 100)
      
      const messagesUsed = usage?.messages_used || 0
      const dailyMessagesUsed = usage?.daily_messages_used || 0
      const callMinutesUsed = usage?.call_minutes_used_monthly || 0
      const dailyCallMinutes = usage?.daily_call_minutes_used || 0
      const callCostEstimate = usage?.call_cost_estimate_monthly || 0
      
      const messagesRemaining = Math.max(0, messagesIncluded - messagesUsed)
      const usagePercentage = messagesIncluded > 0 ? (messagesUsed / messagesIncluded) * 100 : 0
      const limitReached = isAgency ? false : (messagesUsed >= messagesIncluded)

      return {
        messages_used: messagesUsed,
        daily_messages_used: dailyMessagesUsed,
        call_minutes_used_monthly: callMinutesUsed,
        daily_call_minutes_used: dailyCallMinutes,
        call_cost_estimate_monthly: callCostEstimate,
        tokens_used: usage?.tokens_used || 0,
        cost_estimate: usage?.cost_estimate || 0,
        messages_included: messagesIncluded,
        daily_cap_messages: dailyCapMessages,
        messages_remaining: messagesRemaining,
        usage_percentage: usagePercentage,
        limit_reached: limitReached,
        custom_key_used: usage?.custom_key_used || false
      }
    } catch (error) {
      console.error('Error getting usage stats:', error)
      return {
        messages_used: 0,
        daily_messages_used: 0,
        call_minutes_used_monthly: 0,
        daily_call_minutes_used: 0,
        call_cost_estimate_monthly: 0,
        tokens_used: 0,
        cost_estimate: 0,
        messages_included: 500,
        daily_cap_messages: 100,
        messages_remaining: 500,
        usage_percentage: 0,
        limit_reached: false,
        custom_key_used: false
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