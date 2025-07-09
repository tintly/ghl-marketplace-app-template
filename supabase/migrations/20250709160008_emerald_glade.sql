-- Fix subscription management functions

-- Fix the get_my_subscription_direct function to resolve ambiguous column reference
CREATE OR REPLACE FUNCTION get_my_subscription_direct()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  user_type text;
  user_location_id text;
BEGIN
  -- Get user type and location ID
  user_type := get_ghl_user_type();
  user_location_id := get_ghl_location_id();
  
  -- For agency users, always return agency plan
  IF user_type = 'agency' THEN
    -- Try to get agency plan from database
    SELECT jsonb_build_object(
      'subscription_id', ls.id,
      'location_id', user_location_id,
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
    FROM subscription_plans sp
    LEFT JOIN location_subscriptions ls ON 
      ls.plan_id = sp.id AND 
      ls.location_id = user_location_id
    WHERE sp.code = 'agency'
    LIMIT 1;
    
    -- If no result, use hardcoded agency plan
    IF result IS NULL THEN
      result := jsonb_build_object(
        'subscription_id', NULL,
        'location_id', user_location_id,
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
  -- Use explicit table aliases to avoid ambiguous column references
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
  WHERE ls.location_id = user_location_id
    AND ls.is_active = true;
  
  -- If no subscription found, return free plan
  IF result IS NULL THEN
    SELECT jsonb_build_object(
      'subscription_id', NULL,
      'location_id', user_location_id,
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

-- Fix the get_my_usage_with_limits function to avoid ambiguous column references
CREATE OR REPLACE FUNCTION get_my_usage_with_limits()
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
  user_location_id text;
BEGIN
  -- Get current user's location ID
  user_location_id := get_ghl_location_id();
  
  -- Get current month in YYYY-MM format
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Get current usage - use explicit table alias to avoid ambiguity
  SELECT ut.* INTO usage_data
  FROM usage_tracking ut
  WHERE ut.location_id = user_location_id
    AND ut.month_year = current_month;
  
  -- If no usage record exists yet, create one
  IF usage_data IS NULL THEN
    BEGIN
      INSERT INTO usage_tracking (
        location_id, 
        month_year, 
        messages_used, 
        tokens_used, 
        cost_estimate
      )
      VALUES (
        user_location_id, 
        current_month, 
        0, 
        0, 
        0
      )
      RETURNING * INTO usage_data;
    EXCEPTION WHEN OTHERS THEN
      -- On error, create a default usage record in memory
      usage_data := ROW(
        uuid_generate_v4(), -- id
        user_location_id, -- location_id
        current_month, -- month_year
        0, -- messages_used
        0, -- tokens_used
        0, -- cost_estimate
        now(), -- created_at
        now() -- updated_at
      )::usage_tracking;
    END;
  END IF;
  
  -- Get subscription data
  BEGIN
    subscription_data := get_my_subscription_direct();
  EXCEPTION WHEN OTHERS THEN
    -- On error, create a default subscription
    IF get_ghl_user_type() = 'agency' THEN
      subscription_data := jsonb_build_object(
        'plan', jsonb_build_object(
          'name', 'Agency',
          'code', 'agency',
          'messages_included', 999999
        )
      );
    ELSE
      subscription_data := jsonb_build_object(
        'plan', jsonb_build_object(
          'name', 'Free',
          'code', 'free',
          'messages_included', 100
        )
      );
    END IF;
  END;
  
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

-- Create a function to force change a subscription plan with minimal checks
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
  BEGIN
    SELECT id INTO plan_id
    FROM subscription_plans
    WHERE code = p_plan_code
      AND is_active = true;
      
    IF plan_id IS NULL THEN
      -- Try to find by name if code doesn't match
      SELECT id INTO plan_id
      FROM subscription_plans
      WHERE name ILIKE '%' || p_plan_code || '%'
        AND is_active = true
      LIMIT 1;
      
      IF plan_id IS NULL THEN
        RAISE EXCEPTION 'Invalid plan code or name: %', p_plan_code;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If all else fails, get the first active plan
    SELECT id INTO plan_id
    FROM subscription_plans
    WHERE is_active = true
    ORDER BY price_monthly
    LIMIT 1;
    
    IF plan_id IS NULL THEN
      RAISE EXCEPTION 'No active subscription plans found';
    END IF;
  END;
  
  -- Update or insert subscription
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- On error, return error message
    RAISE EXCEPTION 'Failed to update subscription: %', SQLERRM;
  END;
  
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

-- Ensure all agency users have agency plan subscriptions
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