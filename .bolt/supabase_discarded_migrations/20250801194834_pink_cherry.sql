/*
  # Comprehensive Subscription Plans Cleanup

  1. Safety and Cleanup
    - Remove all location subscriptions (to avoid foreign key conflicts)
    - Delete all existing subscription plans
    - Reset the table completely

  2. New Plans
    - Agency Starter: $99/month, 5K extractions, basic features
    - Agency Pro: $249/month, 50K extractions, white-label + custom keys
    - Agency Enterprise: $799/month, 500K extractions, all features + best rates

  3. Security
    - All plans properly configured with correct limits and features
    - Annual pricing set to 10 months (2 months free)
    - Proper overage rates and call extraction pricing
</

-- Step 1: Remove all location subscriptions to avoid foreign key conflicts
DELETE FROM location_subscriptions;

-- Step 2: Delete all existing subscription plans
DELETE FROM subscription_plans;

-- Step 3: Insert the 3 correct agency plans
INSERT INTO subscription_plans (
  name,
  code,
  price_monthly,
  price_annual,
  max_users,
  messages_included,
  overage_price,
  can_use_own_openai_key,
  can_white_label,
  is_active,
  daily_cap_messages,
  custom_fields_limit,
  ai_summary_included,
  call_extraction_rate_per_minute,
  call_package_1_minutes,
  call_package_1_price,
  call_package_2_minutes,
  call_package_2_price,
  created_at,
  updated_at
) VALUES
-- Agency Starter Plan
(
  'Agency Starter',
  'agency_starter',
  99.00,
  990.00, -- 10 months (2 months free)
  999999, -- Unlimited users
  5000,   -- 5,000 AI extractions/month
  0.005,  -- $0.005 per extraction overage
  false,  -- Cannot use own OpenAI key
  false,  -- Cannot white label
  true,   -- Active
  999999, -- Unlimited daily messages
  999999, -- Unlimited custom fields
  false,  -- No AI summary included
  0.25,   -- $0.25 per minute for call extraction
  0,      -- No call package 1
  0.00,   -- No call package 1 price
  0,      -- No call package 2
  0.00,   -- No call package 2 price
  now(),
  now()
),
-- Agency Pro Plan
(
  'Agency Pro',
  'agency_pro',
  249.00,
  2490.00, -- 10 months (2 months free)
  999999,  -- Unlimited users
  50000,   -- 50,000 AI extractions/month
  0.003,   -- $0.003 per extraction overage
  true,    -- Can use own OpenAI key
  true,    -- Can white label
  true,    -- Active
  999999,  -- Unlimited daily messages
  999999,  -- Unlimited custom fields
  true,    -- AI summary included
  0.20,    -- $0.20 per minute for call extraction
  0,       -- No call package 1
  0.00,    -- No call package 1 price
  0,       -- No call package 2
  0.00,    -- No call package 2 price
  now(),
  now()
),
-- Agency Enterprise Plan
(
  'Agency Enterprise',
  'agency_enterprise',
  799.00,
  7990.00, -- 10 months (2 months free)
  999999,  -- Unlimited users
  500000,  -- 500,000 AI extractions/month
  0.001,   -- $0.001 per extraction overage (best rate)
  true,    -- Can use own OpenAI key
  true,    -- Can white label
  true,    -- Active
  999999,  -- Unlimited daily messages
  999999,  -- Unlimited custom fields
  true,    -- AI summary included
  0.15,    -- $0.15 per minute for call extraction (best rate)
  0,       -- No call package 1
  0.00,    -- No call package 1 price
  0,       -- No call package 2
  0.00,    -- No call package 2 price
  now(),
  now()
);