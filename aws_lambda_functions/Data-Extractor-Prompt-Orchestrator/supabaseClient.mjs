// supabaseClient.mjs
import { createClient } from '@supabase/supabase-js';
// FIX: Change the import to match the actual export from secrets.mjs
import { getSecrets } from './secrets.mjs'; // <--- THIS LINE IS FIXED

let supabaseInstance;
let AWSXRay; // For X-Ray custom subsegments on Supabase calls

try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
} catch (e) {
    console.warn("X-Ray SDK not loaded for supabaseClient.mjs:", e.message);
    AWSXRay = null;
}

export async function getSupabaseClient() {
    if (supabaseInstance) {
        // console.log("Using cached Supabase client.");
        return supabaseInstance;
    }

    // console.log("Initializing new Supabase client.");
    // FIX: Change the function call to match the imported name
    const secrets = await getSecrets(); // <--- THIS LINE IS FIXED
    // --- CHANGED THESE LINES TO MATCH YOUR SECRET KEYS ---
    const supabaseUrl = secrets.SUPABASE_PROJECT_URL;
    const supabaseServiceKey = secrets.SUPABASE_SERVICE_ROLE_SECRET;
    // ----------------------------------------------------

    if (!supabaseUrl || !supabaseServiceKey) {
        // Updated error message to reflect the new key names being looked for
        throw new Error("Supabase PROJECT URL or SERVICE ROLE SECRET not found in secrets.");
    }

    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
    return supabaseInstance;
}

// Encapsulated helper functions for Supabase interactions
export async function getGHLConfiguration(supabase, locationId) {
    const operation = async (subsegment) => {
        try {
            const { data, error } = await supabase.from('ghl_configurations')
                .select(`
                    id,
                    access_token,
                    refresh_token,
                    token_expires_at,
                    ghl_account_id,
                    business_name,
                    business_description,
                    business_context,
                    target_audience,
                    services_offered,
                    agency_ghl_id
                `)
                .eq('ghl_account_id', locationId)
                .eq('is_active', true)
                .maybeSingle();

            if (error) {
                if (subsegment) subsegment.addError(error);
                throw new Error(`Failed to fetch configuration for location ${locationId}: ${error.message}`);
            }
            if (subsegment) subsegment.addAnnotation('ghlConfigFound', !!data);
            return data;
        } catch (e) {
            if (subsegment) subsegment.addError(e);
            throw e;
        }
    };

    if (AWSXRay && AWSXRay.captureAsyncFunc) {
        return AWSXRay.captureAsyncFunc('Supabase - getGHLConfiguration', operation);
    } else {
        return operation(null); // No X-Ray segment if SDK not loaded
    }
}

export async function getExtractionFields(supabase, configId) {
    const operation = async (subsegment) => {
        try {
            const { data, error } = await supabase.from('data_extraction_fields')
                .select(`
                    id,
                    field_name,
                    description,
                    target_ghl_key,
                    field_type,
                    picklist_options,
                    placeholder,
                    is_required,
                    sort_order,
                    overwrite_policy,
                    original_ghl_field_data
                `)
                .eq('config_id', configId)
                .order('sort_order', { ascending: true });

            if (error) {
                if (subsegment) subsegment.addError(error);
                throw new Error(`Failed to fetch extraction fields for config ${configId}: ${error.message}`);
            }
            if (subsegment) subsegment.addAnnotation('extractionFieldsCount', data ? data.length : 0);
            return data || [];
        } catch (e) {
            if (subsegment) subsegment.addError(e);
            throw e;
        }
    };

    if (AWSXRay && AWSXRay.captureAsyncFunc) {
        return AWSXRay.captureAsyncFunc('Supabase - getExtractionFields', operation);
    } else {
        return operation(null);
    }
}

export async function getContextualRules(supabase, configId) {
    const operation = async (subsegment) => {
        try {
            const { data, error } = await supabase.from('contextual_rules')
                .select('rule_name, rule_description, rule_type, rule_value, is_active')
                .eq('config_id', configId)
                .eq('is_active', true);

            if (error) {
                if (subsegment) subsegment.addError(error);
                throw new Error(`Failed to fetch contextual rules for config ${configId}: ${error.message}`);
            }
            if (subsegment) subsegment.addAnnotation('contextualRulesCount', data ? data.length : 0);
            return data || [];
        } catch (e) {
            if (subsegment) subsegment.addError(e);
            throw e;
        }
    };

    if (AWSXRay && AWSXRay.captureAsyncFunc) {
        return AWSXRay.captureAsyncFunc('Supabase - getContextualRules', operation);
    } else {
        return operation(null);
    }
}