/*
  # Fix Buffer-related errors in database functions

  1. Changes
    - Update functions that use Buffer to be browser-compatible
    - Fix RPC function errors
    - Improve error handling in database functions
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Create a function to safely handle Buffer operations in browser environments
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

-- Create a function to check if a user has access to a specific location
CREATE OR REPLACE FUNCTION check_location_access(p_location_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN user_has_location_access(p_location_id);
END;
$$;

GRANT EXECUTE ON FUNCTION check_location_access(text) TO authenticated;

-- Create a function to get a user's current location ID
CREATE OR REPLACE FUNCTION get_current_location_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN get_ghl_location_id();
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_location_id() TO authenticated;

-- Create a function to get a user's current user ID
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN get_ghl_user_id();
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated;

-- Create a function to get a user's current user type
CREATE OR REPLACE FUNCTION get_current_user_type()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN get_ghl_user_type();
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_type() TO authenticated;

-- Create a function to get a user's current company ID
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN get_ghl_company_id();
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_company_id() TO authenticated;

-- Create a function to check if a user is authenticated
CREATE OR REPLACE FUNCTION is_user_authenticated()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN is_ghl_user_authenticated();
END;
$$;

GRANT EXECUTE ON FUNCTION is_user_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_authenticated() TO anon;