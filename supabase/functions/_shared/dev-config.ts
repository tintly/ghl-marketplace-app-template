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

// Manual user data for development - replace with your actual details
export const DEV_USER_DATA: DevUserData = {
  userId: Deno.env.get("DEV_USER_ID") || "user_12345",
  email: Deno.env.get("DEV_USER_EMAIL") || "test@example.com", 
  userName: Deno.env.get("DEV_USER_NAME") || "Test User",
  role: Deno.env.get("DEV_USER_ROLE") || "admin",
  type: Deno.env.get("DEV_USER_TYPE") || "location",
  companyId: Deno.env.get("DEV_COMPANY_ID") || "comp_67890",
  locationId: Deno.env.get("DEV_LOCATION_ID") || "loc_54321",
  activeLocation: Deno.env.get("DEV_ACTIVE_LOCATION") || "loc_54321"
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