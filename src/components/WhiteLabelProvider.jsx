import React, { createContext, useContext, useEffect, useState } from 'react'
import { AgencyBrandingService } from '../services/AgencyBrandingService'

const WhiteLabelContext = createContext()

export function useWhiteLabel() {
  const context = useContext(WhiteLabelContext)
  if (!context) {
    throw new Error('useWhiteLabel must be used within a WhiteLabelProvider')
  }
  return context
}

export function WhiteLabelProvider({ children, user, authService }) {
  const [branding, setBranding] = useState(null)
  const [loading, setLoading] = useState(true)

  const brandingService = new AgencyBrandingService(authService)

  useEffect(() => {
    loadBranding()
  }, [user])

  const loadBranding = async () => {
    try {
      setLoading(true)
      
      if (user?.locationId) {
        const brandingData = await brandingService.getAgencyBranding(user.locationId)
        setBranding(brandingData)
        
        // Apply branding to CSS
        brandingService.applyBrandingToCSS(brandingData)
      }
    } catch (error) {
      console.error('Error loading white-label branding:', error)
      // Use default branding on error
      const defaultBranding = brandingService.getDefaultBranding()
      setBranding(defaultBranding)
      brandingService.applyBrandingToCSS(defaultBranding)
    } finally {
      setLoading(false)
    }
  }

  const refreshBranding = () => {
    loadBranding()
  }

  // Helper functions for components to use
  const getAppName = () => {
    return branding?.custom_app_name || 'Data Extractor'
  }

  const getAgencyName = () => {
    return branding?.agency_name || 'GoHighLevel'
  }

  const shouldHideGHLBranding = () => {
    return branding?.hide_ghl_branding || false
  }

  const getWelcomeMessage = () => {
    return branding?.welcome_message || 'Welcome to your conversation data extractor.'
  }

  const getSupportEmail = () => {
    return branding?.support_email || 'support@gohighlevel.com'
  }

  const getFooterText = () => {
    return branding?.footer_text || `© ${new Date().getFullYear()} ${getAgencyName()}. All rights reserved.`
  }

  const value = {
    branding,
    loading,
    refreshBranding,
    getAppName,
    getAgencyName,
    shouldHideGHLBranding,
    getWelcomeMessage,
    getSupportEmail,
    getFooterText
  }

  return (
    <WhiteLabelContext.Provider value={value}>
      {children}
    </WhiteLabelContext.Provider>
  )
}