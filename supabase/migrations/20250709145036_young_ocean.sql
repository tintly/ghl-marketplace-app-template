/*
  # Fix Agency Permissions

  1. Updates
    - Update agency_permissions table to correctly set can_use_own_openai_key for agency plans
    - Fix the agency_can_use_custom_openai_key function to properly check plan type
    
  2. Changes
    - Adds a function to get payment plan from user type
    - Updates existing agency permissions to allow OpenAI key usage
*/

-- Function to get payment plan from user type
CREATE OR REPLACE FUNCTION get_ghl_payment_plan()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 
    CASE 
      WHEN get_ghl_user_type() = 'agency' THEN 'agency'
      ELSE 'location'
    END;
$$;

-- Fix the agency_can_use_custom_openai_key function
CREATE OR REPLACE FUNCTION agency_can_use_custom_openai_key(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  can_use boolean := false;
  plan_type text;
BEGIN
  -- First check if permissions record exists
  SELECT ap.can_use_own_openai_key, ap.plan_type INTO can_use, plan_type
  FROM agency_permissions ap
  WHERE ap.agency_ghl_id = agency_id;
  
  -- If no record exists or can_use is false, check if user is agency type
  IF can_use IS NULL OR can_use = false THEN
    -- For agency users, default to true
    IF get_ghl_user_type() = 'agency' AND get_ghl_company_id() = agency_id THEN
      can_use := true;
      
      -- Auto-create permissions record if it doesn't exist
      IF plan_type IS NULL THEN
        INSERT INTO agency_permissions 
          (agency_ghl_id, plan_type, can_use_own_openai_key, can_customize_branding)
        VALUES 
          (agency_id, 'agency', true, true)
        ON CONFLICT (agency_ghl_id) DO UPDATE SET
          can_use_own_openai_key = true,
          can_customize_branding = true,
          updated_at = now();
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(can_use, false);
END;
$$;

-- Update existing agency permissions to allow OpenAI key usage
UPDATE agency_permissions
SET 
  can_use_own_openai_key = true,
  can_customize_branding = true,
  plan_type = 'agency',
  updated_at = now()
WHERE 
  agency_ghl_id IN (
    SELECT DISTINCT ghl_company_id
    FROM ghl_configurations 
    WHERE ghl_user_type = 'agency' AND ghl_company_id IS NOT NULL
  );

-- Insert permissions for any agencies that don't have them
INSERT INTO agency_permissions 
  (agency_ghl_id, plan_type, can_use_own_openai_key, can_customize_branding)
SELECT 
  DISTINCT ghl_company_id, 'agency', true, true
FROM 
  ghl_configurations 
WHERE 
  ghl_user_type = 'agency' 
  AND ghl_company_id IS NOT NULL
  AND ghl_company_id NOT IN (SELECT agency_ghl_id FROM agency_permissions)
ON CONFLICT (agency_ghl_id) DO NOTHING;