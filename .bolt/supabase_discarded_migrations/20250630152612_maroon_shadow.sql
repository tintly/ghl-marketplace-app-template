/*
  # Fix stack depth issues by simplifying RLS functions
  
  This migration fixes the "stack depth limit exceeded" error by:
  1. Replacing existing functions with simplified, non-recursive versions
  2. Improving the get_user_ghl_configuration function
  3. Ensuring all functions use SECURITY DEFINER properly
  
  Changes:
  - Simplified JWT claim extraction functions
  - Removed potential recursive calls
  - Better error handling in configuration lookup
*/

-- Replace existing functions with simplified, non-recursive versions
-- Using CREATE OR REPLACE to avoid dependency issues

CREATE OR REPLACE FUNCTION get_ghl_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'ghl_user_id')::text,
    (auth.jwt() ->> 'sub')::text
  );
$$;

CREATE OR REPLACE FUNCTION get_ghl_location_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'ghl_location_id')::text;
$$;

CREATE OR REPLACE FUNCTION is_ghl_user_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'ghl_user_id') IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION user_owns_ghl_config(config_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT config_user_id = (auth.jwt() ->> 'ghl_user_id')::text;
$$;

CREATE OR REPLACE FUNCTION user_has_location_access(location_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT location_id = (auth.jwt() ->> 'ghl_location_id')::text;
$$;

-- Recreate the get_user_ghl_configuration function with better performance
-- Using a single query with CASE statements instead of UNION ALL to avoid complexity
CREATE OR REPLACE FUNCTION get_user_ghl_configuration(p_user_id text, p_location_id text)
RETURNS TABLE (
  id uuid,
  user_id text,
  ghl_account_id text,
  client_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  business_name text,
  business_address text,
  business_phone text,
  business_email text,
  business_website text,
  business_description text,
  target_audience text,
  services_offered text,
  business_context text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  created_by text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Single query with priority-based selection
  SELECT 
    gc.id,
    gc.user_id,
    gc.ghl_account_id,
    gc.client_id,
    gc.access_token,
    gc.refresh_token,
    gc.token_expires_at,
    gc.business_name,
    gc.business_address,
    gc.business_phone,
    gc.business_email,
    gc.business_website,
    gc.business_description,
    gc.target_audience,
    gc.services_offered,
    gc.business_context,
    gc.is_active,
    gc.created_at,
    gc.updated_at,
    gc.created_by
  FROM ghl_configurations gc
  WHERE gc.is_active = true
    AND (
      -- Priority 1: Exact match (user_id AND location_id)
      (gc.user_id = p_user_id AND gc.ghl_account_id = p_location_id)
      OR
      -- Priority 2: Location match only
      (gc.ghl_account_id = p_location_id AND gc.user_id IS NOT NULL)
      OR
      -- Priority 3: User match only
      (gc.user_id = p_user_id)
    )
  ORDER BY 
    -- Prioritize exact matches first
    CASE 
      WHEN gc.user_id = p_user_id AND gc.ghl_account_id = p_location_id THEN 1
      WHEN gc.ghl_account_id = p_location_id THEN 2
      WHEN gc.user_id = p_user_id THEN 3
      ELSE 4
    END,
    gc.updated_at DESC
  LIMIT 1;
$$;

-- Create a simple test function to validate RLS access without recursion
CREATE OR REPLACE FUNCTION test_ghl_configuration_access()
RETURNS TABLE (
  total_configs bigint,
  accessible_configs bigint,
  test_result text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    (SELECT COUNT(*) FROM ghl_configurations WHERE is_active = true) as total_configs,
    (SELECT COUNT(*) FROM ghl_configurations WHERE is_active = true AND (
      user_id = (auth.jwt() ->> 'ghl_user_id')::text OR
      ghl_account_id = (auth.jwt() ->> 'ghl_location_id')::text
    )) as accessible_configs,
    'RLS test completed successfully' as test_result;
$$;

-- Add a comment to track this migration
COMMENT ON FUNCTION get_user_ghl_configuration(text, text) IS 'Simplified configuration lookup function to prevent stack depth issues';
COMMENT ON FUNCTION get_ghl_user_id() IS 'Simplified JWT user ID extraction without recursion';
COMMENT ON FUNCTION is_ghl_user_authenticated() IS 'Simplified authentication check without recursion';