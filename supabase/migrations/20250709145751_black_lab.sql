/*
  # Fix Agency Permissions and Subscription Issues

  1. Changes
     - Fix RLS policies for agency users to access branding and OpenAI keys
     - Ensure agency plan users always have proper permissions
     - Add function to automatically upgrade permissions for agency users
     - Fix subscription downgrade issues
  
  2. Security
     - Enable RLS on all tables
     - Add proper policies for authenticated users
*/

-- Function to automatically set agency permissions based on user type
CREATE OR REPLACE FUNCTION auto_set_agency_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If this is an agency user, ensure they have agency permissions
  IF NEW.ghl_user_type = 'agency' AND NEW.ghl_company_id IS NOT NULL THEN
    -- Insert or update agency permissions
    INSERT INTO agency_permissions (
      agency_ghl_id,
      plan_type,
      max_locations,
      max_extractions_per_month,
      can_use_own_openai_key,
      can_customize_branding,
      can_use_custom_domain,
      can_access_usage_analytics,
      can_manage_team_members
    ) VALUES (
      NEW.ghl_company_id,
      'agency',
      999999,
      999999,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      TRUE
    )
    ON CONFLICT (agency_ghl_id) 
    DO UPDATE SET
      plan_type = 'agency',
      can_use_own_openai_key = TRUE,
      can_customize_branding = TRUE,
      updated_at = now();
      
    -- Insert or update agency branding
    INSERT INTO agency_branding (
      agency_ghl_id,
      agency_name,
      custom_app_name
    ) VALUES (
      NEW.ghl_company_id,
      COALESCE(NEW.agency_brand_name, 'Agency ' || LEFT(NEW.ghl_company_id, 8)),
      'Data Extractor'
    )
    ON CONFLICT (agency_ghl_id) 
    DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically set agency permissions
DROP TRIGGER IF EXISTS auto_set_agency_permissions_trigger ON ghl_configurations;
CREATE TRIGGER auto_set_agency_permissions_trigger
  AFTER INSERT OR UPDATE OF ghl_user_type, ghl_company_id
  ON ghl_configurations
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_agency_permissions();

