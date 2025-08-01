/*
  # Clean and Reset Subscription Plans Table

  1. Complete Cleanup
    - Remove ALL existing subscription plans
    - Reset the table to a clean state
  
  2. Add New Agency Plans
    - Agency Starter ($99/month)
    - Agency Pro ($249/month) 
    - Agency Enterprise ($799/month)
  
  3. Security
    - Ensure all plans are properly configured
    - Set correct permissions and limits
*/

-- Step 1: Delete ALL existing subscription plans
DELETE FROM subscription_plans;

-- Step 2: Reset the sequence if needed (optional, but ensures clean IDs)
-- This will make the next inserted records start with clean UUIDs

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
  daily_cap_messages,
  custom_fields_limit,
  ai_summary_included,
  call_extraction_rate_per_minute,
  call_package_1_minutes,
  call_package_1_price,
  call_package_2_minutes,
  call_package_2_price,
  is_active,
  created_at,
  updated_at
) VALUES 
-- Agency Starter Plan
(
  'Agency Starter',
  'agency_starter',
  99.00,
  990.00, -- 10 months pricing (2 months free)
  999999, -- Unlimited users
  5000, -- 5,000 AI extractions/month
  0.005, -- $0.005 per extraction overage
  false, -- Cannot use own OpenAI key
  false, -- Cannot white label
  999999, -- Unlimited daily messages
  999999, -- Unlimited custom fields
  false, -- No AI summary included
  0.25, -- $0.25 per minute for call extraction
  0, -- No call package 1
  0.00,
  0, -- No call package 2
  0.00,
  true,
  now(),
  now()
),
-- Agency Pro Plan
(
  'Agency Pro',
  'agency_pro',
  249.00,
  2490.00, -- 10 months pricing (2 months free)
  999999, -- Unlimited users
  50000, -- 50,000 AI extractions/month
  0.003, -- $0.003 per extraction overage
  true, -- Can use own OpenAI key
  true, -- Can white label
  999999, -- Unlimited daily messages
  999999, -- Unlimited custom fields
  true, -- AI summary included
  0.20, -- $0.20 per minute for call extraction
  0, -- No call package 1
  0.00,
  0, -- No call package 2
  0.00,
  true,
  now(),
  now()
),
-- Agency Enterprise Plan
(
  'Agency Enterprise',
  'agency_enterprise',
  799.00,
  7990.00, -- 10 months pricing (2 months free)
  999999, -- Unlimited users
  500000, -- 500,000 AI extractions/month
  0.001, -- $0.001 per extraction overage (lowest rate)
  true, -- Can use own OpenAI key
  true, -- Can white label
  999999, -- Unlimited daily messages
  999999, -- Unlimited custom fields
  true, -- AI summary included
  0.15, -- $0.15 per minute for call extraction (best rate)
  0, -- No call package 1
  0.00,
  0, -- No call package 2
  0.00,
  true,
  now(),
  now()
);

-- Step 4: Verify the cleanup and insertion
-- This will show only the 3 new plans
DO $$
DECLARE
  plan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO plan_count FROM subscription_plans WHERE is_active = true;
  
  IF plan_count = 3 THEN
    RAISE NOTICE 'SUCCESS: Subscription plans table cleaned and 3 agency plans added correctly';
  ELSE
    RAISE NOTICE 'WARNING: Expected 3 plans but found %', plan_count;
  END IF;
END $$;