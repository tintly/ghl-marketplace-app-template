// Development configuration for manual user data
// This allows testing the interface without actual GHL SSO

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

// Set DEV_MODE to true to use manual user data instead of SSO decryption
export const DEV_MODE = Deno.env.get("DEV_MODE") === "true"

// CRITICAL: Use FAKE/TEST IDs for development - NEVER use real production IDs
// These should be completely different from your actual GHL account IDs
export const DEV_USER_DATA: DevUserData = {
  userId: Deno.env.get("DEV_USER_ID") || "dev_user_12345",
  email: Deno.env.get("DEV_USER_EMAIL") || "dev@example.com", 
  userName: Deno.env.get("DEV_USER_NAME") || "Dev User",
  role: Deno.env.get("DEV_USER_ROLE") || "admin",
  type: Deno.env.get("DEV_USER_TYPE") || "agency",
  companyId: Deno.env.get("DEV_COMPANY_ID") || "dev_company_12345",
  locationId: Deno.env.get("DEV_LOCATION_ID") || "dev_location_12345",
  activeLocation: Deno.env.get("DEV_ACTIVE_LOCATION") || "dev_location_12345"
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

// Function to check if a location ID is a production ID that should be protected
export function isProductionLocationId(locationId: string): boolean {
  const PROTECTED_PRODUCTION_IDS = [
    "4beIyWyWrcoPRD7PEN5G", // Your actual production location ID
    // Add other production IDs here that should never be used in dev mode
  ]
  
  return PROTECTED_PRODUCTION_IDS.includes(locationId)
}

// Function to validate that dev mode isn't accidentally using production data
export function validateDevEnvironment() {
  if (DEV_MODE) {
    const devLocationId = DEV_USER_DATA.locationId
    
    if (isProductionLocationId(devLocationId)) {
      throw new Error(
        `CRITICAL ERROR: Development mode is configured to use production location ID ${devLocationId}. ` +
        `This could overwrite live data. Please update DEV_LOCATION_ID environment variable to use a test ID.`
      )
    }
  }
}