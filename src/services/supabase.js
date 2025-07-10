import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

// Create default client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Function to create authenticated client with JWT
export function createAuthenticatedClient(jwtToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwtToken}`
      }
    }
  })
}

// Helper function to get current user's GHL configurations
export async function getUserGHLConfigurations(userId, authService = null) {
  try {
    const client = authService?.getSupabaseClient() || supabase
    
    const { data, error } = await client
      .from('ghl_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching GHL configurations:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error in getUserGHLConfigurations:', error)
    return []
  }
}

// Helper function to check if user has any active configurations
export async function hasActiveGHLConfiguration(userId, authService = null) {
  try {
    const configurations = await getUserGHLConfigurations(userId, authService)
    return configurations.length > 0
  } catch (error) {
    console.error('Error checking GHL configurations:', error)
    return false
  }
}

// Helper function to get configuration by location ID
export async function getGHLConfigurationByLocation(locationId, authService = null) {
  try {
    const client = authService?.getSupabaseClient() || supabase
    
    const { data, error } = await client
      .from('ghl_configurations')
      .select('*')
      .eq('ghl_account_id', locationId)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching GHL configuration:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error in getGHLConfigurationByLocation:', error)
    return null
  }
}

// Helper function to safely encode base64 in browser environments
export function safeEncodeBase64(text) {
  try {
    return btoa(text)
  } catch (error) {
    console.error('Error encoding to base64:', error)
    return null
  }
}

// Helper function to safely decode base64 in browser environments
export function safeDecodeBase64(base64) {
  try {
    return atob(base64)
  } catch (error) {
    console.error('Error decoding from base64:', error)
    return null
  }
}

// Helper function to test database connection
export async function testDatabaseConnection(authService = null) {
  try {
    const client = authService?.getSupabaseClient() || supabase
    
    const { data, error } = await client
      .rpc('test_database_connection')
    
    if (error) {
      console.error('Database connection test failed:', error)
      return false
    }
    
    return data === true
  } catch (error) {
    console.error('Error testing database connection:', error)
    return false
  }
}