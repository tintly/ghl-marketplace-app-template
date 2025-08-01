// supabaseClient.mjs (for ai-prompt-generator-lambda)

import { createClient } from '@supabase/supabase-js';
import { getSupabaseSecrets } from './secrets.mjs';

let supabaseInstance = null; // Cache Supabase client instance

// X-Ray SDK import and initialization
let AWSXRay;
try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
} catch (e) {
    console.warn("X-Ray SDK not loaded for supabaseClient.mjs:", e.message);
    AWSXRay = null;
}

// Ensure getSupabaseClient is exported so index.mjs can import it.
export async function getSupabaseClient() { // <-- MADE ASYNC
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Get current X-Ray segment to attach subsegment to (if this is called from within a segment)
  const currentSegment = AWSXRay && AWSXRay.getSegment();

  // Wrap the secret fetching in an X-Ray subsegment
  const secrets = await (async () => {
    if (AWSXRay && AWSXRay.captureAsyncFunc) {
      return AWSXRay.captureAsyncFunc('SupabaseClient - GetSecrets', async (subsegment) => {
        const s = await getSupabaseSecrets(); // <-- AWAITING getSupabaseSecrets()
        if (!s.SUPABASE_PROJECT_URL || !s.SUPABASE_SERVICE_ROLE_SECRET) {
            if (subsegment) subsegment.addError(new Error("Supabase secrets missing"), true);
        }
        return s;
      }, currentSegment);
    } else {
      return await getSupabaseSecrets();
    }
  })();

  const supabaseUrl = secrets.SUPABASE_PROJECT_URL;
  const supabaseServiceKey = secrets.SUPABASE_SERVICE_ROLE_SECRET;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase PROJECT URL or SERVICE ROLE SECRET not found in secrets.");
  }

  // Supabase client itself doesn't need to be captured with captureAWSv3Client
  // because it's not an AWS SDK client. Individual calls to it will be wrapped.
  supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
  return supabaseInstance;
}

// Encapsulated helper functions for Supabase interactions
// IMPORTANT: These functions also need the supabase client passed to them,
// OR getSupabaseClient() needs to be called inside each, but that's less efficient.
// Given your orchestrator passes `supabase` client, let's keep that pattern.

// Add supabase parameter to all these functions if they need it for the X-Ray wrapper
// The orchestrator is already doing `getGHLConfiguration(supabase, locationId);`
// So we ensure `supabase` parameter is accepted here.

export async function getGHLConfiguration(supabase, locationId) { // <-- Added supabase parameter
  const operation = async (subsegment) => {
    try {
      console.log('Fetching GHL configuration for location:', locationId);
      const { data, error } = await supabase.from('ghl_configurations').select(`
          id,
          ghl_account_id,
          business_name,
          business_description,
          business_context,
          target_audience,
          services_offered
        `).eq('ghl_account_id', locationId).eq('is_active', true).maybeSingle();

      if (error) {
        if (subsegment) subsegment.addError(error);
        throw new Error(`Failed to fetch configuration: ${error.message}`);
      }
      if (!data) {
        console.log('No configuration found for location:', locationId);
        // Removed excessive logging for production, can add back for deep debugging
        return null;
      }
      console.log('✅ Found configuration:', {
        id: data.id,
        name: data.business_name,
        locationId: data.ghl_account_id
      });
      return data;
    } catch (e) {
      if (subsegment) subsegment.addError(e);
      throw e;
    }
  };

  if (AWSXRay && AWSXRay.captureAsyncFunc) {
      return AWSXRay.captureAsyncFunc('Supabase - getGHLConfiguration', operation);
  } else {
      return operation(null);
  }
}

export async function getExtractionFields(supabase, configId) { // <-- Added supabase parameter
  const operation = async (subsegment) => {
    try {
      console.log('Fetching extraction fields for config:', configId);
      const { data, error } = await supabase.from('data_extraction_fields').select(`
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
        `).eq('config_id', configId).order('sort_order', {
        ascending: true
      });

      if (error) {
        if (subsegment) subsegment.addError(error);
        throw new Error(`Failed to fetch extraction fields: ${error.message}`);
      }
      const fields = data || [];
      console.log(`✅ Found ${fields.length} extraction fields`);
      // Removed excessive logging for production, can add back for deep debugging
      return fields;
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

export async function getContextualRules(supabase, configId) { // <-- Added supabase parameter
  const operation = async (subsegment) => {
    try {
      console.log('Fetching contextual rules for config:', configId);
      const { data, error } = await supabase.from('contextual_rules').select('rule_name, rule_description, rule_type, rule_value, is_active').eq('config_id', configId).eq('is_active', true);

      if (error) {
        if (subsegment) subsegment.addError(error);
        throw new Error(`Failed to fetch contextual rules: ${error.message}`);
      }
      const rules = data || [];
      console.log(`✅ Found ${rules.length} contextual rules`);
      return rules;
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

export async function getStopTriggers(supabase, configId) { // <-- Added supabase parameter
  const operation = async (subsegment) => {
    try {
      console.log('Fetching stop triggers for config:', configId);
      const { data, error } = await supabase.from('stop_triggers').select('trigger_name, scenario_description, escalation_message, is_active').eq('config_id', configId).eq('is_active', true);

      if (error) {
        if (subsegment) subsegment.addError(error);
        throw new Error(`Failed to fetch stop triggers: ${error.message}`);
      }
      const triggers = data || [];
      console.log(`✅ Found ${triggers.length} stop triggers`);
      return triggers;
    } catch (e) {
      if (subsegment) subsegment.addError(e);
      throw e;
    }
  };

  if (AWSXRay && AWSXRay.captureAsyncFunc) {
      return AWSXRay.captureAsyncFunc('Supabase - getStopTriggers', operation);
  } else {
      return operation(null);
  }
}