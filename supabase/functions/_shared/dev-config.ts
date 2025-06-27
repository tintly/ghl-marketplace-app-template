// Development configuration for connecting to real GHL account
// This allows testing with actual GHL data while protecting token integrity

export interface DevUserData {
  userId: string
  email: string
  userName: string
  role: string
  type: string
  companyId: string
  locationId: string
  activeLocation: string
}

// Set DEV_MODE to true to use manual user data with real GHL account
export const DEV_MODE = Deno.env.get("DEV_MODE") === "true"

// Real GHL account configuration for development
export const DEV_USER_DATA: DevUserData = {
  userId: Deno.env.get("DEV_USER_ID") || "qNgrB0T9EG975nt0FVQk",
  email: Deno.env.get("DEV_USER_EMAIL") || "dev@example.com", 
  userName: Deno.env.get("DEV_USER_NAME") || "Dev User",
  role: Deno.env.get("DEV_USER_ROLE") || "admin",
  type: Deno.env.get("DEV_USER_TYPE") || "agency",
  companyId: Deno.env.get("DEV_COMPANY_ID") || "4beIyWyWrcoPRD7PEN5G",
  locationId: Deno.env.get("DEV_LOCATION_ID") || "4beIyWyWrcoPRD7PEN5G",
  activeLocation: Deno.env.get("DEV_ACTIVE_LOCATION") || "4beIyWyWrcoPRD7PEN5G"
}

export function getDevUserContext() {
  return {
    userId: DEV_USER_DATA.userId,
    email: DEV_USER_DATA.email,
    userName: DEV_USER_DATA.userName,
    role: DEV_USER_DATA.role,
    type: DEV_USER_DATA.type,
    companyId: DEV_USER_DATA.companyId,
    locationId: DEV_USER_DATA.locationId,
    activeLocation: DEV_USER_DATA.activeLocation
  }
}

// Function to validate that we have proper tokens for the real account
export function validateRealAccountTokens(config: any): { isValid: boolean; message: string; severity: string } {
  if (!config) {
    return {
      isValid: false,
      message: 'No configuration found for this location. Please install the app via OAuth.',
      severity: 'error'
    }
  }

  if (!config.access_token || config.access_token.startsWith('dev-')) {
    return {
      isValid: false,
      message: 'Missing real access token. Please reinstall the app to get proper GHL tokens.',
      severity: 'error'
    }
  }

  if (!config.refresh_token || config.refresh_token.startsWith('dev-')) {
    return {
      isValid: false,
      message: 'Missing real refresh token. Please reinstall the app to get proper GHL tokens.',
      severity: 'error'
    }
  }

  if (config.token_expires_at) {
    const expiryDate = new Date(config.token_expires_at)
    const now = new Date()
    const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntilExpiry < 0) {
      return {
        isValid: false,
        message: 'Access token has expired. The system will attempt to refresh it automatically.',
        severity: 'warning'
      }
    } else if (hoursUntilExpiry < 24) {
      return {
        isValid: true,
        message: `Access token expires in ${Math.round(hoursUntilExpiry)} hours.`,
        severity: 'info'
      }
    }
  }

  return {
    isValid: true,
    message: 'Real GHL tokens are valid and active.',
    severity: 'success'
  }
}

// Function to check if we should create a dev configuration or use existing real one
export function shouldCreateDevConfig(existingConfig: any): boolean {
  // If no config exists, we need to create one
  if (!existingConfig) {
    return true
  }

  // If config exists but has dev tokens, we should NOT overwrite it
  // Instead, we should prompt user to reinstall via OAuth
  if (existingConfig.access_token?.startsWith('dev-') || 
      existingConfig.refresh_token?.startsWith('dev-')) {
    return false
  }

  // If config exists with real tokens, use it
  return false
}