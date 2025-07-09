import React, { useState, useEffect } from 'react'
import { SubscriptionService } from '../services/SubscriptionService'
import { useWhiteLabel } from './WhiteLabelProvider'

function UsageLimitBanner({ user, authService }) {
  const [usageData, setUsageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { getAppName } = useWhiteLabel()

  useEffect(() => {
    if (user?.locationId) {
      checkUsageLimit()
    }
  }, [user])

  const checkUsageLimit = async () => {
    try {
      setLoading(true)
      const subscriptionService = new SubscriptionService(authService)
      const limitData = await subscriptionService.getUsageStats(user.locationId)
      setUsageData(limitData)
    } catch (error) {
      console.error('Error checking usage limit:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !usageData || error) {
    return null
  }

  // Don't show for unlimited plans
  if (usageData.messages_included >= 999999) {
    return null
  }

  // Calculate usage percentage
  const messagesUsed = usageData.messages_used || 0
  const messagesIncluded = usageData.messages_included || 100
  const usagePercentage = Math.min(100, usageData.usage_percentage || (messagesUsed / messagesIncluded) * 100)

  // Only show warning if usage is over 70%
  if (usagePercentage < 70) {
    return null
  }

  // Determine severity based on usage
  const isNearLimit = usagePercentage >= 90
  const isOverLimit = usageData.limit_reached || false

  return (
    <div className={`rounded-lg p-4 mb-6 ${
      isOverLimit 
        ? 'bg-red-50 border border-red-200' 
        : isNearLimit 
          ? 'bg-yellow-50 border border-yellow-200'
          : 'bg-blue-50 border border-blue-200'
    }`}>
      <div className="flex items-start">
        <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${
          isOverLimit 
            ? 'bg-red-100 text-red-600' 
            : isNearLimit 
              ? 'bg-yellow-100 text-yellow-600'
              : 'bg-blue-100 text-blue-600'
        }`}>
          {isOverLimit ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${
            isOverLimit 
              ? 'text-red-800' 
              : isNearLimit 
                ? 'text-yellow-800'
                : 'text-blue-800'
          }`}>
            {isOverLimit 
              ? 'Message Limit Reached' 
              : isNearLimit 
                ? 'Approaching Message Limit'
                : 'Message Usage Update'
            }
          </h3>
          <div className={`mt-2 text-sm ${
            isOverLimit 
              ? 'text-red-700' 
              : isNearLimit 
                ? 'text-yellow-700'
                : 'text-blue-700'
          }`}>
            <p>
              {isOverLimit 
                ? `You've reached your monthly limit of ${messagesIncluded.toLocaleString()} messages.` 
                : `You've used ${messagesUsed.toLocaleString()} of ${messagesIncluded.toLocaleString()} messages (${Math.round(usagePercentage)}%) for this month.`
              }
            </p>
            {isOverLimit && (
              <p className="mt-1">
                Additional messages will be charged at the overage rate, or you can upgrade your plan for more included messages.
              </p>
            )}
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${
                  isOverLimit 
                    ? 'bg-red-600' 
                    : isNearLimit 
                      ? 'bg-yellow-500'
                      : 'bg-blue-600'
                }`}
                style={{ width: `${usagePercentage}%` }}
              ></div>
            </div>
          </div>
          <div className="mt-3">
            <a
              href="/subscription"
              className={`text-sm font-medium inline-flex items-center ${
                isOverLimit 
                  ? 'text-red-600 hover:text-red-500' 
                  : isNearLimit 
                    ? 'text-yellow-600 hover:text-yellow-500'
                    : 'text-blue-600 hover:text-blue-500'
              }`}
            >
              View subscription details
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UsageLimitBanner