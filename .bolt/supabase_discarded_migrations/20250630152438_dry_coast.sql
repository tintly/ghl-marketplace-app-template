-- Fix stack depth issues by simplifying RLS functions
-- Remove recursive calls and simplify JWT claim extraction

-- Drop existing functions that might cause recursion
DROP FUNCTION IF EXISTS get_ghl_user_id();
DROP FUNCTION IF EXISTS get_ghl_location_id();
DROP FUNCTION IF EXISTS is_ghl_user_authenticated();
DROP FUNCTION IF EXISTS user_owns_ghl_config(text);
DROP FUNCTION IF EXISTS user_has_location_access(text);

-- Create simplified, non-recursive functions
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

-- Recreate the get_user_ghl_configuration function with better error handling
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
  -- Strategy 1: Exact match
  SELECT * FROM ghl_configurations 
  WHERE ghl_configurations.user_id = p_user_id 
    AND ghl_configurations.ghl_account_id = p_location_id 
    AND ghl_configurations.is_active = true
  LIMIT 1
  
  UNION ALL
  
  -- Strategy 2: Location match (if no exact match)
  SELECT * FROM ghl_configurations 
  WHERE ghl_configurations.ghl_account_id = p_location_id 
    AND ghl_configurations.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM ghl_configurations gc2 
      WHERE gc2.user_id = p_user_id 
        AND gc2.ghl_account_id = p_location_id 
        AND gc2.is_active = true
    )
  ORDER BY ghl_configurations.updated_at DESC
  LIMIT 1
  
  UNION ALL
  
  -- Strategy 3: User match (if no location match)
  SELECT * FROM ghl_configurations 
  WHERE ghl_configurations.user_id = p_user_id 
    AND ghl_configurations.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM ghl_configurations gc2 
      WHERE gc2.ghl_account_id = p_location_id 
        AND gc2.is_active = true
    )
  ORDER BY ghl_configurations.updated_at DESC
  LIMIT 1;
$$;