/*
  # Fix Agency Permissions

  1. Changes
     - Fixes issue where agency users can't access branding features
     - Adds direct permission check for agency users
     - Updates existing agency permissions
     - Ensures agency users always have branding access
*/

-- Fix the agency_can_customize_branding function to always return true for agency users
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
  
  -- Agency users can ALWAYS customize their own branding
  IF user_type = 'agency' THEN
    RETURN true;
  END IF;
  
  -- Check permissions table as fallback
  SELECT ap.can_customize_branding INTO can_customize
  FROM agency_permissions ap
  WHERE ap.agency_ghl_id = agency_id;
  
  RETURN COALESCE(can_customize, false);
END;
$$;

-- Fix the agency_can_use_custom_openai_key function to always return true for agency users
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
  
  -- Agency users can ALWAYS use their own OpenAI keys
  IF user_type = 'agency' THEN
    RETURN true;
  END IF;
  
  -- Check permissions table as fallback
  SELECT ap.can_use_own_openai_key INTO can_use
  FROM agency_permissions ap
  WHERE ap.agency_ghl_id = agency_id;
  
  RETURN COALESCE(can_use, false);
END;
$$;

-- Update all agency permissions to ensure they have branding access
UPDATE agency_permissions
SET 
  can_customize_branding = true,
  can_use_own_openai_key = true,
  plan_type = 'agency',
  updated_at = now()
WHERE 
  agency_ghl_id IN (
    SELECT DISTINCT ghl_company_id
    FROM ghl_configurations 
    WHERE ghl_user_type = 'agency' AND ghl_company_id IS NOT NULL
  );

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

-- Create a function to directly check if a user is on the agency plan
CREATE OR REPLACE FUNCTION is_agency_plan_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users are always on agency plan
  IF get_ghl_user_type() = 'agency' THEN
    RETURN true;
  END IF;
  
  -- Check subscription plan
  RETURN EXISTS (
    SELECT 1
    FROM location_subscriptions ls
    JOIN subscription_plans sp ON ls.plan_id = sp.id
    WHERE ls.location_id = get_ghl_location_id()
      AND ls.is_active = true
      AND sp.code = 'agency'
  );
END;
$$;

-- Create a function to get user's plan type
CREATE OR REPLACE FUNCTION get_user_plan_type()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_code text;
BEGIN
  -- Agency users are always on agency plan
  IF get_ghl_user_type() = 'agency' THEN
    RETURN 'agency';
  END IF;
  
  -- Get plan code from subscription
  SELECT sp.code INTO plan_code
  FROM location_subscriptions ls
  JOIN subscription_plans sp ON ls.plan_id = sp.id
  WHERE ls.location_id = get_ghl_location_id()
    AND ls.is_active = true
  LIMIT 1;
  
  -- Default to free if no subscription found
  RETURN COALESCE(plan_code, 'free');
END;
$$;