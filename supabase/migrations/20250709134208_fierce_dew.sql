/*
  # Add Agency White-labeling and OpenAI Key Management
  
  1. Changes
    - Add white-labeling columns to ghl_configurations
    - Create agency_openai_keys table for secure API key storage
    - Add JWT helper functions for agency identification
    - Update RLS policies for proper access control
    
  2. Security
    - Enable RLS on agency_openai_keys table
    - Encrypt OpenAI API keys in the database
    - Restrict access based on agency type and payment plan
*/

-- Add white-labeling columns to ghl_configurations
ALTER TABLE ghl_configurations 
ADD COLUMN IF NOT EXISTS agency_brand_name text,
ADD COLUMN IF NOT EXISTS agency_logo_url text;

-- Add ghl_company_id and ghl_user_type columns to ghl_configurations if they don't exist
ALTER TABLE ghl_configurations 
ADD COLUMN IF NOT EXISTS ghl_company_id text,
ADD COLUMN IF NOT EXISTS ghl_user_type text;

-- Create agency_openai_keys table
CREATE TABLE IF NOT EXISTS agency_openai_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_ghl_id text UNIQUE NOT NULL,
  encrypted_openai_api_key text NOT NULL,
  openai_org_id text,
  payment_plan text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create updated_at trigger for agency_openai_keys
CREATE OR REPLACE FUNCTION update_agency_openai_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agency_openai_keys_updated_at
  BEFORE UPDATE ON agency_openai_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_agency_openai_keys_updated_at();

-- Add JWT helper functions for agency identification
CREATE OR REPLACE FUNCTION get_ghl_company_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.jwt() ->> 'ghl_company_id';
$$;

CREATE OR REPLACE FUNCTION get_ghl_payment_plan()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'ghl_payment_plan',
    'standard'
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_ghl_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ghl_company_id() TO service_role;
GRANT EXECUTE ON FUNCTION get_ghl_payment_plan() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ghl_payment_plan() TO service_role;

-- Enable RLS on agency_openai_keys
ALTER TABLE agency_openai_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agency_openai_keys
CREATE POLICY "service_role_all_agency_openai_keys"
  ON agency_openai_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for agencies to view their own keys
CREATE POLICY "agency_openai_keys_select_own"
  ON agency_openai_keys
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id() AND
    get_ghl_payment_plan() IN ('premium', 'enterprise')
  );

-- Policy for agencies to insert their own keys
CREATE POLICY "agency_openai_keys_insert_own"
  ON agency_openai_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id() AND
    get_ghl_payment_plan() IN ('premium', 'enterprise')
  );

-- Policy for agencies to update their own keys
CREATE POLICY "agency_openai_keys_update_own"
  ON agency_openai_keys
  FOR UPDATE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id() AND
    get_ghl_payment_plan() IN ('premium', 'enterprise')
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id() AND
    get_ghl_payment_plan() IN ('premium', 'enterprise')
  );

-- Add comments for documentation
COMMENT ON TABLE agency_openai_keys IS 'Stores encrypted OpenAI API keys for premium/enterprise agencies';
COMMENT ON COLUMN agency_openai_keys.encrypted_openai_api_key IS 'AES-256-CBC encrypted OpenAI API key';
COMMENT ON COLUMN agency_openai_keys.payment_plan IS 'Agency payment plan that determines API key management access';
COMMENT ON FUNCTION get_ghl_company_id() IS 'Extract GHL company ID from JWT claims';
COMMENT ON FUNCTION get_ghl_payment_plan() IS 'Extract agency payment plan from JWT claims';

-- Drop existing function before redefining with new return type
DROP FUNCTION IF EXISTS get_user_ghl_configuration(text, text);

-- Create the updated function with new columns
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
  agency_brand_name text,
  agency_logo_url text,
  ghl_company_id text,
  ghl_user_type text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  created_by text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Single query with priority-based selection to avoid stack depth issues
  SELECT 
    gc.id,
    gc.user_id,
    gc.ghl_account_id,
    gc.client_id,
    gc.access_token,
    gc.refresh_token,
    gc.token_expires_at,
    gc.business_name,
    gc.business_address,
    gc.business_phone,
    gc.business_email,
    gc.business_website,
    gc.business_description,
    gc.target_audience,
    gc.services_offered,
    gc.business_context,
    gc.agency_brand_name,
    gc.agency_logo_url,
    gc.ghl_company_id,
    gc.ghl_user_type,
    gc.is_active,
    gc.created_at,
    gc.updated_at,
    gc.created_by
  FROM ghl_configurations gc
  WHERE gc.is_active = true
    AND (
      -- Priority 1: Exact match (user_id AND location_id)
      (gc.user_id = p_user_id AND gc.ghl_account_id = p_location_id)
      OR
      -- Priority 2: Location match only
      (gc.ghl_account_id = p_location_id AND gc.user_id IS NOT NULL)
      OR
      -- Priority 3: User match only
      (gc.user_id = p_user_id)
    )
  ORDER BY 
    -- Prioritize exact matches first
    CASE 
      WHEN gc.user_id = p_user_id AND gc.ghl_account_id = p_location_id THEN 1
      WHEN gc.ghl_account_id = p_location_id THEN 2
      WHEN gc.user_id = p_user_id THEN 3
      ELSE 4
    END,
    gc.updated_at DESC
  LIMIT 1;
$$;

-- Grant permissions to the updated function
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_ghl_configuration(text, text) TO anon;