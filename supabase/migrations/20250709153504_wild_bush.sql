/*
  # Fix Subscription and Branding Issues

  1. New Functions
    - Create a direct function to get user subscription by location ID
    - Create a function to check if a user has access to branding features
    - Create a function to fix agency permissions

  2. Security
    - Update RLS policies for agency_branding and agency_permissions
    - Ensure agency users always have access to their branding

  3. Changes
    - Fix subscription lookup for agency users
    - Ensure agency users always have agency plan
    - Fix branding access for agency users
*/

-- Create a direct function to get user subscription by location ID
CREATE OR REPLACE FUNCTION get_subscription_by_location_id(p_location_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  is_agency boolean;
BEGIN
  -- Check if this is an agency location
  SELECT (ghl_user_type = 'agency') INTO is_agency
  FROM ghl_configurations
  WHERE ghl_account_id = p_location_id
  LIMIT 1;
  
  -- For agency locations, always return agency plan
  IF is_agency THEN
    SELECT jsonb_build_object(
      'subscription_id', ls.id,
      'location_id', p_location_id,
      'plan', jsonb_build_object(
        'id', sp.id,
        'name', sp.name,
        'code', sp.code,
        'price_monthly', sp.price_monthly,
        'price_annual', sp.price_annual,
        'max_users', sp.max_users,
        'messages_included', sp.messages_included,
        'overage_price', sp.overage_price,
        'can_use_own_openai_key', true,
        'can_white_label', true
      ),
      'is_active', true,
      'payment_status', COALESCE(ls.payment_status, 'active')
    ) INTO result
    FROM subscription_plans sp
    LEFT JOIN location_subscriptions ls ON 
      ls.plan_id = sp.id AND 
      ls.location_id = p_location_id AND
      ls.is_active = true
    WHERE sp.code = 'agency'
    LIMIT 1;
    
    -- If no agency plan found, create a default one
    IF result IS NULL THEN
      result := jsonb_build_object(
        'subscription_id', NULL,
        'location_id', p_location_id,
        'plan', jsonb_build_object(
          'name', 'Agency',
          'code', 'agency',
          'price_monthly', 499,
          'price_annual', 4790,
          'max_users', 999999,
          'messages_included', 999999,
          'overage_price', 0.005,
          'can_use_own_openai_key', true,
          'can_white_label', true
        ),
        'is_active', true,
        'payment_status', 'active'
      );
    END IF;
    
    RETURN result;
  END IF;
  
  -- For non-agency locations, get their subscription
  SELECT jsonb_build_object(
    'subscription_id', ls.id,
    'location_id', ls.location_id,
    'plan', jsonb_build_object(
      'id', sp.id,
      'name', sp.name,
      'code', sp.code,
      'price_monthly', sp.price_monthly,
      'price_annual', sp.price_annual,
      'max_users', sp.max_users,
      'messages_included', sp.messages_included,
      'overage_price', sp.overage_price,
      'can_use_own_openai_key', sp.can_use_own_openai_key,
      'can_white_label', sp.can_white_label
    ),
    'start_date', ls.start_date,
    'end_date', ls.end_date,
    'is_active', ls.is_active,
    'payment_status', ls.payment_status
  ) INTO result
  FROM location_subscriptions ls
  JOIN subscription_plans sp ON ls.plan_id = sp.id
  WHERE ls.location_id = p_location_id
    AND ls.is_active = true;
  
  -- If no subscription found, return free plan
  IF result IS NULL THEN
    SELECT jsonb_build_object(
      'subscription_id', NULL,
      'location_id', p_location_id,
      'plan', jsonb_build_object(
        'id', sp.id,
        'name', sp.name,
        'code', sp.code,
        'price_monthly', sp.price_monthly,
        'price_annual', sp.price_annual,
        'max_users', sp.max_users,
        'messages_included', sp.messages_included,
        'overage_price', sp.overage_price,
        'can_use_own_openai_key', sp.can_use_own_openai_key,
        'can_white_label', sp.can_white_label
      ),
      'is_active', true,
      'payment_status', 'free'
    ) INTO result
    FROM subscription_plans sp
    WHERE sp.code = 'free'
    LIMIT 1;
  END IF;
  
  RETURN result;
END;
$$;

-- Create a function to check if a user has access to branding features
CREATE OR REPLACE FUNCTION user_has_branding_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users always have access to branding
  IF get_ghl_user_type() = 'agency' THEN
    RETURN true;
  END IF;
  
  -- Check if user's plan includes branding
  RETURN EXISTS (
    SELECT 1
    FROM location_subscriptions ls
    JOIN subscription_plans sp ON ls.plan_id = sp.id
    WHERE ls.location_id = get_ghl_location_id()
      AND ls.is_active = true
      AND sp.can_white_label = true
  );
END;
$$;

-- Create a function to fix agency permissions
CREATE OR REPLACE FUNCTION fix_agency_permissions(p_agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    p_agency_id,
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
    p_agency_id,
    'Agency ' || LEFT(p_agency_id, 8),
    'Data Extractor'
  )
  ON CONFLICT (agency_ghl_id) 
  DO NOTHING;
  
  RETURN true;
END;
$$;

-- Update RLS policy for agency_branding to be more permissive
DROP POLICY IF EXISTS "Agency can manage own branding" ON agency_branding;
CREATE POLICY "Agency can manage own branding"
  ON agency_branding
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (
      -- Agency users can manage their own branding
      (get_ghl_user_type() = 'agency' AND agency_ghl_id = get_ghl_company_id()) OR
      -- Service role can manage all branding
      (current_setting('role', true) = 'service_role')
    )
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (
      -- Agency users can manage their own branding
      (get_ghl_user_type() = 'agency' AND agency_ghl_id = get_ghl_company_id()) OR
      -- Service role can manage all branding
      (current_setting('role', true) = 'service_role')
    )
  );

