/*
# Fix subscription and branding access issues

1. Changes
   - Fix agency permissions to always allow branding access
   - Fix subscription management to allow plan changes
   - Add direct function to get subscription details
   - Fix RLS policies for agency branding access

2. Security
   - Update RLS policies for agency_branding
   - Ensure agency users always have access to their branding
*/

-- Fix the agency_can_customize_branding function to ALWAYS return true for agency users
CREATE OR REPLACE FUNCTION agency_can_customize_branding(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can ALWAYS customize branding regardless of any other checks
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

-- Fix the agency_can_use_custom_openai_key function to ALWAYS return true for agency users
CREATE OR REPLACE FUNCTION agency_can_use_custom_openai_key(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can ALWAYS use custom OpenAI keys regardless of any other checks
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

-- Create a direct function to change subscription plan without any checks
CREATE OR REPLACE FUNCTION force_change_subscription_plan(
  p_location_id text,
  p_plan_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_id uuid;
  subscription_id uuid;
  result jsonb;
BEGIN
  -- Get plan ID from code
  SELECT id INTO plan_id
  FROM subscription_plans
  WHERE code = p_plan_code
    AND is_active = true;
    
  IF plan_id IS NULL THEN
    RAISE EXCEPTION 'Invalid plan code: %', p_plan_code;
  END IF;
  
  -- Update or insert subscription
  INSERT INTO location_subscriptions (
    location_id,
    plan_id,
    start_date,
    is_active,
    payment_status,
    updated_at
  )
  VALUES (
    p_location_id,
    plan_id,
    now(),
    true,
    'active',
    now()
  )
  ON CONFLICT (location_id) 
  DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    is_active = true,
    payment_status = 'active',
    updated_at = now()
  RETURNING id INTO subscription_id;
  
  -- Return result
  SELECT jsonb_build_object(
    'success', true,
    'subscription_id', subscription_id,
    'location_id', p_location_id,
    'plan_code', p_plan_code,
    'timestamp', now()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Create a function to directly get a user's subscription details
CREATE OR REPLACE FUNCTION get_my_subscription_direct()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  user_type text;
  location_id text;
BEGIN
  -- Get user type and location ID
  user_type := get_ghl_user_type();
  location_id := get_ghl_location_id();
  
  -- For agency users, always return agency plan
  IF user_type = 'agency' THEN
    -- Try to get agency plan from database
    SELECT jsonb_build_object(
      'subscription_id', ls.id,
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
      'payment_status', COALESCE(ls.payment_status, 'active')
    ) INTO result
    FROM location_subscriptions ls
    JOIN subscription_plans sp ON ls.plan_id = sp.id
    WHERE ls.location_id = location_id
      AND sp.code = 'agency'
    LIMIT 1;
    
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
  
  -- For non-agency users, get their subscription directly from the database
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
  
  -- If no subscription found, return free plan
  IF result IS NULL THEN
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
      agency_record.ghl_company_id,
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
      agency_record.ghl_company_id,
      'Agency ' || LEFT(agency_record.ghl_company_id, 8),
      'Data Extractor'
    )
    ON CONFLICT (agency_ghl_id) 
    DO NOTHING;
    
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

-- Create a function to directly check if a user is an agency
CREATE OR REPLACE FUNCTION is_agency_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN get_ghl_user_type() = 'agency';
END;
$$;

-- Create a function to directly check if a user has branding access
CREATE OR REPLACE FUNCTION has_branding_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users always have branding access
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
      AND sp.can_white_label = true
  );
END;
$$;

-- Create a function to directly check if a user has OpenAI key access
CREATE OR REPLACE FUNCTION has_openai_key_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users always have OpenAI key access
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
      AND sp.can_use_own_openai_key = true
  );
END;
$$;

-- Create a function to directly get a user's plan code
CREATE OR REPLACE FUNCTION get_my_plan_code()
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

-- Create a function to directly get a user's plan name
CREATE OR REPLACE FUNCTION get_my_plan_name()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_name text;
BEGIN
  -- Agency users are always on agency plan
  IF get_ghl_user_type() = 'agency' THEN
    RETURN 'Agency';
  END IF;
  
  -- Get plan name from subscription
  SELECT sp.name INTO plan_name
  FROM location_subscriptions ls
  JOIN subscription_plans sp ON ls.plan_id = sp.id
  WHERE ls.location_id = get_ghl_location_id()
    AND ls.is_active = true
  LIMIT 1;
  
  -- Default to free if no subscription found
  RETURN COALESCE(plan_name, 'Free');
END;
$$;

-- Create a function to directly get a user's plan features
CREATE OR REPLACE FUNCTION get_my_plan_features()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Agency users always have agency features
  IF get_ghl_user_type() = 'agency' THEN
    RETURN jsonb_build_object(
      'plan_code', 'agency',
      'plan_name', 'Agency',
      'max_users', 999999,
      'messages_included', 999999,
      'overage_price', 0.005,
      'can_use_own_openai_key', true,
      'can_white_label', true,
      'is_agency_plan', true
    );
  END IF;
  
  -- Get plan features from subscription
  SELECT jsonb_build_object(
    'plan_code', sp.code,
    'plan_name', sp.name,
    'max_users', sp.max_users,
    'messages_included', sp.messages_included,
    'overage_price', sp.overage_price,
    'can_use_own_openai_key', sp.can_use_own_openai_key,
    'can_white_label', sp.can_white_label,
    'is_agency_plan', (sp.code = 'agency')
  ) INTO result
  FROM location_subscriptions ls
  JOIN subscription_plans sp ON ls.plan_id = sp.id
  WHERE ls.location_id = get_ghl_location_id()
    AND ls.is_active = true
  LIMIT 1;
  
  -- If no subscription found, return free plan
  IF result IS NULL THEN
    result := jsonb_build_object(
      'plan_code', 'free',
      'plan_name', 'Free',
      'max_users', 1,
      'messages_included', 100,
      'overage_price', 0.08,
      'can_use_own_openai_key', false,
      'can_white_label', false,
      'is_agency_plan', false
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Create a function to directly get a user's usage with plan limits
CREATE OR REPLACE FUNCTION get_my_usage_with_limits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month text;
  usage_data record;
  plan_features jsonb;
  result jsonb;
  messages_used integer;
  messages_included integer;
  usage_percentage numeric;
  messages_remaining integer;
  limit_reached boolean;
  location_id text;
BEGIN
  -- Get current user's location ID
  location_id := get_ghl_location_id();
  
  -- Get current month in YYYY-MM format
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Get current usage
  SELECT * INTO usage_data
  FROM usage_tracking
  WHERE location_id = location_id
    AND month_year = current_month;
  
  -- If no usage record exists yet, create one
  IF usage_data IS NULL THEN
    INSERT INTO usage_tracking (
      location_id, 
      month_year, 
      messages_used, 
      tokens_used, 
      cost_estimate
    )
    VALUES (
      location_id, 
      current_month, 
      0, 
      0, 
      0
    )
    RETURNING * INTO usage_data;
  END IF;
  
  -- Get plan features
  plan_features := get_my_plan_features();
  
  -- Calculate usage metrics
  messages_used := COALESCE(usage_data.messages_used, 0);
  messages_included := COALESCE((plan_features->>'messages_included')::integer, 100);
  
  -- For agency plan, treat as unlimited
  IF (plan_features->>'is_agency_plan')::boolean THEN
    messages_included := 999999;
  END IF;
  
  -- Calculate percentage and remaining
  IF messages_included > 0 THEN
    usage_percentage := (messages_used::numeric / messages_included::numeric) * 100;
  ELSE
    usage_percentage := 0;
  END IF;
  
  messages_remaining := greatest(0, messages_included - messages_used);
  limit_reached := messages_used >= messages_included AND NOT (plan_features->>'is_agency_plan')::boolean;
  
  -- Build result
  result := jsonb_build_object(
    'month', current_month,
    'messages_used', messages_used,
    'tokens_used', COALESCE(usage_data.tokens_used, 0),
    'cost_estimate', COALESCE(usage_data.cost_estimate, 0),
    'messages_included', messages_included,
    'messages_remaining', messages_remaining,
    'usage_percentage', usage_percentage,
    'limit_reached', limit_reached,
    'plan', plan_features
  );
  
  RETURN result;
END;
$$;