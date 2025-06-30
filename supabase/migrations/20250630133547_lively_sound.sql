/*
  # Fix user_id access and indexing for ghl_configurations

  1. Indexing
    - Ensure proper composite indexes for efficient lookups
    - Add index for user_id + ghl_account_id combination
    - Add index for ghl_account_id + is_active combination

  2. RLS Policy Updates
    - Update policies to ensure user_id searches work properly
    - Add policy for service role access
    - Ensure policies allow proper user linking

  3. Performance Optimization
    - Add composite indexes for common query patterns
    - Optimize for both user_id and ghl_account_id lookups
*/

-- Add composite indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ghl_configurations_user_location 
ON public.ghl_configurations USING btree (user_id, ghl_account_id);

CREATE INDEX IF NOT EXISTS idx_ghl_configurations_location_active 
ON public.ghl_configurations USING btree (ghl_account_id, is_active);

CREATE INDEX IF NOT EXISTS idx_ghl_configurations_user_active 
ON public.ghl_configurations USING btree (user_id, is_active);

-- Ensure the existing user_id index is properly created
CREATE INDEX IF NOT EXISTS idx_ghl_configurations_user_id_btree 
ON public.ghl_configurations USING btree (user_id);

-- Update RLS policies to ensure proper access patterns
-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "ghl_configs_all_own" ON public.ghl_configurations;
DROP POLICY IF EXISTS "ghl_configs_select_own" ON public.ghl_configurations;

-- Create comprehensive RLS policies
CREATE POLICY "ghl_configurations_user_access"
  ON public.ghl_configurations
  FOR ALL
  TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

-- Allow users to access configurations by location (for linking)
CREATE POLICY "ghl_configurations_location_access"
  ON public.ghl_configurations
  FOR SELECT
  TO authenticated
  USING (ghl_account_id IS NOT NULL AND is_active = true);

-- Allow users to update configurations they have access to (for linking)
CREATE POLICY "ghl_configurations_location_update"
  ON public.ghl_configurations
  FOR UPDATE
  TO authenticated
  USING (ghl_account_id IS NOT NULL AND is_active = true)
  WITH CHECK (user_id = (auth.uid())::text);

-- Ensure service role has full access (keep existing policy)
CREATE POLICY "service_role_all_ghl_configurations"
  ON public.ghl_configurations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add a function to help with configuration lookup
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO service_role;