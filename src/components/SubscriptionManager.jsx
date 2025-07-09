import React, { useState, useEffect } from 'react'
import { useWhiteLabel } from './WhiteLabelProvider'

function SubscriptionManager({ user, authService }) {
  const [subscription, setSubscription] = useState(null)
  const [usageStats, setUsageStats] = useState(null)
  const [availablePlans, setAvailablePlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const { getAgencyName } = useWhiteLabel()

  useEffect(() => {
    loadSubscriptionData()
  }, [user])

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get Supabase client
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase

      // Try direct functions first
      console.log('Loading subscription data using direct functions...')
      
      try {
        // Get subscription details
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .rpc('get_my_subscription_direct')
          
        if (subscriptionError) {
          console.error('Error loading subscription with direct function:', subscriptionError)
          throw subscriptionError
        }
        
        setSubscription(subscriptionData)
        console.log('Subscription loaded successfully:', subscriptionData)
        
        // Get usage statistics
        const { data: usageData, error: usageError } = await supabase
          .rpc('get_my_usage_with_limits')
          
        if (usageError) {
          console.error('Error loading usage with direct function:', usageError)
          throw usageError
        }
        
        setUsageStats(usageData)
        console.log('Usage stats loaded successfully:', usageData)
        
        // Get available plans
        const { data: plansData, error: plansError } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true })
          
        if (plansError) {
          console.error('Error loading plans with direct query:', plansError)
          throw plansError
        }
        
        setAvailablePlans(plansData || [])
        console.log('Available plans loaded successfully:', plansData?.length || 0)
        
      } catch (directError) {
        console.error('Error with direct functions, falling back to hardcoded data:', directError)
        
        // Fallback to hardcoded data
        if (user.type === 'agency') {
          setSubscription({
            plan: {
              name: 'Agency',
              code: 'agency',
              max_users: 999999,
              messages_included: 999999,
              overage_price: 0.005,
              can_use_own_openai_key: true,
              can_white_label: true
            },
            payment_status: 'active'
          })
          
          setUsageStats({
            messages_used: 0,
            tokens_used: 0,
            cost_estimate: 0,
            messages_included: 999999,
            usage_percentage: 0,
            limit_reached: false
          })
          
          setAvailablePlans([
            {
              id: '1',
              name: 'Agency',
              code: 'agency',
              price_monthly: 499,
              price_annual: 4790,
              max_users: 999999,
              messages_included: 999999,
              overage_price: 0.005,
              can_use_own_openai_key: true,
              can_white_label: true
            }
          ])
        } else {
          // For non-agency users, try to get subscription directly from database
          try {
            const { data: subData, error: subError } = await supabase
              .from('location_subscriptions')
              .select(`
                id,
                location_id,
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
              .eq('location_id', user.locationId)
              .eq('is_active', true)
              .single()
              
            if (subError) {
              console.error('Error loading subscription directly:', subError)
              throw subError
            }
            
            setSubscription({
              subscription_id: subData.id,
              location_id: subData.location_id,
              plan: subData.subscription_plans,
              is_active: subData.is_active,
              payment_status: subData.payment_status
            })
            
            // Get usage directly
            const { data: usageData, error: usageError } = await supabase
              .from('usage_tracking')
              .select('*')
              .eq('location_id', user.locationId)
              .eq('month_year', new Date().toISOString().substring(0, 7))
              .single()
              
            if (!usageError && usageData) {
              const messagesIncluded = subData.subscription_plans.messages_included || 100
              const messagesUsed = usageData.messages_used || 0
              const usagePercentage = (messagesUsed / messagesIncluded) * 100
              
              setUsageStats({
                messages_used: messagesUsed,
                tokens_used: usageData.tokens_used || 0,
                cost_estimate: usageData.cost_estimate || 0,
                messages_included: messagesIncluded,
                usage_percentage: usagePercentage,
                limit_reached: messagesUsed >= messagesIncluded
              })
            } else {
              // Default usage stats
              setUsageStats({
                messages_used: 0,
                tokens_used: 0,
                cost_estimate: 0,
                messages_included: subData.subscription_plans.messages_included || 100,
                usage_percentage: 0,
                limit_reached: false
              })
            }
            
            // Get plans directly
            const { data: plansData } = await supabase
              .from('subscription_plans')
              .select('*')
              .eq('is_active', true)
              .order('price_monthly', { ascending: true })
              
            setAvailablePlans(plansData || [])
            
          } catch (directDbError) {
            console.error('Error with direct database queries:', directDbError)
            
            // Last resort fallback
            setSubscription({
              plan: {
                name: 'Free',
                code: 'free',
                max_users: 1,
                messages_included: 100,
                overage_price: 0.08,
                can_use_own_openai_key: false,
                can_white_label: false
              },
              payment_status: 'free'
            })
            
            setUsageStats({
              messages_used: 0,
              tokens_used: 0,
              cost_estimate: 0,
              messages_included: 100,
              usage_percentage: 0,
              limit_reached: false
            })
            
            setAvailablePlans([
              {
                id: '1',
                name: 'Free',
                code: 'free',
                price_monthly: 0,
                price_annual: 0,
                max_users: 1,
                messages_included: 100,
                overage_price: 0.08,
                can_use_own_openai_key: false,
                can_white_label: false
              },
              {
                id: '2',
                name: 'Agency',
                code: 'agency',
                price_monthly: 499,
                price_annual: 4790,
                max_users: 999999,
                messages_included: 999999,
                overage_price: 0.005,
                can_use_own_openai_key: true,
                can_white_label: true
              }
            ])
          }
        }
      }

    } catch (error) {
      console.error('Error loading subscription data:', error)
      setError('Failed to load subscription data. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (planCode) => {
    try {
      setUpgrading(true)
      setError(null)
      setSuccess(null)

      // Get Supabase client
      const supabase = authService?.getSupabaseClient() || (await import('../services/supabase')).supabase

      console.log('Changing subscription plan to:', planCode)
      
      // Try the direct function first
      try {
        const { data, error } = await supabase
          .rpc('force_change_subscription_plan', {
            p_location_id: user.locationId,
            p_plan_code: planCode
          })

        if (error) {
          console.error('Error upgrading with direct function:', error)
          throw error
        }
        
        console.log('Plan changed successfully:', data)
      } catch (directError) {
        console.error('Error with direct function, trying fallback:', directError)
        
        // Fallback to direct database operations
        try {
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
          const { error: upsertError } = await supabase
            .from('location_subscriptions')
            .upsert({
              location_id: user.locationId,
              plan_id: planData.id,
              start_date: new Date().toISOString(),
              is_active: true,
              payment_status: 'active',
              updated_at: new Date().toISOString()
            })

          if (upsertError) {
            console.error('Error upgrading subscription:', upsertError)
            throw new Error(`Failed to upgrade: ${upsertError.message}`)
          }
        } catch (fallbackError) {
          console.error('Error with fallback method:', fallbackError)
          throw fallbackError
        }
      }

      // Reload subscription data
      await loadSubscriptionData()
      setShowUpgradeModal(false)
      setSuccess(`Successfully changed to ${planCode} plan!`)
    } catch (error) {
      console.error('Error upgrading subscription:', error)
      setError(error.message || 'Failed to change plan. Please try again later.')
    } finally {
      setUpgrading(false)
    }
  }

  if (loading && !subscription) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading subscription data...</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Subscription</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage your subscription and usage
            </p>
          </div>
          {subscription && subscription.plan?.code !== 'agency' && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="btn-primary"
            >
              Upgrade Plan
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="error-card mb-6">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="success-card mb-6">
            <p className="text-sm text-green-600 font-medium">{success}</p>
          </div>
        )}

        {subscription && (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Current Plan: {subscription.plan?.name || 'Free'}</h3>
                <span className={`field-badge ${subscription.payment_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {subscription.payment_status === 'active' ? 'Active' : subscription.payment_status?.charAt(0).toUpperCase() + subscription.payment_status?.slice(1) || 'Free'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Users</p>
                  <p className="text-lg font-medium text-gray-900">
                    {subscription.plan?.max_users === 999999 ? 'Unlimited' : subscription.plan?.max_users || 1}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Messages Included</p>
                  <p className="text-lg font-medium text-gray-900">
                    {subscription.plan?.messages_included === 999999 ? 'Unlimited' : (subscription.plan?.messages_included || 100).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Overage Price</p>
                  <p className="text-lg font-medium text-gray-900">
                    ${subscription.plan?.overage_price || 0.08} per message
                  </p>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Custom OpenAI Keys</p>
                  <p className="text-lg font-medium text-gray-900">
                    {subscription.plan?.can_use_own_openai_key ? 'Included' : 'Not Available'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">White Labeling</p>
                  <p className="text-lg font-medium text-gray-900">
                    {subscription.plan?.can_white_label ? 'Included' : 'Not Available'}
                  </p>
                </div>
              </div>
            </div>

            {/* Usage Statistics */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Current Usage</h3>
              
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Messages Used</p>
                    <div className="flex items-end space-x-2 mt-1">
                      <p className="text-2xl font-medium text-gray-900">
                        {usageStats?.messages_used || 0}
                      </p>
                      <p className="text-sm text-gray-500 mb-1">
                        / {usageStats?.messages_included === 999999 ? '∞' : usageStats?.messages_included || 100}
                      </p>
                    </div>
                    
                    {usageStats?.messages_included !== 999999 && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${
                            (usageStats?.usage_percentage || 0) > 90
                              ? 'bg-red-600' 
                              : (usageStats?.usage_percentage || 0) > 70 
                                ? 'bg-yellow-500' 
                                : 'bg-green-600'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, usageStats?.usage_percentage || 0))}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Tokens Used</p>
                    <p className="text-2xl font-medium text-gray-900 mt-1">
                      {(parseInt(usageStats?.tokens_used) || 0).toLocaleString()}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Estimated Cost</p>
                    <p className="text-2xl font-medium text-gray-900 mt-1">
                      ${(parseFloat(usageStats?.cost_estimate) || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                {usageStats?.messages_included !== 999999 && (usageStats?.usage_percentage || 0) > 90 && (
                  <div className="mt-4 warning-card">
                    <p className="text-sm text-yellow-800">
                      <strong>Warning:</strong> You're approaching your monthly message limit of {usageStats?.messages_included || 100} messages. Consider upgrading your plan to avoid overage charges.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradePlanModal
          currentPlan={subscription?.plan}
          availablePlans={availablePlans}
          onUpgrade={handleUpgrade}
          upgrading={upgrading}
          onCancel={() => setShowUpgradeModal(false)}
          agencyName={getAgencyName()}
        />
      )}
    </div>
  )
}

function UpgradePlanModal({ currentPlan, availablePlans, onUpgrade, upgrading, onCancel, agencyName }) {
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly')

  // Filter out plans that are lower than or equal to the current plan
  const upgradePlans = availablePlans.filter(plan => {
    // If current plan is free, show all paid plans
    if (currentPlan?.code === 'free') {
      return plan.code !== 'free'
    }
    
    // Otherwise, show all plans (including downgrades)
    return true
  })

  const handleUpgrade = async () => {
    if (!selectedPlan) return
    await onUpgrade(selectedPlan.code)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-4xl">
        <div className="modal-header">
          <h3 className="text-lg font-medium text-gray-900">Change Your Plan</h3>
          <p className="text-sm text-gray-600 mt-1">
            Select a new plan for your {agencyName} account
          </p>
        </div>

        <div className="modal-body">
          {/* Billing Cycle Toggle */}
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 p-1 rounded-lg inline-flex">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  billingCycle === 'monthly' 
                    ? 'bg-white shadow-sm text-gray-800' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  billingCycle === 'annual' 
                    ? 'bg-white shadow-sm text-gray-800' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setBillingCycle('annual')}
              >
                Annual (Save 20%)
              </button>
            </div>
          </div>

          {/* Plan Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {upgradePlans.map(plan => (
              <div 
                key={plan.id}
                className={`border rounded-lg p-6 cursor-pointer transition-all ${
                  selectedPlan?.id === plan.id 
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="text-center mb-4">
                  <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">
                      ${billingCycle === 'monthly' ? plan.price_monthly : (plan.price_annual / 12).toFixed(0)}
                    </span>
                    <span className="text-gray-500">/month</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <p className="text-sm text-green-600 mt-1">
                      Billed annually (${plan.price_annual}/year)
                    </p>
                  )}
                </div>
                
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>
                      {plan.max_users === 999999 ? 'Unlimited' : plan.max_users} {plan.max_users === 1 ? 'user' : 'users'}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>
                      {plan.messages_included === 999999 ? 'Unlimited' : plan.messages_included.toLocaleString()} messages/month
                    </span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>
                      ${plan.overage_price} per additional message
                    </span>
                  </li>
                  <li className="flex items-start">
                    {plan.can_use_own_openai_key ? (
                      <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    )}
                    <span className={plan.can_use_own_openai_key ? '' : 'text-gray-500'}>
                      Custom OpenAI API Keys
                    </span>
                  </li>
                  <li className="flex items-start">
                    {plan.can_white_label ? (
                      <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    )}
                    <span className={plan.can_white_label ? '' : 'text-gray-500'}>
                      White Labeling
                    </span>
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary flex items-center"
            disabled={upgrading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={upgrading || !selectedPlan}
            className="btn-primary flex items-center"
          >
            {upgrading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                Change Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionManager