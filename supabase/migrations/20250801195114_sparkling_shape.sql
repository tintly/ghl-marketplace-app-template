/*
  # Add Correct Agency Subscription Plans

  1. New Plans
    - Agency Starter ($99/month) - 5,000 AI extractions, basic features
    - Agency Pro ($249/month) - 50,000 AI extractions, white-label + custom OpenAI
    - Agency Enterprise ($799/month) - 500,000 AI extractions, all features + best rates

  2. Features
    - All plans have unlimited users and custom fields
    - Annual pricing with 2 months free (10x monthly rate)
    - Call extraction rates decrease with higher tiers
    - Pro and Enterprise include white-label branding and custom OpenAI keys
*/

-- Insert the 3 correct agency subscription plans
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
  990.00,  -- 10 months (2 months free)
  999999,  -- Unlimited users
  5000,    -- 5,000 AI extractions per month
  0.005,   -- $0.005 per extraction overage
  false,   -- No custom OpenAI key
  false,   -- No white-label branding
  true,    -- Active
  999999,  -- Unlimited daily messages
  999999,  -- Unlimited custom fields
  false,   -- No AI summary included
  0.25,    -- $0.25 per minute for call extraction
  0,       -- No call packages
  0.00,
  0,
  0.00,
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
  50000,   -- 50,000 AI extractions per month
  0.003,   -- $0.003 per extraction overage
  true,    -- Custom OpenAI key support
  true,    -- White-label branding
  true,    -- Active
  999999,  -- Unlimited daily messages
  999999,  -- Unlimited custom fields
  true,    -- AI summary included
  0.20,    -- $0.20 per minute for call extraction
  0,       -- No call packages
  0.00,
  0,
  0.00,
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
  500000,  -- 500,000 AI extractions per month
  0.001,   -- $0.001 per extraction overage (best rate)
  true,    -- Custom OpenAI key support
  true,    -- White-label branding
  true,    -- Active
  999999,  -- Unlimited daily messages
  999999,  -- Unlimited custom fields
  true,    -- AI summary included
  0.15,    -- $0.15 per minute for call extraction (best rate)
  0,       -- No call packages
  0.00,
  0,
  0.00,
  now(),
  now()
);