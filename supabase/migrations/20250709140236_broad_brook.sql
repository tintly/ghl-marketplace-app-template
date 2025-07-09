/*
  # Agency White-Label System

  1. New Tables
    - `agency_branding` - Store agency branding information
    - `agency_openai_keys` - Store encrypted OpenAI keys for agencies
    - `agency_permissions` - Define what agencies can do
    
  2. Enhanced Tables
    - Add agency context to existing tables
    - Add white-label settings
    
  3. Security
    - RLS policies for agency data isolation
    - Encrypted storage for API keys
    - Permission-based access control
*/

-- Agency branding configuration
CREATE TABLE IF NOT EXISTS agency_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_ghl_id text UNIQUE NOT NULL,
  agency_name text NOT NULL,
  agency_logo_url text,
  primary_color text DEFAULT '#3B82F6',
  secondary_color text DEFAULT '#1F2937',
  accent_color text DEFAULT '#10B981',
  custom_domain text,
  support_email text,
  support_phone text,
  terms_url text,
  privacy_url text,
  footer_text text,
  hide_ghl_branding boolean DEFAULT false,
  custom_app_name text DEFAULT 'Data Extractor',
  welcome_message text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Agency permissions and plan features
CREATE TABLE IF NOT EXISTS agency_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_ghl_id text UNIQUE NOT NULL,
  plan_type text NOT NULL DEFAULT 'basic', -- basic, premium, enterprise
  max_locations integer DEFAULT 10,
  max_extractions_per_month integer DEFAULT 1000,
  can_use_own_openai_key boolean DEFAULT false,
  can_customize_branding boolean DEFAULT false,
  can_use_custom_domain boolean DEFAULT false,
  can_access_usage_analytics boolean DEFAULT false,
  can_manage_team_members boolean DEFAULT false,
  features jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enhanced agency OpenAI keys table (already exists but let's ensure it has proper structure)
DO $$
BEGIN
  -- Add additional fields if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agency_openai_keys' AND column_name = 'key_name'
  ) THEN
    ALTER TABLE agency_openai_keys ADD COLUMN key_name text DEFAULT 'Default Key';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agency_openai_keys' AND column_name = 'usage_limit_monthly'
  ) THEN
    ALTER TABLE agency_openai_keys ADD COLUMN usage_limit_monthly numeric(10,2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agency_openai_keys' AND column_name = 'current_usage_monthly'
  ) THEN
    ALTER TABLE agency_openai_keys ADD COLUMN current_usage_monthly numeric(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agency_openai_keys' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE agency_openai_keys ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Add agency context to existing tables
DO $$
BEGIN
  -- Add agency_ghl_id to ghl_configurations if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ghl_configurations' AND column_name = 'agency_ghl_id'
  ) THEN
    ALTER TABLE ghl_configurations ADD COLUMN agency_ghl_id text;
  END IF;
  
  -- Add white label settings to ghl_configurations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ghl_configurations' AND column_name = 'white_label_settings'
  ) THEN
    ALTER TABLE ghl_configurations ADD COLUMN white_label_settings jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add agency context to AI usage logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_usage_logs' AND column_name = 'agency_ghl_id'
  ) THEN
    ALTER TABLE ai_usage_logs ADD COLUMN agency_ghl_id text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_usage_logs' AND column_name = 'openai_key_used'
  ) THEN
    ALTER TABLE ai_usage_logs ADD COLUMN openai_key_used text; -- Reference to which key was used
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE agency_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agency_branding
CREATE POLICY "Agency can manage own branding"
  ON agency_branding
  FOR ALL
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

-- Allow locations to read their agency's branding
CREATE POLICY "Locations can read agency branding"
  ON agency_branding
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    agency_ghl_id IN (
      SELECT ghl_company_id 
      FROM ghl_configurations 
      WHERE ghl_account_id = get_ghl_location_id()
    )
  );

-- RLS Policies for agency_permissions
CREATE POLICY "Agency can read own permissions"
  ON agency_permissions
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id()
  );

