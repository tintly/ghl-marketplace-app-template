import React, { useState, useEffect } from 'react'
import { SubscriptionService } from '../services/SubscriptionService'

const SubscriptionManager = ({ user, authService }) => {
  // Check if user has permission to manage subscriptions
  const canManageSubscription = user?.type === 'agency' && user?.role === 'admin'
  
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState(null)
  const [plans, setPlans] = useState([])
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)

  const [subscriptionService] = useState(() => new SubscriptionService(authService))

  useEffect(() => {
    loadSubscriptionData()
  }, [user])

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (!user || !user.locationId) {
        throw new Error('User or location ID not available')
      }
      
      // Check if user is agency type
      const isAgency = user.type === 'agency'
      
      // For agency users, use hardcoded agency plan
      if (isAgency) {
        console.log('User is agency type, using agency plan')
        const locationId = user.activeLocation || user.locationId || user.companyId
        setSubscription({
          subscription_id: null,
          location_id: locationId,
          plan_id: 'agency-plan',
          plan_name: 'Agency',
          plan_code: 'agency',
          price_monthly: 499,
          price_annual: 4790,
          max_users: 999999,
          messages_included: 999999,
          overage_price: 0.005,
          can_use_own_openai_key: true,
          can_white_label: true,
          is_active: true,
          payment_status: 'active'
        })
        
        // Still load plans and usage
        const plansData = await subscriptionService.getAvailablePlans()
        const usageData = await subscriptionService.getUsageStats(user.locationId)
        
        setPlans(plansData)
        setUsage(usageData)
        setLoading(false)
        return
      }
      
      const locationId = user.activeLocation || user.locationId || user.companyId
      console.log('Loading subscription data for location:', locationId)

      // Load each piece of data separately to better identify issues
      console.log('Getting current subscription...')
      const subscriptionData = await subscriptionService.getCurrentSubscription(locationId)
      console.log('Subscription data:', subscriptionData)
      
      console.log('Getting available plans...')
      const plansData = await subscriptionService.getAvailablePlans()
      console.log('Available plans:', plansData)
      
      console.log('Getting usage stats...')
      const usageData = await subscriptionService.getUsageStats(locationId)
      console.log('Usage stats:', usageData)

      setSubscription(subscriptionData)
      setPlans(plansData)
      setUsage(usageData)
    } catch (err) {
      console.error('Error loading subscription data:', err)
      setError('Failed to load subscription information')
    } finally {
      setLoading(false)
    }
  }

  const handlePlanChange = async (planId) => {
    // Double-check permissions before allowing plan changes
    if (!canManageSubscription) {
      setError('You do not have permission to change subscription plans')
      return
    }
    
    try {
      setLoading(true)
      
      // Don't allow changing from agency plan
      if (subscription?.plan_code === 'agency') {
        setError('Agency plan cannot be changed')
        setLoading(false)
        return
      }
      
      const locationId = user.activeLocation || user.locationId || user.companyId
      await subscriptionService.changePlan(locationId, planId)
      await loadSubscriptionData()
    } catch (err) {
      console.error('Error changing plan:', err)
      setError('Failed to change subscription plan')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Show access denied message for non-agency admins
  if (!canManageSubscription) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-600 mb-4">
          Subscription management is only available to agency administrators.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left max-w-md mx-auto">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Current User Details:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li><strong>Type:</strong> {user?.type || 'Unknown'}</li>
            <li><strong>Role:</strong> {user?.role || 'Unknown'}</li>
            <li><strong>Required:</strong> Agency Admin</li>
          </ul>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Contact your agency administrator to manage subscription settings.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="text-red-400">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Subscription Management</h2>
        </div>
        
        <div className="p-6">
          {/* Current Subscription */}
          <div className="mb-8">
            <h3 className="text-md font-medium text-gray-900 mb-4">Current Plan</h3>
            {subscription ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-blue-900">{subscription.plan_name}</h4>
                    {subscription.plan_code !== 'agency' ? (
                      <p className="text-sm text-blue-700 mt-1">
                        ${subscription.price_monthly}/month
                      </p>
                    ) : (
                      <p className="text-sm text-blue-700 mt-1">
                        Enterprise Plan
                      </p>
                    )}
                    <p className="text-xs text-blue-600 mt-1">
                      Status: {subscription.payment_status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-700">
                      {subscription.plan_code === 'agency' ? 'Unlimited' : subscription.messages_included} messages/month
                    </p>
                    {subscription.end_date && (
                      <p className="text-xs text-blue-600 mt-1">
                        Expires: {new Date(subscription.end_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">No active subscription found</p>
              </div>
            )}
          </div>

          {/* Usage Statistics */}
          {usage && (
            <div className="mb-8">
              <h3 className="text-md font-medium text-gray-900 mb-4">Usage This Month</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">{usage.messages_used}</div>
                  <div className="text-sm text-gray-600">Messages Used</div>
                  {subscription && subscription.plan_code !== 'agency' && (
                    <div className="text-xs text-gray-500 mt-1">
                      of {subscription.messages_included} included
                    </div>
                  )}
                  {subscription && subscription.plan_code === 'agency' && (
                    <div className="text-xs text-gray-500 mt-1">
                      Unlimited messages
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">{usage.tokens_used.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Tokens Used</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">${usage.cost_estimate.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Estimated Cost</div>
                </div>
              </div>
            </div>
          )}

          {/* Available Plans */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Available Plans</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => {
                // Don't show agency plan for non-agency users
                if (plan.code?.startsWith('agency') && user.type !== 'agency') {
                  return null;
                }
                
                return (
                  <div
                    key={plan.id}
                    className={`border rounded-lg p-4 ${
                      subscription?.plan_id === plan.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <h4 className="font-medium text-gray-900">{plan.name}</h4>
                      <div className="mt-2">
                        <span className="text-2xl font-bold text-gray-900">
                          ${plan.price_monthly}
                        </span> 
                        <span className="text-gray-600">
                          {plan.code !== 'starter' && plan.code !== 'free' ? '/month' : ''}
                        </span>
                      </div>
                      
                      {/* Plan Features */}
                      <div className="mt-3 space-y-2 text-sm text-gray-600">
                        <div>
                          <strong>{plan.messages_included >= 999999 ? 'Unlimited' : plan.messages_included.toLocaleString()}</strong> messages/month
                        </div>
                        {plan.daily_cap_messages && plan.daily_cap_messages < 999999 && (
                          <div>Daily cap: {plan.daily_cap_messages} messages</div>
                        )}
                        <div>
                          Custom fields: {plan.custom_fields_limit >= 999999 ? 'Unlimited' : plan.custom_fields_limit}
                        </div>
                        {plan.ai_summary_included && (
                          <div className="text-green-600">✓ AI Summary Field</div>
                        )}
                        {plan.can_use_own_openai_key && (
                          <div className="text-blue-600">✓ Custom OpenAI Keys</div>
                        )}
                        {plan.can_white_label && (
                          <div className="text-purple-600">✓ White Label</div>
                        )}
                      </div>
                      
                      {/* Pricing Details */}
                      <div className="mt-3 text-xs text-gray-500 space-y-1">
                        {plan.overage_price > 0 && (
                          <div>Overage: ${plan.overage_price}/message</div>
                        )}
                        {plan.call_extraction_rate_per_minute > 0 && (
                          <div>Calls: ${plan.call_extraction_rate_per_minute}/minute</div>
                        )}
                        {plan.call_package_1_minutes > 0 && (
                          <div>Call Package: {plan.call_package_1_minutes} min for ${plan.call_package_1_price}</div>
                        )}
                      </div>
                      

                      {subscription?.plan_id !== plan.id && (
                        <button
                          onClick={() => handlePlanChange(plan.id)}
                          className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={loading || !canManageSubscription}
                        >
                          {loading ? 'Processing...' : 'Select Plan'}
                        </button>
                      )}
                      
                      {subscription?.plan_id === plan.id && (
                        <div className="mt-4 w-full bg-blue-100 text-blue-800 py-2 px-4 rounded-md text-sm font-medium">
                          Current Plan
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionManager