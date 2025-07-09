/*
  # Fix Agency Branding Permissions

  1. Updates
    - Fixes the agency_can_customize_branding function
    - Updates existing agency permissions to enable branding
    - Adds proper RLS policies for agency branding access
  
  2. Security
    - Ensures agency users can access branding features
    - Maintains proper row-level security
*/

-- Function to check if agency can customize branding
CREATE OR REPLACE FUNCTION agency_can_customize_branding(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  can_customize boolean := false;
  plan_type text;
BEGIN
  -- First check if permissions record exists
  SELECT ap.can_customize_branding, ap.plan_type INTO can_customize, plan_type
  FROM agency_permissions ap
  WHERE ap.agency_ghl_id = agency_id;
  
  -- If no record exists or can_customize is false, check if user is agency type
  IF can_customize IS NULL OR can_customize = false THEN
    -- For agency users, default to true
    IF get_ghl_user_type() = 'agency' AND get_ghl_company_id() = agency_id THEN
      can_customize := true;
      
      -- Auto-create permissions record if it doesn't exist
      IF plan_type IS NULL THEN
        INSERT INTO agency_permissions 
          (agency_ghl_id, plan_type, can_use_own_openai_key, can_customize_branding)
        VALUES 
          (agency_id, 'agency', true, true)
        ON CONFLICT (agency_ghl_id) DO UPDATE SET
          can_customize_branding = true,
          updated_at = now();
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(can_customize, false);
END;
$$;

-- Update existing agency permissions to allow branding customization
UPDATE agency_permissions
SET 
  can_customize_branding = true,
  plan_type = 'agency',
  updated_at = now()
WHERE 
  agency_ghl_id IN (
    SELECT DISTINCT ghl_company_id
    FROM ghl_configurations 
    WHERE ghl_user_type = 'agency' AND ghl_company_id IS NOT NULL
  );

-- Insert default branding for agencies that don't have it
INSERT INTO agency_branding 
  (agency_ghl_id, agency_name, custom_app_name, primary_color, secondary_color, accent_color, hide_ghl_branding)
SELECT 
  DISTINCT ghl_company_id, 
  'Agency ' || LEFT(ghl_company_id, 8), -- Default agency name
  'Data Extractor', 
  '#3B82F6', 
  '#1F2937', 
  '#10B981', 
  false
FROM 
  ghl_configurations 
WHERE 
  ghl_user_type = 'agency' 
  AND ghl_company_id IS NOT NULL
  AND ghl_company_id NOT IN (SELECT agency_ghl_id FROM agency_branding)
ON CONFLICT (agency_ghl_id) DO NOTHING;

-- Function to check if user has access to agency branding
CREATE OR REPLACE FUNCTION user_has_agency_branding_access(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can access their own branding
  IF get_ghl_user_type() = 'agency' AND get_ghl_company_id() = agency_id THEN
    RETURN true;
  END IF;
  
  -- Service role can access all branding
  IF current_setting('role') = 'service_role' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Update RLS policy for agency_branding to use the new function
DROP POLICY IF EXISTS "Agency can manage own branding" ON agency_branding;
CREATE POLICY "Agency can manage own branding"
  ON agency_branding
  FOR ALL
  TO authenticated
  USING (user_has_agency_branding_access(agency_ghl_id))
  WITH CHECK (user_has_agency_branding_access(agency_ghl_id));