-- Service role access for all agency tables
CREATE POLICY "service_role_all_agency_branding"
  ON agency_branding
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_agency_permissions"
  ON agency_permissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agency_branding_agency_id ON agency_branding(agency_ghl_id);
CREATE INDEX IF NOT EXISTS idx_agency_permissions_agency_id ON agency_permissions(agency_ghl_id);
CREATE INDEX IF NOT EXISTS idx_ghl_configurations_agency_id ON ghl_configurations(agency_ghl_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_agency_id ON ai_usage_logs(agency_ghl_id);

-- Function to get agency branding for a location
CREATE OR REPLACE FUNCTION get_agency_branding_for_location(location_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  branding_data jsonb;
BEGIN
  SELECT to_jsonb(ab.*) INTO branding_data
  FROM agency_branding ab
  JOIN ghl_configurations gc ON ab.agency_ghl_id = gc.ghl_company_id
  WHERE gc.ghl_account_id = location_id
    AND ab.is_active = true
  LIMIT 1;
  
  -- Return default branding if no agency branding found
  IF branding_data IS NULL THEN
    branding_data := jsonb_build_object(
      'agency_name', 'GoHighLevel',
      'custom_app_name', 'Data Extractor',
      'primary_color', '#3B82F6',
      'secondary_color', '#1F2937',
      'accent_color', '#10B981',
      'hide_ghl_branding', false
    );
  END IF;
  
  RETURN branding_data;
END;
$$;

-- Function to get agency permissions
CREATE OR REPLACE FUNCTION get_agency_permissions(agency_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  permissions_data jsonb;
BEGIN
  SELECT to_jsonb(ap.*) INTO permissions_data
  FROM agency_permissions ap
  WHERE ap.agency_ghl_id = agency_id;
  
  -- Return default permissions if none found
  IF permissions_data IS NULL THEN
    permissions_data := jsonb_build_object(
      'plan_type', 'basic',
      'max_locations', 10,
      'max_extractions_per_month', 1000,
      'can_use_own_openai_key', false,
      'can_customize_branding', false,
      'can_use_custom_domain', false,
      'can_access_usage_analytics', false,
      'can_manage_team_members', false
    );
  END IF;
  
  RETURN permissions_data;
END;
$$;

-- Function to check if agency can use custom OpenAI key
CREATE OR REPLACE FUNCTION agency_can_use_custom_openai_key(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  can_use boolean := false;
BEGIN
  SELECT ap.can_use_own_openai_key INTO can_use
  FROM agency_permissions ap
  WHERE ap.agency_ghl_id = agency_id;
  
  RETURN COALESCE(can_use, false);
END;
$$;

-- Function to get active OpenAI key for agency
CREATE OR REPLACE FUNCTION get_agency_openai_key(agency_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  api_key text;
BEGIN
  -- Only return key if agency has permission
  IF NOT agency_can_use_custom_openai_key(agency_id) THEN
    RETURN NULL;
  END IF;
  
  SELECT encrypted_openai_api_key INTO api_key
  FROM agency_openai_keys
  WHERE agency_ghl_id = agency_id
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN api_key;
END;
$$;

-- Update trigger for agency_branding
CREATE OR REPLACE FUNCTION update_agency_branding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agency_branding_updated_at
  BEFORE UPDATE ON agency_branding
  FOR EACH ROW
  EXECUTE FUNCTION update_agency_branding_updated_at();

-- Update trigger for agency_permissions
CREATE OR REPLACE FUNCTION update_agency_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agency_permissions_updated_at
  BEFORE UPDATE ON agency_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_agency_permissions_updated_at();

-- Insert default permissions for existing agencies
INSERT INTO agency_permissions (agency_ghl_id, plan_type, can_use_own_openai_key, can_customize_branding)
SELECT DISTINCT ghl_company_id, 'premium', true, true
FROM ghl_configurations 
WHERE ghl_user_type = 'agency' 
  AND ghl_company_id IS NOT NULL
  AND ghl_company_id NOT IN (SELECT agency_ghl_id FROM agency_permissions)
ON CONFLICT (agency_ghl_id) DO NOTHING;