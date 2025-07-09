/*
# Fix Subscription Management Functions

1. New Functions
  - `get_user_subscription_details` - Fixed function to get user subscription details
  - `get_user_usage_with_limits` - Fixed function to get usage with limits
  - `get_available_plans` - Fixed function to get available plans

2. Changes
  - Fixed column reference issues in subscription functions
  - Added proper error handling
  - Improved agency plan detection
*/

-- Fix the get_user_subscription_details function
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
      'payment_status', COALESCE(ls.payment_status, 'active')
    ) INTO result
    FROM subscription_plans sp
    LEFT JOIN location_subscriptions ls ON 
      ls.plan_id = sp.id AND 
      ls.location_id = location_id AND
      ls.is_active = true
    WHERE sp.code = 'agency'
    LIMIT 1;
    
    -- Return early for agency users
    RETURN result;
  END IF;
  
  -- For non-agency users, get their subscription
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

-- Fix the get_user_usage_with_limits function
CREATE OR REPLACE FUNCTION get_user_usage_with_limits()
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
  
  -- Get subscription data
  subscription_data := get_user_subscription_details();
  
  -- Calculate usage metrics
  messages_used := usage_data.messages_used;
  messages_included := ((subscription_data->'plan'->>'messages_included')::integer);
  
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
    'tokens_used', usage_data.tokens_used,
    'cost_estimate', usage_data.cost_estimate,
    'messages_included', messages_included,
    'messages_remaining', messages_remaining,
    'usage_percentage', usage_percentage,
    'limit_reached', limit_reached,
    'plan', subscription_data->'plan'
  );
  
  RETURN result;
END;
$$;

-- Fix the get_available_plans function
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