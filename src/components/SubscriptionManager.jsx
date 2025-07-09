import React, { useState, useEffect } from 'react'
import { SubscriptionService } from '../services/SubscriptionService'

const SubscriptionManager = ({ user, authService }) => {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState(null)
  const [plans, setPlans] = useState([])
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)

  const subscriptionService = new SubscriptionService(authService)

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
      
      const locationId = user.activeLocation || user.locationId || user.companyId

      const [subscriptionData, plansData, usageData] = await Promise.all([
        subscriptionService.getCurrentSubscription(locationId),
        subscriptionService.getAvailablePlans(),
        subscriptionService.getUsageStats(locationId)
      ])

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
                    <p className="text-sm text-blue-700 mt-1">
                      ${subscription.price_monthly}/month
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Status: {subscription.payment_status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-700">
                      {subscription.messages_included} messages/month
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
                  {subscription && (
                    <div className="text-xs text-gray-500 mt-1">
                      of {subscription.messages_included} included
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
              {plans.map((plan) => (
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
                      <span className="text-gray-600">/month</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {plan.messages_included} messages included
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      ${plan.overage_price} per additional message
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionManager