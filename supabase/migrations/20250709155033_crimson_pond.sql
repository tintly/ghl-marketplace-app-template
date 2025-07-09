-- Fix the get_my_subscription_direct function to resolve ambiguous column reference
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
  -- Use table aliases to avoid ambiguous column references
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

-- Fix the check_location_message_limit function to avoid ambiguous column references
CREATE OR REPLACE FUNCTION check_location_message_limit(p_location_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month text;
  plan_data jsonb;
  usage_data record;
  result jsonb;
BEGIN
  -- Get current month in YYYY-MM format
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Get location's subscription plan
  plan_data := get_location_subscription_plan_safe(p_location_id);
  
  -- Get current usage for this month
  SELECT * INTO usage_data
  FROM usage_tracking ut
  WHERE ut.location_id = p_location_id AND ut.month_year = current_month;
  
  -- If no usage record exists yet, create one
  IF usage_data IS NULL THEN
    INSERT INTO usage_tracking (location_id, month_year, messages_used, tokens_used, cost_estimate)
    VALUES (p_location_id, current_month, 0, 0, 0)
    RETURNING * INTO usage_data;
  END IF;
  
  -- Check if usage is within limits
  result := jsonb_build_object(
    'plan', plan_data,
    'current_usage', jsonb_build_object(
      'month', current_month,
      'messages_used', COALESCE(usage_data.messages_used, 0),
      'tokens_used', COALESCE(usage_data.tokens_used, 0),
      'cost_estimate', COALESCE(usage_data.cost_estimate, 0)
    ),
    'limit_reached', false,
    'messages_remaining', (plan_data->>'messages_included')::integer - COALESCE(usage_data.messages_used, 0)
  );
  
  -- Check if limit reached for limited plans
  IF (plan_data->>'plan_code') != 'agency' AND COALESCE(usage_data.messages_used, 0) >= (plan_data->>'messages_included')::integer THEN
    result := result || jsonb_build_object('limit_reached', true);
  END IF;
  
  RETURN result;
END;
$$;

-- Fix the get_user_usage_with_limits_fixed function to avoid ambiguous column references
CREATE OR REPLACE FUNCTION get_user_usage_with_limits_fixed()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month text;
  usage_data record;
  subscription_data jsonb;
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
  FROM usage_tracking ut
  WHERE ut.location_id = location_id
    AND ut.month_year = current_month;
  
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
  
  -- Get subscription data
  subscription_data := get_user_subscription_details_fixed();
  
  -- Calculate usage metrics
  messages_used := COALESCE(usage_data.messages_used, 0);
  
  -- Handle potential NULL values in subscription data
  BEGIN
    messages_included := COALESCE((subscription_data->'plan'->>'messages_included')::integer, 100);
  EXCEPTION WHEN OTHERS THEN
    -- Default to 100 if conversion fails
    messages_included := 100;
  END;
  
  -- For agency plan, treat as unlimited
  IF (subscription_data->'plan'->>'code') = 'agency' THEN
    messages_included := 999999;
  END IF;
  
  -- Calculate percentage and remaining
  IF messages_included > 0 THEN
    usage_percentage := (messages_used::numeric / messages_included::numeric) * 100;
  ELSE
    usage_percentage := 0;
  END IF;
  
  messages_remaining := greatest(0, messages_included - messages_used);
  limit_reached := messages_used >= messages_included AND (subscription_data->'plan'->>'code') != 'agency';
  
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
    'plan', subscription_data->'plan'
  );
  
  RETURN result;
END;
$$;

-- Fix the get_my_usage_with_limits function to avoid ambiguous column references
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
  FROM usage_tracking ut
  WHERE ut.location_id = location_id
    AND ut.month_year = current_month;
  
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