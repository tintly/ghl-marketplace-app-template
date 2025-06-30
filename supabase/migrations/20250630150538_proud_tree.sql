/*
  # Update JWT helper functions to handle UUID conversion

  1. Functions Updated
    - `get_ghl_user_id()` - Returns the original GHL user ID from JWT claims
    - `get_ghl_user_uuid()` - Returns the UUID version of the GHL user ID (from sub claim)
    - `user_owns_ghl_config()` - Updated to use GHL user ID for comparison
    
  2. Security
    - Maintains existing RLS policies
    - Ensures proper user identification across UUID and string formats
*/

-- Function to extract GHL user ID from JWT claims (original string format)
CREATE OR REPLACE FUNCTION get_ghl_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'ghl_user_id',
    auth.jwt() ->> 'sub'
  );
$$;

-- Function to extract GHL user UUID from JWT claims (UUID format used by Supabase)
CREATE OR REPLACE FUNCTION get_ghl_user_uuid()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() ->> 'sub';
$$;

-- Function to extract GHL location ID from JWT claims
CREATE OR REPLACE FUNCTION get_ghl_location_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() ->> 'ghl_location_id';
$$;

-- Function to check if user is authenticated via GHL
CREATE OR REPLACE FUNCTION is_ghl_user_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() ->> 'ghl_user_id' IS NOT NULL;
$$;

-- Function to check if user owns a configuration (uses original GHL user ID)
CREATE OR REPLACE FUNCTION user_owns_ghl_config(config_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT config_user_id = (auth.jwt() ->> 'ghl_user_id');
$$;

-- Function to check if user has access to a location
CREATE OR REPLACE FUNCTION user_has_location_access(location_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT location_id = get_ghl_location_id() OR 
         EXISTS (
           SELECT 1 FROM ghl_configurations 
           WHERE ghl_account_id = location_id 
           AND user_id = get_ghl_user_id()
           AND is_active = true
         );
$$;

-- Add a test function to debug JWT claims
CREATE OR REPLACE FUNCTION debug_jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt();
$$;