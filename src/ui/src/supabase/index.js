import { createClient } from '@supabase/supabase-js';

// These should match your Supabase project settings
const supabaseUrl = process.env.VUE_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.VUE_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);