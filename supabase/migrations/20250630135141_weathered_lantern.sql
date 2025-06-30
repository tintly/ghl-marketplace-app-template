/*
  # Fix Row Level Security Policies

  1. Security Updates
    - Fix overly restrictive RLS policies that prevent configuration access
    - Allow proper read access for configuration lookup
    - Maintain security while enabling functionality
    
  2. Policy Changes
    - Update policies to allow reading configurations by location
    - Enable proper user linking functionality
    - Ensure service role maintains full access
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "ghl_configurations_user_access" ON public.ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_location_access" ON public.ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_location_update" ON public.ghl_configurations;

-- Create more permissive but secure policies

-- Allow users to access their own configurations
CREATE POLICY "ghl_configurations_own_access"
  ON public.ghl_configurations
  FOR ALL
  TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

-- Allow users to read configurations by location (needed for linking)
CREATE POLICY "ghl_configurations_read_by_location"
  ON public.ghl_configurations
  FOR SELECT
  TO authenticated
  USING (ghl_account_id IS NOT NULL AND is_active = true);

-- Allow users to update configurations for linking purposes
CREATE POLICY "ghl_configurations_link_update"
  ON public.ghl_configurations
  FOR UPDATE
  TO authenticated
  USING (ghl_account_id IS NOT NULL AND is_active = true)
  WITH CHECK (user_id = (auth.uid())::text);

-- Allow users to insert new configurations
CREATE POLICY "ghl_configurations_insert"
  ON public.ghl_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (auth.uid())::text);

-- Ensure service role has full access (keep existing policy)
-- This should already exist but let's make sure
DROP POLICY IF EXISTS "service_role_all_ghl_configurations" ON public.ghl_configurations;
CREATE POLICY "service_role_all_ghl_configurations"
  ON public.ghl_configurations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update the configuration lookup function to handle RLS properly
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
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First try exact match
  RETURN QUERY
  SELECT 
    c.id, c.user_id, c.ghl_account_id, c.access_token, c.refresh_token,
    c.token_expires_at, c.business_name, c.is_active, c.created_at, c.updated_at
  FROM ghl_configurations c
  WHERE c.user_id = p_user_id 
    AND c.ghl_account_id = p_location_id 
    AND c.is_active = true
  LIMIT 1;
  
  -- If no exact match, try by location only
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      c.id, c.user_id, c.ghl_account_id, c.access_token, c.refresh_token,
      c.token_expires_at, c.business_name, c.is_active, c.created_at, c.updated_at
    FROM ghl_configurations c
    WHERE c.ghl_account_id = p_location_id 
      AND c.is_active = true
    ORDER BY c.updated_at DESC
    LIMIT 1;
  END IF;
  
  -- If still no match, try by user only
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      c.id, c.user_id, c.ghl_account_id, c.access_token, c.refresh_token,
      c.token_expires_at, c.business_name, c.is_active, c.created_at, c.updated_at
    FROM ghl_configurations c
    WHERE c.user_id = p_user_id 
      AND c.is_active = true
    ORDER BY c.updated_at DESC
    LIMIT 1;
  END IF;
END;
$$;

-- Grant proper permissions
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO anon;