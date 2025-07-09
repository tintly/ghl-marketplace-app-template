-- Fix subscription management issues

-- Create a function to directly change a location's subscription plan
CREATE OR REPLACE FUNCTION change_subscription_plan(
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

-- Create a function to get all available plans
CREATE OR REPLACE FUNCTION get_available_plans()
RETURNS SETOF subscription_plans
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM subscription_plans
  WHERE is_active = true
  ORDER BY price_monthly;
END;
$$;

-- Create a function to get a user's current subscription details
CREATE OR REPLACE FUNCTION get_user_subscription_details()
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
  
  -- Get subscription details
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
  
  -- For agency users, always return agency plan
  IF get_ghl_user_type() = 'agency' THEN
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
      'payment_status', 'active'
    ) INTO result
    FROM subscription_plans sp
    LEFT JOIN location_subscriptions ls ON 
      ls.plan_id = sp.id AND 
      ls.location_id = location_id AND
      ls.is_active = true
    WHERE sp.code = 'agency'
    LIMIT 1;
  END IF;
  
  RETURN result;
END;
$$;

-- Ensure all agency users have agency plan subscriptions
DO $$
DECLARE
  agency_plan_id uuid;
BEGIN
  -- Get agency plan ID
  SELECT id INTO agency_plan_id FROM subscription_plans WHERE code = 'agency' LIMIT 1;
  
  -- Skip if no agency plan found
  IF agency_plan_id IS NULL THEN
    RAISE NOTICE 'No agency plan found, skipping subscription updates';
    RETURN;
  END IF;
  
  -- Update all agency users to have agency plan
  INSERT INTO location_subscriptions (
    location_id,
    plan_id,
    start_date,
    is_active,
    payment_status
  )
  SELECT 
    ghl_account_id,
    agency_plan_id,
    now(),
    TRUE,
    'active'
  FROM 
    ghl_configurations
  WHERE 
    ghl_user_type = 'agency'
    AND ghl_account_id IS NOT NULL
    AND ghl_account_id NOT IN (
      SELECT location_id FROM location_subscriptions WHERE plan_id = agency_plan_id
    )
  ON CONFLICT (location_id) 
  DO UPDATE SET
    plan_id = agency_plan_id,
    is_active = TRUE,
    payment_status = 'active',
    updated_at = now();
END;
$$;

-- Fix branding permissions for agency users
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

-- Create a function to check if a user can access branding features
CREATE OR REPLACE FUNCTION user_can_access_branding()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can always access branding
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

-- Create a function to check if a user can use custom OpenAI keys
CREATE OR REPLACE FUNCTION user_can_use_custom_openai_key()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Agency users can always use custom OpenAI keys
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

-- Create a function to get a user's current plan features
CREATE OR REPLACE FUNCTION get_user_plan_features()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Get plan features
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
    SELECT jsonb_build_object(
      'plan_code', 'free',
      'plan_name', 'Free',
      'max_users', 1,
      'messages_included', 100,
      'overage_price', 0.08,
      'can_use_own_openai_key', false,
      'can_white_label', false,
      'is_agency_plan', false
    ) INTO result;
  END IF;
  
  -- For agency users, always return agency features
  IF get_ghl_user_type() = 'agency' THEN
    result := result || jsonb_build_object(
      'can_use_own_openai_key', true,
      'can_white_label', true,
      'is_agency_plan', true
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Create a function to get a user's current usage with plan limits
CREATE OR REPLACE FUNCTION get_user_usage_with_limits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month text;
  usage_data record;
  plan_data jsonb;
  result jsonb;
  messages_used integer;
  messages_included integer;
  usage_percentage numeric;
  messages_remaining integer;
  limit_reached boolean;
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
  
  -- Get plan data
  plan_data := get_user_plan_features();
  
  -- Calculate usage metrics
  messages_used := usage_data.messages_used;
  messages_included := (plan_data->>'messages_included')::integer;
  
  -- For agency plan, treat as unlimited
  IF plan_data->>'is_agency_plan' = 'true' THEN
    messages_included := 999999;
  END IF;
  
  -- Calculate percentage and remaining
  IF messages_included > 0 THEN
    usage_percentage := (messages_used::numeric / messages_included::numeric) * 100;
  ELSE
    usage_percentage := 0;
  END IF;
  
  messages_remaining := greatest(0, messages_included - messages_used);
  limit_reached := messages_used >= messages_included;
  
  -- Build result
  result := jsonb_build_object(
    'month', current_month,
    'messages_used', messages_used,
    'tokens_used', usage_data.tokens_used,
    'cost_estimate', usage_data.cost_estimate,
    'messages_included', messages_included,
    'messages_remaining', messages_remaining,
    'usage_percentage', usage_percentage,
    'limit_reached', limit_reached,
    'plan', plan_data
  );
  
  RETURN result;
END;
$$;