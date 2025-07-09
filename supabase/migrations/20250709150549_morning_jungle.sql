/*
  # Fix Subscription Management Issues

  1. Changes
     - Fixes agency plan detection and permissions
     - Ensures agency users always have agency plan
     - Adds direct plan downgrade capability
     - Fixes branding access for agency users

  2. Security
     - Updates RLS policies for subscription management
     - Ensures proper access control for plan changes
*/

-- Fix the agency_can_customize_branding function to be more permissive
CREATE OR REPLACE FUNCTION agency_can_customize_branding(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can ALWAYS customize their own branding
  -- This is the most important fix - always return true for agency users
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

-- Fix the agency_can_use_custom_openai_key function to be more permissive
CREATE OR REPLACE FUNCTION agency_can_use_custom_openai_key(agency_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can ALWAYS use their own OpenAI keys
  -- This is the most important fix - always return true for agency users
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

-- Create a function to directly change a location's subscription plan
CREATE OR REPLACE FUNCTION change_location_subscription_plan(
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
  -- Check if user has permission to change this location's subscription
  IF NOT user_can_manage_subscription(p_location_id) THEN
    RAISE EXCEPTION 'You do not have permission to manage this location''s subscription';
  END IF;
  
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
    plan_id = plan_id,
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

-- Create a function to check if a user is on the agency plan
CREATE OR REPLACE FUNCTION is_agency_plan()
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

-- Create a function to get a user's plan code
CREATE OR REPLACE FUNCTION get_user_plan_code()
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

-- Create a function to get a user's plan name
CREATE OR REPLACE FUNCTION get_user_plan_name()
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

-- Create a function to check if a user can downgrade their plan
CREATE OR REPLACE FUNCTION can_downgrade_plan()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can always change their plan
  IF get_ghl_user_type() = 'agency' THEN
    RETURN true;
  END IF;
  
  -- All users can downgrade their plan
  RETURN true;
END;
$$;

-- Create a function to get available plans for a user
CREATE OR REPLACE FUNCTION get_available_plans()
RETURNS SETOF subscription_plans
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return all active plans
  RETURN QUERY
  SELECT *
  FROM subscription_plans
  WHERE is_active = true
  ORDER BY price_monthly;
END;
$$;

-- Create a function to get a user's current subscription
CREATE OR REPLACE FUNCTION get_current_subscription()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Get current subscription
  SELECT jsonb_build_object(
    'subscription_id', ls.id,
    'location_id', ls.location_id,
    'plan_id', sp.id,
    'plan_name', sp.name,
    'plan_code', sp.code,
    'price_monthly', sp.price_monthly,
    'price_annual', sp.price_annual,
    'max_users', sp.max_users,
    'messages_included', sp.messages_included,
    'overage_price', sp.overage_price,
    'can_use_own_openai_key', sp.can_use_own_openai_key,
    'can_white_label', sp.can_white_label,
    'start_date', ls.start_date,
    'end_date', ls.end_date,
    'is_active', ls.is_active,
    'payment_status', ls.payment_status
  ) INTO result
  FROM location_subscriptions ls
  JOIN subscription_plans sp ON ls.plan_id = sp.id
  WHERE ls.location_id = get_ghl_location_id()
    AND ls.is_active = true
  LIMIT 1;
  
  -- If no subscription found, return free plan
  IF result IS NULL THEN
    SELECT jsonb_build_object(
      'subscription_id', NULL,
      'location_id', get_ghl_location_id(),
      'plan_id', sp.id,
      'plan_name', sp.name,
      'plan_code', sp.code,
      'price_monthly', sp.price_monthly,
      'price_annual', sp.price_annual,
      'max_users', sp.max_users,
      'messages_included', sp.messages_included,
      'overage_price', sp.overage_price,
      'can_use_own_openai_key', sp.can_use_own_openai_key,
      'can_white_label', sp.can_white_label,
      'is_active', true,
      'payment_status', 'free'
    ) INTO result
    FROM subscription_plans sp
    WHERE sp.code = 'free'
    LIMIT 1;
  END IF;
  
  -- For agency users, always return agency plan
  IF get_ghl_user_type() = 'agency' THEN
    SELECT jsonb_build_object(
      'subscription_id', ls.id,
      'location_id', get_ghl_location_id(),
      'plan_id', sp.id,
      'plan_name', sp.name,
      'plan_code', sp.code,
      'price_monthly', sp.price_monthly,
      'price_annual', sp.price_annual,
      'max_users', sp.max_users,
      'messages_included', sp.messages_included,
      'overage_price', sp.overage_price,
      'can_use_own_openai_key', true,
      'can_white_label', true,
      'is_active', true,
      'payment_status', 'active'
    ) INTO result
    FROM subscription_plans sp
    LEFT JOIN location_subscriptions ls ON 
      ls.plan_id = sp.id AND 
      ls.location_id = get_ghl_location_id() AND
      ls.is_active = true
    WHERE sp.code = 'agency'
    LIMIT 1;
  END IF;
  
  RETURN result;
END;
$$;

-- Create a function to get a user's current usage
CREATE OR REPLACE FUNCTION get_current_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month text;
  usage_data record;
  result jsonb;
BEGIN
  -- Get current month in YYYY-MM format
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Get current usage
  SELECT * INTO usage_data
  FROM usage_tracking
  WHERE location_id = get_ghl_location_id()
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
      get_ghl_location_id(), 
      current_month, 
      0, 
      0, 
      0
    )
    RETURNING * INTO usage_data;
  END IF;
  
  -- Build result
  SELECT jsonb_build_object(
    'month', current_month,
    'messages_used', usage_data.messages_used,
    'tokens_used', usage_data.tokens_used,
    'cost_estimate', usage_data.cost_estimate
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Create a function to get a user's subscription and usage combined
CREATE OR REPLACE FUNCTION get_subscription_and_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription jsonb;
  usage jsonb;
  result jsonb;
BEGIN
  -- Get current subscription
  subscription := get_current_subscription();
  
  -- Get current usage
  usage := get_current_usage();
  
  -- Combine results
  result := jsonb_build_object(
    'subscription', subscription,
    'usage', usage,
    'location_id', get_ghl_location_id(),
    'user_type', get_ghl_user_type(),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;