import React, { useState, useEffect } from 'react'
import { SubscriptionService } from '../services/SubscriptionService'

const SubscriptionManager = ({ user, authService }) => {
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
        const usageData = await subscriptionService.getUsageStats(locationId)
        
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
                if (plan.code === 'agency' && user.type !== 'agency') {
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
                          {plan.code !== 'free' ? '/month' : ''}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        {plan.code === 'agency' ? 'Unlimited' : plan.messages_included} messages included
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {plan.code !== 'agency' ? `$${plan.overage_price} per additional message` : 'No overage charges'}
                      </div>
                      
                      <div className="mt-4 space-y-1 text-xs text-gray-600">
                        <div>Max {plan.max_users} users</div>
                        {plan.can_use_own_openai_key && (
                          <div>✓ Custom OpenAI keys</div>
                        )}
                        {plan.can_white_label && (
                          <div>✓ White label branding</div>
                        )}
                      </div>

                      {subscription?.plan_id !== plan.id && (
                        <button
                          onClick={() => handlePlanChange(plan.id)}
                          className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                          disabled={loading}
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