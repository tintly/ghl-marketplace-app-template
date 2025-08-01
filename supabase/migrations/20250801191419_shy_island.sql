/*
  # Fix Subscription Plans Table

  1. Clean Up
    - Remove all existing plans
    - Reset the table to clean state

  2. New Plans
    - Agency Starter: $99/month, 5 sub-accounts, 5,000 AI extractions
    - Agency Pro: $249/month, 25 sub-accounts, 50,000 AI extractions  
    - Agency Enterprise: $799/month, 100 sub-accounts, 500,000 AI extractions

  3. Features
    - All plans have unlimited custom fields
    - Pro and Enterprise have white-label branding
    - Enterprise has dedicated account manager
    - Decreasing overage rates and additional sub-account costs
*/

-- Clean up existing plans
DELETE FROM subscription_plans;

-- Insert the 3 new agency plans with correct structure
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
  daily_cap_messages,
  custom_fields_limit,
  ai_summary_included,
  call_extraction_rate_per_minute,
  call_package_1_minutes,
  call_package_1_price,
  call_package_2_minutes,
  call_package_2_price,
  is_active
) VALUES
-- Agency Starter Plan
(
  'Agency Starter',
  'agency_starter',
  99.00,
  990.00, -- 10 months pricing for annual
  999999, -- Unlimited users within the agency
  5000, -- 5,000 AI extractions per month (pooled)
  0.005, -- $0.005 per extraction overage
  false, -- Cannot use own OpenAI key
  false, -- No white-label branding
  999999, -- No daily message cap
  999999, -- Unlimited custom fields
  false, -- No AI summary included (basic plan)
  0.25, -- Call extraction rate per minute
  0, -- No call package 1
  0.0,
  0, -- No call package 2
  0.0,
  true
),
-- Agency Pro Plan
(
  'Agency Pro',
  'agency_pro',
  249.00,
  2490.00, -- 10 months pricing for annual
  999999, -- Unlimited users within the agency
  50000, -- 50,000 AI extractions per month (pooled)
  0.003, -- $0.003 per extraction overage
  true, -- Can use own OpenAI key
  true, -- White-label branding included
  999999, -- No daily message cap
  999999, -- Unlimited custom fields
  true, -- AI summary included
  0.20, -- Slightly better call extraction rate
  0, -- No call packages (pay per minute)
  0.0,
  0,
  0.0,
  true
),
-- Agency Enterprise Plan
(
  'Agency Enterprise',
  'agency_enterprise',
  799.00,
  7990.00, -- 10 months pricing for annual
  999999, -- Unlimited users within the agency
  500000, -- 500,000 AI extractions per month (pooled)
  0.001, -- $0.001 per extraction overage (lowest rate)
  true, -- Can use own OpenAI key
  true, -- White-label branding included
  999999, -- No daily message cap
  999999, -- Unlimited custom fields
  true, -- AI summary included
  0.15, -- Best call extraction rate
  0, -- No call packages (pay per minute)
  0.0,
  0,
  0.0,
  true
);

-- Verify the plans were created correctly
SELECT 
  name,
  code,
  price_monthly,
  messages_included as ai_extractions_included,
  overage_price,
  can_use_own_openai_key,
  can_white_label,
  custom_fields_limit,
  is_active
FROM subscription_plans 
ORDER BY price_monthly ASC;