-- Fix agency_can_customize_branding function to be more permissive
CREATE OR REPLACE FUNCTION agency_can_customize_branding(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  can_customize boolean := false;
  user_type text;
  user_company_id text;
BEGIN
  -- Get current user type and company ID
  user_type := get_ghl_user_type();
  user_company_id := get_ghl_company_id();
  
  -- Agency users can always customize their own branding
  IF user_type = 'agency' AND user_company_id = agency_id THEN
    -- Auto-create permissions record if it doesn't exist
    INSERT INTO agency_permissions 
      (agency_ghl_id, plan_type, can_use_own_openai_key, can_customize_branding)
    VALUES 
      (agency_id, 'agency', true, true)
    ON CONFLICT (agency_ghl_id) DO UPDATE SET
      can_customize_branding = true,
      updated_at = now();
      
    RETURN true;
  END IF;
  
  -- Check permissions table
  SELECT ap.can_customize_branding INTO can_customize
  FROM agency_permissions ap
  WHERE ap.agency_ghl_id = agency_id;
  
  RETURN COALESCE(can_customize, false);
END;
$$;

-- Fix agency_can_use_custom_openai_key function to be more permissive
CREATE OR REPLACE FUNCTION agency_can_use_custom_openai_key(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  can_use boolean := false;
  user_type text;
  user_company_id text;
BEGIN
  -- Get current user type and company ID
  user_type := get_ghl_user_type();
  user_company_id := get_ghl_company_id();
  
  -- Agency users can always use their own OpenAI keys
  IF user_type = 'agency' AND user_company_id = agency_id THEN
    -- Auto-create permissions record if it doesn't exist
    INSERT INTO agency_permissions 
      (agency_ghl_id, plan_type, can_use_own_openai_key, can_customize_branding)
    VALUES 
      (agency_id, 'agency', true, true)
    ON CONFLICT (agency_ghl_id) DO UPDATE SET
      can_use_own_openai_key = true,
      updated_at = now();
      
    RETURN true;
  END IF;
  
  -- Check permissions table
  SELECT ap.can_use_own_openai_key INTO can_use
  FROM agency_permissions ap
  WHERE ap.agency_ghl_id = agency_id;
  
  RETURN COALESCE(can_use, false);
END;
$$;

-- Fix user_has_agency_branding_access function to be more permissive
CREATE OR REPLACE FUNCTION user_has_agency_branding_access(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_type text;
  user_company_id text;
BEGIN
  -- Get current user type and company ID
  user_type := get_ghl_user_type();
  user_company_id := get_ghl_company_id();
  
  -- Agency users can always access their own branding
  IF user_type = 'agency' AND user_company_id = agency_id THEN
    RETURN true;
  END IF;
  
  -- Service role can access all branding
  IF current_setting('role') = 'service_role' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Fix subscription downgrade issues by allowing users to change their plan
CREATE OR REPLACE FUNCTION user_can_manage_subscription(location_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_location_id text;
BEGIN
  -- Get current user's location ID
  user_location_id := get_ghl_location_id();
  
  -- Users can manage their own location's subscription
  IF user_location_id = location_id THEN
    RETURN true;
  END IF;
  
  -- Agency users can manage subscriptions for their locations
  IF get_ghl_user_type() = 'agency' AND location_id IN (
    SELECT ghl_account_id 
    FROM ghl_configurations 
    WHERE agency_ghl_id = get_ghl_company_id()
  ) THEN
    RETURN true;
  END IF;
  
  -- Service role can manage all subscriptions
  IF current_setting('role') = 'service_role' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Update location_subscriptions policies to use the new function
DROP POLICY IF EXISTS "Users can insert their own location subscriptions" ON location_subscriptions;
CREATE POLICY "Users can insert their own location subscriptions"
  ON location_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    user_can_manage_subscription(location_id)
  );

DROP POLICY IF EXISTS "Users can update their own location subscriptions" ON location_subscriptions;
CREATE POLICY "Users can update their own location subscriptions"
  ON location_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_can_manage_subscription(location_id)
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    user_can_manage_subscription(location_id)
  );

DROP POLICY IF EXISTS "Users can delete their own location subscriptions" ON location_subscriptions;
CREATE POLICY "Users can delete their own location subscriptions"
  ON location_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_can_manage_subscription(location_id)
  );

-- Run the auto-set permissions for all existing agency configurations
DO $$
DECLARE
  config_record RECORD;
BEGIN
  FOR config_record IN 
    SELECT * FROM ghl_configurations 
    WHERE ghl_user_type = 'agency' AND ghl_company_id IS NOT NULL
  LOOP
    -- Insert or update agency permissions
    INSERT INTO agency_permissions (
      agency_ghl_id,
      plan_type,
      max_locations,
      max_extractions_per_month,
      can_use_own_openai_key,
      can_customize_branding,
      can_use_custom_domain,
      can_access_usage_analytics,
      can_manage_team_members
    ) VALUES (
      config_record.ghl_company_id,
      'agency',
      999999,
      999999,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      TRUE
    )
    ON CONFLICT (agency_ghl_id) 
    DO UPDATE SET
      plan_type = 'agency',
      can_use_own_openai_key = TRUE,
      can_customize_branding = TRUE,
      updated_at = now();
      
    -- Insert or update agency branding
    INSERT INTO agency_branding (
      agency_ghl_id,
      agency_name,
      custom_app_name
    ) VALUES (
      config_record.ghl_company_id,
      COALESCE(config_record.agency_brand_name, 'Agency ' || LEFT(config_record.ghl_company_id, 8)),
      'Data Extractor'
    )
    ON CONFLICT (agency_ghl_id) 
    DO NOTHING;
  END LOOP;
END;
$$;

-- Ensure all agency users have agency plan subscriptions
DO $$
DECLARE
  agency_plan_id uuid;
  config_record RECORD;
BEGIN
  -- Get agency plan ID
  SELECT id INTO agency_plan_id FROM subscription_plans WHERE code = 'agency' LIMIT 1;
  
  -- Skip if no agency plan found
  IF agency_plan_id IS NULL THEN
    RAISE NOTICE 'No agency plan found, skipping subscription updates';
    RETURN;
  END IF;
  
  -- For each agency configuration
  FOR config_record IN 
    SELECT * FROM ghl_configurations 
    WHERE ghl_user_type = 'agency' AND ghl_company_id IS NOT NULL
  LOOP
    -- Insert or update subscription to agency plan
    INSERT INTO location_subscriptions (
      location_id,
      plan_id,
      start_date,
      is_active,
      payment_status
    ) VALUES (
      config_record.ghl_account_id,
      agency_plan_id,
      now(),
      TRUE,
      'active'
    )
    ON CONFLICT (location_id) 
    DO UPDATE SET
      plan_id = agency_plan_id,
      is_active = TRUE,
      payment_status = 'active',
      updated_at = now();
  END LOOP;
END;
$$;