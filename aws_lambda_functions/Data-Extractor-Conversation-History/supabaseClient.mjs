// Path: utils/supabaseClient.mjs

import { createClient } from '@supabase/supabase-js';
import { loadSecrets, getSupabaseSecrets } from './secrets.mjs';
import AWSXRay from 'aws-xray-sdk-core'; // Import X-Ray SDK

let supabase;

export async function getSupabaseClient() {
    if (supabase) {
        return supabase;
    }

    await loadSecrets();
    const secrets = getSupabaseSecrets();
    const supabaseUrl = secrets.SUPABASE_PROJECT_URL;
    const supabaseServiceKey = secrets.SUPABASE_SERVICE_ROLE_SECRET;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Supabase URL or Service Role Key not found after loading secrets.");
    }
    
    console.log("Initializing Supabase client...");
    // Instrument the Supabase client itself if you want to trace all its internal calls.
    // However, for simple queries, wrapping the query in a subsegment is often sufficient.
    // If you want full SDK instrumentation, you'd typically do:
    // const instrumentedCreateClient = AWSXRay.captureAWSClient(createClient);
    // supabase = instrumentedCreateClient(supabaseUrl, supabaseServiceKey);
    // For now, we'll just wrap the query.
    
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully.");
    
    return supabase;
}