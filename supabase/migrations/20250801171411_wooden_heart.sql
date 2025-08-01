/*
  # Seed New Subscription Plans with Pricing Model

  1. Updates Existing Plans
    - Updates existing plans with new pricing structure
    - Adds Starter, Core, Pro plans with specific features

  2. Agency Plans
    - Updates agency permissions with tier structure
*/

-- Update or insert subscription plans with new pricing model
INSERT INTO subscription_plans (
  name, code, price_monthly, price_annual, max_users, messages_included, overage_price,
  can_use_own_openai_key, can_white_label, daily_cap_messages, custom_fields_limit,
  ai_summary_included, call_extraction_rate_per_minute, call_package_1_minutes,
  call_package_1_price, call_package_2_minutes, call_package_2_price, is_active
) VALUES 
  -- Starter Plan (Free)
  (
    'Starter', 'starter', 0.00, 0.00, 1, 500, 0.01,
    false, false, 100, 1,
    false, 0.25, 0,
    0.00, 0, 0.00, true
  ),
  -- Core Plan
  (
    'Core', 'core', 29.00, 290.00, 3, 5000, 0.006,
    false, false, 500, 10,
    true, 0.25, 10,
    5.00, 50, 19.00, true
  ),
  -- Pro Plan
  (
    'Pro', 'pro', 49.00, 490.00, 5, 15000, 0.005,
    false, false, 1000, 999999,
    true, 0.25, 10,
    5.00, 50, 19.00, true
  ),
  -- Agency Tier 1
  (
    'Agency Tier 1', 'agency_tier_1', 149.00, 1490.00, 999999, 999999, 0.005,
    true, true, 999999, 999999,
    true, 0.25, 0,
    0.00, 0, 0.00, true
  ),
  -- Agency Tier 2
  (
    'Agency Tier 2', 'agency_tier_2', 299.00, 2990.00, 999999, 999999, 0.005,
    true, true, 999999, 999999,
    true, 0.20, 0,
    0.00, 0, 0.00, true
  ),
  -- Agency Tier 3
  (
    'Agency Tier 3', 'agency_tier_3', 299.00, 2990.00, 999999, 999999, 0.005,
    true, true, 999999, 999999,
    true, 0.15, 0,
    0.00, 0, 0.00, true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  max_users = EXCLUDED.max_users,
  messages_included = EXCLUDED.messages_included,
  overage_price = EXCLUDED.overage_price,
  can_use_own_openai_key = EXCLUDED.can_use_own_openai_key,
  can_white_label = EXCLUDED.can_white_label,
  daily_cap_messages = EXCLUDED.daily_cap_messages,
  custom_fields_limit = EXCLUDED.custom_fields_limit,
  ai_summary_included = EXCLUDED.ai_summary_included,
  call_extraction_rate_per_minute = EXCLUDED.call_extraction_rate_per_minute,
  call_package_1_minutes = EXCLUDED.call_package_1_minutes,
  call_package_1_price = EXCLUDED.call_package_1_price,
  call_package_2_minutes = EXCLUDED.call_package_2_minutes,
  call_package_2_price = EXCLUDED.call_package_2_price,
  is_active = EXCLUDED.is_active,
  updated_at = now();