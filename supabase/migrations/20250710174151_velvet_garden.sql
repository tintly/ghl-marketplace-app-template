/*
  # Fix Agency OpenAI Keys RLS Policy

  1. Changes
    - Update RLS policies for agency_openai_keys table
    - Make policies more permissive for agency users
    - Fix permission checks for OpenAI key management
    
  2. Security
    - Maintain security while allowing proper access
    - Ensure agency users can manage their own keys
*/

-- Drop existing policies for agency_openai_keys
DROP POLICY IF EXISTS "agency_openai_keys_select_own" ON agency_openai_keys;
DROP POLICY IF EXISTS "agency_openai_keys_insert_own" ON agency_openai_keys;
DROP POLICY IF EXISTS "agency_openai_keys_update_own" ON agency_openai_keys;

-- Create more permissive policies for agency users
CREATE POLICY "agency_openai_keys_select_own"
  ON agency_openai_keys
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id()
  );

CREATE POLICY "agency_openai_keys_insert_own"
  ON agency_openai_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id()
  );

CREATE POLICY "agency_openai_keys_update_own"
  ON agency_openai_keys
  FOR UPDATE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id()
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id()
  );

-- Create a delete policy
CREATE POLICY "agency_openai_keys_delete_own"
  ON agency_openai_keys
  FOR DELETE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id()
  );

-- Create a function to check if a user can manage OpenAI keys
CREATE OR REPLACE FUNCTION user_can_manage_openai_keys()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can always manage OpenAI keys
  IF get_ghl_user_type() = 'agency' THEN
    RETURN true;
  END IF;
  
  -- For non-agency users, check subscription plan
  RETURN EXISTS (
    SELECT 1
    FROM location_subscriptions ls
    JOIN subscription_plans sp ON ls.plan_id = sp.id
    WHERE ls.location_id = get_ghl_location_id()
      AND ls.is_active = true
      AND sp.can_use_own_openai_key = true
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION user_can_manage_openai_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_manage_openai_keys() TO service_role;