// supabaseClient.mjs (for openai-extraction-lambda)
import { createClient } from '@supabase/supabase-js';
import { getSupabaseSecrets } from './secrets.mjs'; // This imports the function to get YOUR specific Supabase secrets

let supabaseInstance;
let AWSXRay; // For X-Ray custom subsegments on Supabase calls

try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
} catch (e) {
    console.warn("X-Ray SDK not loaded for supabaseClient.mjs:", e.message);
    AWSXRay = null;
}

/**
 * Initializes and returns a cached Supabase client instance.
 * It fetches Supabase credentials from Secrets Manager.
 * @returns {Promise<object>} The Supabase client.
 */
export async function getSupabaseClient() {
    if (supabaseInstance) {
        // console.log("Using cached Supabase client."); // You can uncomment for debugging
        return supabaseInstance;
    }

    // console.log("Initializing new Supabase client."); // You can uncomment for debugging
    const secrets = await getSupabaseSecrets(); // Get secrets using your updated secrets.mjs
    
    // --- IMPORTANT: These lines are adapted to YOUR specific secret keys ---
    const supabaseUrl = secrets.SUPABASE_PROJECT_URL;
    const supabaseServiceKey = secrets.SUPABASE_SERVICE_ROLE_SECRET;
    // ---------------------------------------------------------------------

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Supabase PROJECT URL or SERVICE ROLE SECRET not found in secrets.");
    }

    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
    return supabaseInstance;
}

// NOTE: This file does NOT include getGHLConfiguration, getExtractionFields, or getContextualRules
// because those are only used by the Data-Extractor-Prompt-Orchestrator, not by this Lambda.