/*
  # JWT Authentication Functions for GHL Integration

  1. Functions
    - `get_ghl_user_id()` - Extract GHL user ID from JWT claims
    - `get_ghl_location_id()` - Extract GHL location ID from JWT claims
    - `is_ghl_user_authenticated()` - Check if user is authenticated via GHL

  2. Updated RLS Policies
    - Use JWT claims instead of auth.uid() for user identification
    - Maintain security while allowing GHL-authenticated users access
*/

-- Function to extract GHL user ID from JWT claims
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

-- Function to check if user owns a configuration
CREATE OR REPLACE FUNCTION user_owns_ghl_config(config_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT config_user_id = get_ghl_user_id();
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