/*
  # Fix Database Functions for Data Extraction

  1. Changes
    - Fix r.from, r.rpc, and s.rpc function errors
    - Ensure proper function definitions for database access
    - Fix JWT helper functions for authentication
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Fix the database access functions
CREATE OR REPLACE FUNCTION test_ghl_configuration_access()
RETURNS TABLE (
  total_configs bigint,
  accessible_configs bigint,
  test_result text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count bigint;
  accessible_count bigint;
BEGIN
  -- Count total configurations (as service role)
  SELECT COUNT(*) INTO total_count FROM ghl_configurations WHERE is_active = true;
  
  -- Count accessible configurations (as current user)
  SELECT COUNT(*) INTO accessible_count 
  FROM ghl_configurations 
  WHERE is_active = true 
    AND (
      (user_id = get_ghl_user_id()) OR 
      (ghl_account_id = get_ghl_location_id()) OR
      (
        get_ghl_user_type() = 'agency' AND 
        agency_ghl_id = get_ghl_company_id()
      )
    );
  
  RETURN QUERY SELECT 
    total_count,
    accessible_count,
    CASE 
      WHEN accessible_count > 0 THEN 'RLS policies allow access'
      WHEN total_count = 0 THEN 'No configurations in database'
      ELSE 'RLS policies may be too restrictive'
    END;
END;
$$;

-- Fix the JWT helper functions
CREATE OR REPLACE FUNCTION get_ghl_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'ghl_user_id',
    auth.jwt() ->> 'sub'
  );
$$;

CREATE OR REPLACE FUNCTION get_ghl_location_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.jwt() ->> 'ghl_location_id';
$$;

CREATE OR REPLACE FUNCTION get_ghl_company_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.jwt() ->> 'ghl_company_id';
$$;

CREATE OR REPLACE FUNCTION is_ghl_user_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.jwt() ->> 'ghl_user_id' IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION get_ghl_user_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'ghl_user_type',
    'location'
  );
$$;

-- Fix the user_has_location_access function
CREATE OR REPLACE FUNCTION user_has_location_access(location_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Direct location match
  IF location_id = get_ghl_location_id() THEN
    RETURN true;
  END IF;
  
  -- User owns the configuration
  IF EXISTS (
    SELECT 1 FROM ghl_configurations 
    WHERE ghl_account_id = location_id 
    AND user_id = get_ghl_user_id()
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Agency access to location
  IF get_ghl_user_type() = 'agency' AND EXISTS (
    SELECT 1 FROM ghl_configurations 
    WHERE ghl_account_id = location_id 
    AND agency_ghl_id = get_ghl_company_id()
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Fix the user_owns_ghl_config function
CREATE OR REPLACE FUNCTION user_owns_ghl_config(config_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN config_user_id = get_ghl_user_id();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION test_ghl_configuration_access() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ghl_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ghl_location_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ghl_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_ghl_user_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ghl_user_type() TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_location_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION user_owns_ghl_config(text) TO authenticated;

-- Create a function to check if a user can access a specific configuration
CREATE OR REPLACE FUNCTION user_can_access_configuration(config_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ghl_configurations 
    WHERE id = config_id
    AND (
      user_id = get_ghl_user_id() OR
      user_has_location_access(ghl_account_id) OR
      (get_ghl_user_type() = 'agency' AND agency_ghl_id = get_ghl_company_id())
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION user_can_access_configuration(uuid) TO authenticated;

-- Create a function to get a user's configuration by ID
CREATE OR REPLACE FUNCTION get_configuration_by_id(p_config_id uuid)
RETURNS SETOF ghl_configurations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM ghl_configurations
  WHERE id = p_config_id
  AND (
    user_id = get_ghl_user_id() OR
    user_has_location_access(ghl_account_id) OR
    (get_ghl_user_type() = 'agency' AND agency_ghl_id = get_ghl_company_id())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_configuration_by_id(uuid) TO authenticated;

-- Create a function to get extraction fields for a configuration
CREATE OR REPLACE FUNCTION get_extraction_fields_for_config(p_config_id uuid)
RETURNS SETOF data_extraction_fields
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First check if user can access this configuration
  IF NOT user_can_access_configuration(p_config_id) THEN
    RAISE EXCEPTION 'Access denied to configuration %', p_config_id;
  END IF;
  
  RETURN QUERY
  SELECT *
  FROM data_extraction_fields
  WHERE config_id = p_config_id
  ORDER BY sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION get_extraction_fields_for_config(uuid) TO authenticated;

-- Create a function to create a test configuration
CREATE OR REPLACE FUNCTION create_test_configuration(
  p_user_id text,
  p_location_id text,
  p_business_name text DEFAULT 'Test Configuration'
)
RETURNS ghl_configurations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_config ghl_configurations;
BEGIN
  -- Insert a new test configuration
  INSERT INTO ghl_configurations (
    user_id,
    ghl_account_id,
    client_id,
    client_secret,
    access_token,
    refresh_token,
    token_expires_at,
    business_name,
    business_description,
    is_active,
    created_by
  ) VALUES (
    p_user_id,
    p_location_id,
    'test-client-id',
    'test-client-secret',
    'test-access-token-' || extract(epoch from now()),
    'test-refresh-token-' || extract(epoch from now()),
    now() + interval '1 year',
    p_business_name,
    'Test configuration created for diagnostics',
    true,
    p_user_id
  )
  RETURNING * INTO new_config;
  
  RETURN new_config;
END;
$$;

GRANT EXECUTE ON FUNCTION create_test_configuration(text, text, text) TO authenticated;

-- Create a function to link a configuration to a user
CREATE OR REPLACE FUNCTION link_configuration_to_user(
  p_config_id uuid,
  p_user_id text
)
RETURNS ghl_configurations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_config ghl_configurations;
BEGIN
  -- Update the configuration with the new user_id
  UPDATE ghl_configurations
  SET 
    user_id = p_user_id,
    updated_at = now()
  WHERE id = p_config_id
  RETURNING * INTO updated_config;
  
  RETURN updated_config;
END;
$$;

GRANT EXECUTE ON FUNCTION link_configuration_to_user(uuid, text) TO authenticated;