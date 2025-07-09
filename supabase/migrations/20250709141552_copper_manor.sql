/*
  # Create subscription plans and usage tracking

  1. New Tables
    - `subscription_plans` - Defines available subscription plans and their features
    - `location_subscriptions` - Tracks which plan each location is on
    - `usage_tracking` - Tracks message usage for each location
  
  2. Security
    - Enable RLS on all tables
    - Add policies for proper access control
    
  3. Functions
    - Add helper functions for checking plan limits and tracking usage
*/

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  price_monthly numeric(10,2) NOT NULL,
  price_annual numeric(10,2),
  max_users integer NOT NULL,
  messages_included integer NOT NULL,
  overage_price numeric(10,6) NOT NULL,
  can_use_own_openai_key boolean NOT NULL DEFAULT false,
  can_white_label boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Location subscriptions table
CREATE TABLE IF NOT EXISTS location_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL REFERENCES ghl_configurations(ghl_account_id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  payment_status text DEFAULT 'active',
  subscription_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_id)
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL REFERENCES ghl_configurations(ghl_account_id) ON DELETE CASCADE,
  month_year text NOT NULL, -- Format: YYYY-MM
  messages_used integer NOT NULL DEFAULT 0,
  tokens_used integer NOT NULL DEFAULT 0,
  cost_estimate numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_id, month_year)
);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Subscription plans - readable by all authenticated users
CREATE POLICY "subscription_plans_select_all"
  ON subscription_plans
  FOR SELECT
  TO authenticated
  USING (is_ghl_user_authenticated());

-- Location subscriptions - only accessible by the location owner or agency
CREATE POLICY "location_subscriptions_select"
  ON location_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (
      -- Location can see its own subscription
      location_id = get_ghl_location_id() OR
      -- Agency can see subscriptions for its locations
      (
        get_ghl_user_type() = 'agency' AND
        location_id IN (
          SELECT ghl_account_id 
          FROM ghl_configurations 
          WHERE agency_ghl_id = get_ghl_company_id()
        )
      )
    )
  );

-- Usage tracking - only accessible by the location owner or agency
CREATE POLICY "usage_tracking_select"
  ON usage_tracking
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (
      -- Location can see its own usage
      location_id = get_ghl_location_id() OR
      -- Agency can see usage for its locations
      (
        get_ghl_user_type() = 'agency' AND
        location_id IN (
          SELECT ghl_account_id 
          FROM ghl_configurations 
          WHERE agency_ghl_id = get_ghl_company_id()
        )
      )
    )
  );

-- Service role policies
CREATE POLICY "service_role_all_subscription_plans"
  ON subscription_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_location_subscriptions"
  ON location_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_usage_tracking"
  ON usage_tracking
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper functions

-- Function to get a location's current subscription plan
CREATE OR REPLACE FUNCTION get_location_subscription_plan(p_location_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_data jsonb;
BEGIN
  SELECT 
    jsonb_build_object(
      'plan_id', sp.id,
      'plan_name', sp.name,
      'plan_code', sp.code,
      'max_users', sp.max_users,
      'messages_included', sp.messages_included,
      'overage_price', sp.overage_price,
      'can_use_own_openai_key', sp.can_use_own_openai_key,
      'can_white_label', sp.can_white_label,
      'subscription_id', ls.id,
      'start_date', ls.start_date,
      'end_date', ls.end_date,
      'is_active', ls.is_active,
      'payment_status', ls.payment_status
    ) INTO plan_data
  FROM 
    location_subscriptions ls
    JOIN subscription_plans sp ON ls.plan_id = sp.id
  WHERE 
    ls.location_id = p_location_id
    AND ls.is_active = true
    AND sp.is_active = true
  LIMIT 1;
  
  -- If no subscription found, return free plan
  IF plan_data IS NULL THEN
    SELECT 
      jsonb_build_object(
        'plan_id', sp.id,
        'plan_name', sp.name,
        'plan_code', sp.code,
        'max_users', sp.max_users,
        'messages_included', sp.messages_included,
        'overage_price', sp.overage_price,
        'can_use_own_openai_key', sp.can_use_own_openai_key,
        'can_white_label', sp.can_white_label,
        'is_active', true,
        'payment_status', 'free'
      ) INTO plan_data
    FROM 
      subscription_plans sp
    WHERE 
      sp.code = 'free'
      AND sp.is_active = true
    LIMIT 1;
  END IF;
  
  RETURN plan_data;
END;
$$;

-- Function to check if a location has reached its message limit
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
  plan_data := get_location_subscription_plan(p_location_id);
  
  -- Get current usage for this month
  SELECT * INTO usage_data
  FROM usage_tracking
  WHERE location_id = p_location_id AND month_year = current_month;
  
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
      'messages_used', usage_data.messages_used,
      'tokens_used', usage_data.tokens_used,
      'cost_estimate', usage_data.cost_estimate
    ),
    'limit_reached', false,
    'messages_remaining', (plan_data->>'messages_included')::integer - usage_data.messages_used
  );
  
  -- Check if limit reached for limited plans
  IF (plan_data->>'plan_code') != 'agency' AND usage_data.messages_used >= (plan_data->>'messages_included')::integer THEN
    result := result || jsonb_build_object('limit_reached', true);
  END IF;
  
  RETURN result;
