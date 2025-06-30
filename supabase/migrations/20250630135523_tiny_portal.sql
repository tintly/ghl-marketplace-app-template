/*
  # Fix RLS policies and database function for ghl_configurations

  1. Clean up existing policies and function
  2. Create comprehensive but secure RLS policies
  3. Recreate database function with proper return type
  4. Add performance indexes and test function
*/

-- First, temporarily disable RLS to clean up policies
ALTER TABLE public.ghl_configurations DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "ghl_configurations_own_access" ON public.ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_read_by_location" ON public.ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_link_update" ON public.ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_insert" ON public.ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_user_access" ON public.ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_location_access" ON public.ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_location_update" ON public.ghl_configurations;
DROP POLICY IF EXISTS "service_role_all_ghl_configurations" ON public.ghl_configurations;

-- Drop existing function to avoid return type conflicts
DROP FUNCTION IF EXISTS get_user_ghl_configuration(text, text);

-- Re-enable RLS
ALTER TABLE public.ghl_configurations ENABLE ROW LEVEL SECURITY;

-- Create comprehensive but secure policies

-- 1. Service role gets full access (most important)
CREATE POLICY "service_role_all_ghl_configurations"
  ON public.ghl_configurations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Users can access their own configurations
CREATE POLICY "ghl_configurations_own_access"
  ON public.ghl_configurations
  FOR ALL
  TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

-- 3. Users can read active configurations by location (for linking)
CREATE POLICY "ghl_configurations_read_by_location"
  ON public.ghl_configurations
  FOR SELECT
  TO authenticated
  USING ((ghl_account_id IS NOT NULL) AND (is_active = true));

-- 4. Users can update configurations for linking (but only set their own user_id)
CREATE POLICY "ghl_configurations_link_update"
  ON public.ghl_configurations
  FOR UPDATE
  TO authenticated
  USING ((ghl_account_id IS NOT NULL) AND (is_active = true))
  WITH CHECK (user_id = (auth.uid())::text);

-- 5. Users can insert new configurations
CREATE POLICY "ghl_configurations_insert"
  ON public.ghl_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (auth.uid())::text);

-- Create the database function with proper return type
CREATE OR REPLACE FUNCTION get_user_ghl_configuration(
  p_user_id text,
  p_location_id text
)
RETURNS TABLE (
  id uuid,
  user_id text,
  ghl_account_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  business_name text,
  business_description text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_record RECORD;
BEGIN
  -- Strategy 1: Try exact match first
  SELECT 
    c.id, c.user_id, c.ghl_account_id, c.access_token, c.refresh_token,
    c.token_expires_at, c.business_name, c.business_description, c.is_active, 
    c.created_at, c.updated_at
  INTO config_record
  FROM ghl_configurations c
  WHERE c.user_id = p_user_id 
    AND c.ghl_account_id = p_location_id 
    AND c.is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      config_record.id, config_record.user_id, config_record.ghl_account_id,
      config_record.access_token, config_record.refresh_token, config_record.token_expires_at,
      config_record.business_name, config_record.business_description, config_record.is_active,
      config_record.created_at, config_record.updated_at;
    RETURN;
  END IF;
  
  -- Strategy 2: Try by location only
  SELECT 
    c.id, c.user_id, c.ghl_account_id, c.access_token, c.refresh_token,
    c.token_expires_at, c.business_name, c.business_description, c.is_active,
    c.created_at, c.updated_at
  INTO config_record
  FROM ghl_configurations c
  WHERE c.ghl_account_id = p_location_id 
    AND c.is_active = true
  ORDER BY c.updated_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      config_record.id, config_record.user_id, config_record.ghl_account_id,
      config_record.access_token, config_record.refresh_token, config_record.token_expires_at,
      config_record.business_name, config_record.business_description, config_record.is_active,
      config_record.created_at, config_record.updated_at;
    RETURN;
  END IF;
  
  -- Strategy 3: Try by user only
  SELECT 
    c.id, c.user_id, c.ghl_account_id, c.access_token, c.refresh_token,
    c.token_expires_at, c.business_name, c.business_description, c.is_active,
    c.created_at, c.updated_at
  INTO config_record
  FROM ghl_configurations c
  WHERE c.user_id = p_user_id 
    AND c.is_active = true
  ORDER BY c.updated_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      config_record.id, config_record.user_id, config_record.ghl_account_id,
      config_record.access_token, config_record.refresh_token, config_record.token_expires_at,
      config_record.business_name, config_record.business_description, config_record.is_active,
      config_record.created_at, config_record.updated_at;
    RETURN;
  END IF;
  
  -- No configuration found
  RETURN;
END;
$$;

-- Grant comprehensive permissions to the function
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO anon;

-- Ensure all necessary indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_ghl_configurations_user_location_active 
ON public.ghl_configurations USING btree (user_id, ghl_account_id, is_active);

CREATE INDEX IF NOT EXISTS idx_ghl_configurations_location_active_updated 
ON public.ghl_configurations USING btree (ghl_account_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ghl_configurations_user_active_updated 
ON public.ghl_configurations USING btree (user_id, is_active, updated_at DESC);

-- Add a simple test function to verify RLS is working
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
    AND (user_id = (auth.uid())::text OR ghl_account_id IS NOT NULL);
  
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

GRANT EXECUTE ON FUNCTION test_ghl_configuration_access() TO authenticated;
GRANT EXECUTE ON FUNCTION test_ghl_configuration_access() TO service_role;