import React, { createContext, useContext, useState, useEffect } from 'react'
import { AgencyBrandingService } from '../services/AgencyBrandingService.js'

const WhiteLabelContext = createContext()

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
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        const brandingData = await brandingService.getAgencyBranding(locationId)
        setBranding(brandingData)
        
        // Apply branding to CSS
        brandingService.applyBrandingToCSS(brandingData)
      } catch (err) {
        console.error('Error loading branding:', err)
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

  const value = {
    branding,
    loading,
    error,
    updateBranding,
    brandingService
  }

  return (
    <WhiteLabelContext.Provider value={value}>
      {children}
    </WhiteLabelContext.Provider>
  )
}