END;
$$;

-- Function to increment message usage for a location
CREATE OR REPLACE FUNCTION increment_location_message_usage(
  p_location_id text,
  p_messages_count integer DEFAULT 1,
  p_tokens_used integer DEFAULT 0,
  p_cost_estimate numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month text;
  updated_usage record;
  result jsonb;
BEGIN
  -- Get current month in YYYY-MM format
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Update or insert usage record
  INSERT INTO usage_tracking (
    location_id, 
    month_year, 
    messages_used, 
    tokens_used, 
    cost_estimate
  )
  VALUES (
    p_location_id, 
    current_month, 
    p_messages_count, 
    p_tokens_used, 
    p_cost_estimate
  )
  ON CONFLICT (location_id, month_year) 
  DO UPDATE SET
    messages_used = usage_tracking.messages_used + p_messages_count,
    tokens_used = usage_tracking.tokens_used + p_tokens_used,
    cost_estimate = usage_tracking.cost_estimate + p_cost_estimate,
    updated_at = now()
  RETURNING * INTO updated_usage;
  
  -- Get updated limit status
  result := check_location_message_limit(p_location_id);
  
  RETURN result;
END;
$$;

-- Insert default subscription plans
INSERT INTO subscription_plans 
  (name, code, price_monthly, price_annual, max_users, messages_included, overage_price, can_use_own_openai_key, can_white_label)
VALUES
  ('Free', 'free', 0, 0, 1, 100, 0.08, false, false),
  ('Solo', 'solo', 49, 470, 1, 500, 0.04, false, false),
  ('Pro', 'pro', 149, 1430, 5, 2000, 0.02, false, false),
  ('Business', 'business', 299, 2870, 20, 10000, 0.01, true, false),
  ('Agency', 'agency', 499, 4790, 999999, 999999, 0.005, true, true)
ON CONFLICT (code) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  max_users = EXCLUDED.max_users,
  messages_included = EXCLUDED.messages_included,
  overage_price = EXCLUDED.overage_price,
  can_use_own_openai_key = EXCLUDED.can_use_own_openai_key,
  can_white_label = EXCLUDED.can_white_label,
  updated_at = now();

-- Create update triggers
CREATE OR REPLACE FUNCTION update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_plans_updated_at();

CREATE OR REPLACE FUNCTION update_location_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_location_subscriptions_updated_at
  BEFORE UPDATE ON location_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_location_subscriptions_updated_at();

CREATE OR REPLACE FUNCTION update_usage_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usage_tracking_updated_at
  BEFORE UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_tracking_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_subscriptions_location_id ON location_subscriptions(location_id);
CREATE INDEX IF NOT EXISTS idx_location_subscriptions_plan_id ON location_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_location_month ON usage_tracking(location_id, month_year);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_month ON usage_tracking(month_year);