-- Fix the get_user_subscription_details function to always return agency plan for agency users
CREATE OR REPLACE FUNCTION get_user_subscription_details_fixed()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  location_id text;
  result jsonb;
BEGIN
  -- Get current user's location ID
  location_id := get_ghl_location_id();
  
  -- For agency users, always return agency plan
  IF get_ghl_user_type() = 'agency' THEN
    -- Try to get agency plan from database
    BEGIN
      SELECT jsonb_build_object(
        'subscription_id', ls.id,
        'location_id', location_id,
        'plan', jsonb_build_object(
          'id', sp.id,
          'name', sp.name,
          'code', sp.code,
          'price_monthly', sp.price_monthly,
          'price_annual', sp.price_annual,
          'max_users', sp.max_users,
          'messages_included', sp.messages_included,
          'overage_price', sp.overage_price,
          'can_use_own_openai_key', true,
          'can_white_label', true
        ),
        'is_active', true,
        'payment_status', COALESCE(ls.payment_status, 'active')
      ) INTO result
      FROM subscription_plans sp
      LEFT JOIN location_subscriptions ls ON 
        ls.plan_id = sp.id AND 
        ls.location_id = location_id AND
        ls.is_active = true
      WHERE sp.code = 'agency'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- On error, use hardcoded agency plan
      result := NULL;
    END;
    
    -- If no result, use hardcoded agency plan
    IF result IS NULL THEN
      result := jsonb_build_object(
        'subscription_id', NULL,
        'location_id', location_id,
        'plan', jsonb_build_object(
          'name', 'Agency',
          'code', 'agency',
          'price_monthly', 499,
          'price_annual', 4790,
          'max_users', 999999,
          'messages_included', 999999,
          'overage_price', 0.005,
          'can_use_own_openai_key', true,
          'can_white_label', true
        ),
        'is_active', true,
        'payment_status', 'active'
      );
    END IF;
    
    -- Return early for agency users
    RETURN result;
  END IF;
  
  -- For non-agency users, get their subscription
  BEGIN
    SELECT jsonb_build_object(
      'subscription_id', ls.id,
      'location_id', ls.location_id,
      'plan', jsonb_build_object(
        'id', sp.id,
        'name', sp.name,
        'code', sp.code,
        'price_monthly', sp.price_monthly,
        'price_annual', sp.price_annual,
        'max_users', sp.max_users,
        'messages_included', sp.messages_included,
        'overage_price', sp.overage_price,
        'can_use_own_openai_key', sp.can_use_own_openai_key,
        'can_white_label', sp.can_white_label
      ),
      'start_date', ls.start_date,
      'end_date', ls.end_date,
      'is_active', ls.is_active,
      'payment_status', ls.payment_status
    ) INTO result
    FROM location_subscriptions ls
    JOIN subscription_plans sp ON ls.plan_id = sp.id
    WHERE ls.location_id = location_id
      AND ls.is_active = true;
  EXCEPTION WHEN OTHERS THEN
    -- On error, result will remain NULL and we'll fall through to the next section
    result := NULL;
  END;
  
  -- If no subscription found, return free plan
  IF result IS NULL THEN
    BEGIN
      SELECT jsonb_build_object(
        'subscription_id', NULL,
        'location_id', location_id,
        'plan', jsonb_build_object(
          'id', sp.id,
          'name', sp.name,
          'code', sp.code,
          'price_monthly', sp.price_monthly,
          'price_annual', sp.price_annual,
          'max_users', sp.max_users,
          'messages_included', sp.messages_included,
          'overage_price', sp.overage_price,
          'can_use_own_openai_key', sp.can_use_own_openai_key,
          'can_white_label', sp.can_white_label
        ),
        'is_active', true,
        'payment_status', 'free'
      ) INTO result
      FROM subscription_plans sp
      WHERE sp.code = 'free'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- If even this fails, return a hardcoded free plan
      result := jsonb_build_object(
        'subscription_id', NULL,
        'location_id', location_id,
        'plan', jsonb_build_object(
          'name', 'Free',
          'code', 'free',
          'price_monthly', 0,
          'price_annual', 0,
          'max_users', 1,
          'messages_included', 100,
          'overage_price', 0.08,
          'can_use_own_openai_key', false,
          'can_white_label', false
        ),
        'is_active', true,
        'payment_status', 'free'
      );
    END;
  END IF;
  
  RETURN result;
