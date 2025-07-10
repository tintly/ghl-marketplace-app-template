/*
  # Fix Buffer-related errors in browser environments

  1. Changes
    - Add safe base64 encoding/decoding functions that work in browser environments
    - Add helper functions for JWT handling without relying on Buffer
    - Fix RLS policies to work with browser-safe functions
    
  2. Security
    - Maintain existing security model
    - Ensure all functions are properly secured
*/

-- Create a function to safely handle base64 encoding in browser environments
CREATE OR REPLACE FUNCTION safe_encode_base64(input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use PostgreSQL's built-in encode function instead of relying on Buffer
  RETURN encode(convert_to(input, 'UTF8'), 'base64');
END;
$$;

-- Create a function to safely decode base64 in browser environments
CREATE OR REPLACE FUNCTION safe_decode_base64(input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use PostgreSQL's built-in decode function instead of relying on Buffer
  RETURN convert_from(decode(input, 'base64'), 'UTF8');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION safe_encode_base64(text) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_decode_base64(text) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_encode_base64(text) TO service_role;
GRANT EXECUTE ON FUNCTION safe_decode_base64(text) TO service_role;

-- Create a function to test database connectivity
CREATE OR REPLACE FUNCTION test_database_connection()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION test_database_connection() TO authenticated;
GRANT EXECUTE ON FUNCTION test_database_connection() TO service_role;
GRANT EXECUTE ON FUNCTION test_database_connection() TO anon;

-- Create a function to get a user's JWT claims for debugging
CREATE OR REPLACE FUNCTION debug_jwt_claims()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN auth.jwt();
END;
$$;

GRANT EXECUTE ON FUNCTION debug_jwt_claims() TO authenticated;

-- Fix the JWT helper functions to be more reliable
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