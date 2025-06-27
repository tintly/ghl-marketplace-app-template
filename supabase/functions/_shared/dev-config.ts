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

// Manual user data for development - using your actual GHL details
export const DEV_USER_DATA: DevUserData = {
  userId: Deno.env.get("DEV_USER_ID") || "qNgrB0T9EG975nt0FVQk",
  email: Deno.env.get("DEV_USER_EMAIL") || "mark@tintly.io", 
  userName: Deno.env.get("DEV_USER_NAME") || "Mark Tintly",
  role: Deno.env.get("DEV_USER_ROLE") || "admin",
  type: Deno.env.get("DEV_USER_TYPE") || "agency",
  companyId: Deno.env.get("DEV_COMPANY_ID") || "09fYwmPmgONYOfaasklt",
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