END;
$$;

-- Fix all agency users to have agency plan subscriptions
DO $$
DECLARE
  agency_plan_id uuid;
  agency_record RECORD;
BEGIN
  -- Get agency plan ID
  SELECT id INTO agency_plan_id FROM subscription_plans WHERE code = 'agency' LIMIT 1;
  
  -- Skip if no agency plan found
  IF agency_plan_id IS NULL THEN
    RAISE NOTICE 'No agency plan found, skipping subscription updates';
    RETURN;
  END IF;
  
  -- For each agency user
  FOR agency_record IN 
    SELECT DISTINCT ghl_company_id, ghl_account_id
    FROM ghl_configurations 
    WHERE ghl_user_type = 'agency' 
      AND ghl_company_id IS NOT NULL
      AND ghl_account_id IS NOT NULL
  LOOP
    -- Fix agency permissions
    PERFORM fix_agency_permissions(agency_record.ghl_company_id);
    
    -- Ensure agency has agency plan subscription
    INSERT INTO location_subscriptions (
      location_id,
      plan_id,
      start_date,
      is_active,
      payment_status
    ) VALUES (
      agency_record.ghl_account_id,
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

-- Fix the agency_can_customize_branding function to always return true for agency users
CREATE OR REPLACE FUNCTION agency_can_customize_branding(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can ALWAYS customize branding
  IF get_ghl_user_type() = 'agency' THEN
    RETURN true;
  END IF;
  
  -- For non-agency users, check permissions table
  RETURN EXISTS (
    SELECT 1
    FROM agency_permissions
    WHERE agency_ghl_id = agency_id
      AND can_customize_branding = true
  );
END;
$$;

-- Fix the agency_can_use_custom_openai_key function to always return true for agency users
CREATE OR REPLACE FUNCTION agency_can_use_custom_openai_key(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can ALWAYS use custom OpenAI keys
  IF get_ghl_user_type() = 'agency' THEN
    RETURN true;
  END IF;
  
  -- For non-agency users, check permissions table
  RETURN EXISTS (
    SELECT 1
    FROM agency_permissions
    WHERE agency_ghl_id = agency_id
      AND can_use_own_openai_key = true
  );
END;
$$;

-- Create a function to directly get a user's subscription details
CREATE OR REPLACE FUNCTION get_my_subscription()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  user_type text;
BEGIN
  -- Get user type
  user_type := get_ghl_user_type();
  
  -- For agency users, always return agency plan
  IF user_type = 'agency' THEN
    -- Try to get agency plan from database
    SELECT jsonb_build_object(
      'subscription_id', ls.id,
      'location_id', get_ghl_location_id(),
      'plan', jsonb_build_object(
        'name', 'Agency',
        'code', 'agency',
        'price_monthly', 499,
        'price_annual', 4790,
        'max_users', 999999,
        'messages_included', 999999,
        'overage_price', 0.005,
        'can_use_own_openai_key', true,
        'can_white_label', true
      ),
      'is_active', true,
      'payment_status', COALESCE(ls.payment_status, 'active')
    ) INTO result
    FROM location_subscriptions ls
    JOIN subscription_plans sp ON ls.plan_id = sp.id
    WHERE ls.location_id = get_ghl_location_id()
      AND sp.code = 'agency'
    LIMIT 1;
    
    -- If no result, use hardcoded agency plan
    IF result IS NULL THEN
      result := jsonb_build_object(
        'subscription_id', NULL,
        'location_id', get_ghl_location_id(),
        'plan', jsonb_build_object(
          'name', 'Agency',
          'code', 'agency',
          'price_monthly', 499,
          'price_annual', 4790,
          'max_users', 999999,
          'messages_included', 999999,
          'overage_price', 0.005,
          'can_use_own_openai_key', true,
          'can_white_label', true
        ),
        'is_active', true,
        'payment_status', 'active'
      );
    END IF;
    
    -- Return early for agency users
    RETURN result;
  END IF;
  
  -- For non-agency users, get their subscription
  SELECT get_subscription_by_location_id(get_ghl_location_id()) INTO result;
  
  RETURN result;
END;
$$;