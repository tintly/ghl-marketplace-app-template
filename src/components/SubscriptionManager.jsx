import React, { useState, useEffect } from 'react'
import { SubscriptionService } from '../services/SubscriptionService'

function SubscriptionManager({ user, authService }) {
  const [subscription, setSubscription] = useState(null)
  const [usageStats, setUsageStats] = useState(null)
  const [availablePlans, setAvailablePlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const subscriptionService = new SubscriptionService(authService)

  useEffect(() => {
    loadSubscriptionData()
  }, [user])

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load current subscription
      const currentSubscription = await subscriptionService.getLocationSubscription(user.locationId)
      setSubscription(currentSubscription)

      // Load usage statistics
      const usageData = await subscriptionService.getUsageStatistics(user.locationId, 'current_month')
      setUsageStats(usageData[0] || { messages_used: 0, tokens_used: 0, cost_estimate: 0 })

      // Load available plans
      const plans = await subscriptionService.getAvailablePlans()
      setAvailablePlans(plans)

    } catch (error) {
      console.error('Error loading subscription data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (planCode) => {
    try {
      setLoading(true)
      setError(null)

      const result = await subscriptionService.updateSubscription(user.locationId, planCode)
      
      if (result.success) {
        // Reload subscription data
        await loadSubscriptionData()
        setShowUpgradeModal(false)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error)
      setError(error.message)
    } finally {
      setLoading(false)
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
          {subscription && subscription.plan_code !== 'agency' && (
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
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {subscription && (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Current Plan: {subscription.plan_name}</h3>
                <span className={`field-badge ${subscription.payment_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {subscription.payment_status === 'active' ? 'Active' : subscription.payment_status}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Users</p>
                  <p className="text-lg font-medium text-gray-900">
                    {subscription.max_users === 999999 ? 'Unlimited' : subscription.max_users}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Messages Included</p>
                  <p className="text-lg font-medium text-gray-900">
                    {subscription.messages_included === 999999 ? 'Unlimited' : subscription.messages_included.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Overage Price</p>
                  <p className="text-lg font-medium text-gray-900">
                    ${subscription.overage_price} per message
                  </p>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Custom OpenAI Keys</p>
                  <p className="text-lg font-medium text-gray-900">
                    {subscription.can_use_own_openai_key ? 'Included' : 'Not Available'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">White Labeling</p>
                  <p className="text-lg font-medium text-gray-900">
                    {subscription.can_white_label ? 'Included' : 'Not Available'}
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
                    <div className="flex items-end space-x-2">
                      <p className="text-2xl font-medium text-gray-900">
                        {usageStats?.messages_used || 0}
                      </p>
                      <p className="text-sm text-gray-500 mb-1">
                        / {subscription.messages_included === 999999 ? '∞' : subscription.messages_included}
                      </p>
                    </div>
                    
                    {subscription.messages_included !== 999999 && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${
                            (usageStats?.messages_used || 0) > subscription.messages_included * 0.9 
                              ? 'bg-red-600' 
                              : (usageStats?.messages_used || 0) > subscription.messages_included * 0.7 
                                ? 'bg-yellow-500' 
                                : 'bg-green-600'
                          }`}
                          style={{ width: `${Math.min(100, ((usageStats?.messages_used || 0) / subscription.messages_included) * 100)}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Tokens Used</p>
                    <p className="text-2xl font-medium text-gray-900">
                      {(usageStats?.tokens_used || 0).toLocaleString()}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Estimated Cost</p>
                    <p className="text-2xl font-medium text-gray-900">
                      ${(usageStats?.customer_cost_estimate || usageStats?.cost_estimate || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                {subscription.messages_included !== 999999 && (usageStats?.messages_used || 0) > subscription.messages_included * 0.9 && (
                  <div className="mt-4 warning-card">
                    <p className="text-sm text-yellow-800">
                      <strong>Warning:</strong> You're approaching your monthly message limit. Consider upgrading your plan to avoid overage charges.
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
          currentPlan={subscription}
          availablePlans={availablePlans}
          onUpgrade={handleUpgrade}
          onCancel={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  )
}

function UpgradePlanModal({ currentPlan, availablePlans, onUpgrade, onCancel }) {
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [loading, setLoading] = useState(false)

  // Filter out plans that are lower than or equal to the current plan
  const upgradePlans = availablePlans.filter(plan => {
    // If current plan is free, show all paid plans
    if (currentPlan.plan_code === 'free') {
      return plan.code !== 'free'
    }
    
    // Otherwise, only show plans with higher price
    return plan.price_monthly > (currentPlan.price_monthly || 0)
  })

  const handleUpgrade = async () => {
    if (!selectedPlan) return
    
    setLoading(true)
    try {
      await onUpgrade(selectedPlan.code)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-4xl">
        <div className="modal-header">
          <h3 className="text-lg font-medium text-gray-900">Upgrade Your Plan</h3>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading || !selectedPlan}
            className="btn-primary"
          >
            {loading ? 'Upgrading...' : 'Upgrade Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionManager