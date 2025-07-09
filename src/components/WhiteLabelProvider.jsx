import React, { createContext, useContext, useState, useEffect } from 'react'
import { AgencyBrandingService } from '../services/AgencyBrandingService.js'

const WhiteLabelContext = createContext({
  getAppName: () => 'Data Extractor',
  getAgencyName: () => 'GoHighLevel',
  shouldHideGHLBranding: () => false,
  getWelcomeMessage: () => 'Welcome to your conversation data extractor.'
})

export const useWhiteLabel = () => {
  const context = useContext(WhiteLabelContext)
  if (!context) {
    throw new Error('useWhiteLabel must be used within a WhiteLabelProvider')
  }
  return context
}

export const WhiteLabelProvider = ({ children, authService, locationId }) => {
  const [branding, setBranding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) 
  
  const brandingService = new AgencyBrandingService(authService)

  useEffect(() => {
    const loadBranding = async () => {
      if (!locationId) {
        console.log('No location ID provided to WhiteLabelProvider')
        const defaultBranding = brandingService.getDefaultBranding()
        setBranding(defaultBranding)
        brandingService.applyBrandingToCSS(defaultBranding)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        console.log('Loading branding for location:', locationId)
        const brandingData = await brandingService.getAgencyBranding(locationId)
        console.log('Branding data loaded:', brandingData)
        setBranding(brandingData)
        
        // Apply branding to CSS variables
        brandingService.applyBrandingToCSS(brandingData)
      } catch (err) {
        console.error('Could not load WhiteLabel context, using defaults', err)
        setError(err.message)
        
        // Use default branding on error
        const defaultBranding = brandingService.getDefaultBranding()
        setBranding(defaultBranding)
        brandingService.applyBrandingToCSS(defaultBranding)
      } finally {
        setLoading(false)
      }
    }

    loadBranding()
  }, [locationId])

  const updateBranding = async (agencyId, brandingData) => {
    try {
      const result = await brandingService.updateAgencyBranding(agencyId, brandingData)
      
      if (result?.success !== false) {
        // Reload branding after update
        const updatedBranding = await brandingService.getAgencyBranding(locationId)
        setBranding(updatedBranding)
        brandingService.applyBrandingToCSS(updatedBranding)
      }
      
      return result
    } catch (err) {
      console.error('Error updating branding:', err)
      return { success: false, error: err.message }
    }
  }

  // Branding helper functions
  const getAppName = () => branding?.custom_app_name || 'Data Extractor'
  const getAgencyName = () => branding?.agency_name || 'GoHighLevel'
  const shouldHideGHLBranding = () => branding?.hide_ghl_branding || false
  const getWelcomeMessage = () => branding?.welcome_message || 'Welcome to your conversation data extractor.'
  const getPrimaryColor = () => branding?.primary_color || '#3B82F6'
  const getSecondaryColor = () => branding?.secondary_color || '#1F2937'
  const getAccentColor = () => branding?.accent_color || '#10B981'

  const value = {
    branding,
    loading,
    error,
    updateBranding,
    brandingService,
    getAppName,
    getAgencyName,
    shouldHideGHLBranding,
    getWelcomeMessage,
    getPrimaryColor,
    getSecondaryColor,
    getAccentColor
  }

  return (
    <WhiteLabelContext.Provider value={value}>
      {children}
    </WhiteLabelContext.Provider>
  )
}