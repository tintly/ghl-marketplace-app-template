import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to get current user's GHL configurations
export async function getUserGHLConfigurations(userId) {
  const { data, error } = await supabase
    .from('ghl_configurations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching GHL configurations:', error)
    throw error
  }

  return data
}

// Helper function to check if user has any active configurations
export async function hasActiveGHLConfiguration(userId) {
  const configurations = await getUserGHLConfigurations(userId)
  return configurations.length > 0
}

// Helper function to get configuration by location ID
export async function getGHLConfigurationByLocation(locationId) {
  const { data, error } = await supabase
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
}