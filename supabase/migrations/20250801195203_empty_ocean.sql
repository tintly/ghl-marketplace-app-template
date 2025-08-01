/*
  # Add Sub-Account Subscription Plans

  1. New Tables
    - Adds subscription plans for independent sub-accounts/locations
    - Plans for locations not managed by agencies

  2. Plans Added
    - Free Plan: 100 extractions/month, basic features
    - Starter Plan: 1,000 extractions/month, $29/month
    - Professional Plan: 5,000 extractions/month, $99/month
    - Business Plan: 25,000 extractions/month, $299/month

  3. Features
    - Graduated pricing based on usage
    - Call extraction rates decrease with higher tiers
    - Custom OpenAI keys available on Professional and Business
    - White-label branding on Business plan only
*/

-- Add subscription plans for independent sub-accounts (locations not managed by agencies)
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
-- Free Plan for independent locations
(
  'Free',
  'free',
  0.00,
  0.00,
  1,
  100,
  0.01,
  false,
  false,
  true,
  10,
  5,
  false,
  0.50,
  0,
  0.00,
  0,
  0.00,
  now(),
  now()
),
-- Starter Plan for independent locations
(
  'Starter',
  'starter',
  29.00,
  290.00,
  3,
  1000,
  0.008,
  false,
  false,
  true,
  50,
  25,
  false,
  0.35,
  100,
  25.00,
  500,
  100.00,
  now(),
  now()
),
-- Professional Plan for independent locations
(
  'Professional',
  'professional',
  99.00,
  990.00,
  10,
  5000,
  0.005,
  true,
  false,
  true,
  200,
  100,
  true,
  0.25,
  500,
  100.00,
  2000,
  350.00,
  now(),
  now()
),
-- Business Plan for independent locations
(
  'Business',
  'business',
  299.00,
  2990.00,
  50,
  25000,
  0.003,
  true,
  true,
  true,
  1000,
  999999,
  true,
  0.20,
  2000,
  350.00,
  10000,
  1500.00,
  now(),
  now()
);