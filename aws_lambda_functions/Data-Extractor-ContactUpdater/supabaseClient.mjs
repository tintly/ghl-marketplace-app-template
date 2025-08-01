// Path: supabaseClient.mjs

import { createClient } from '@supabase/supabase-js';
import { loadSecrets, getAppSecrets } from './secrets.mjs'; // Adjusted path

let supabase;

/**
 * Initializes and returns a cached Supabase client.
 * Ensures secrets are loaded before client creation.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>} The Supabase client instance.
 */
export async function getSupabaseClient() {
    if (supabase) {
        return supabase;
    }

    await loadSecrets(); // Ensure secrets are loaded
    const secrets = getAppSecrets(); // Get all secrets
    const supabaseUrl = secrets.SUPABASE_PROJECT_URL;
    const supabaseServiceKey = secrets.SUPABASE_SERVICE_ROLE_SECRET;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Supabase URL or Service Role Key not found after loading secrets.");
    }
    
    console.log("Initializing Supabase client...");
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully.");
    
    return supabase;
}