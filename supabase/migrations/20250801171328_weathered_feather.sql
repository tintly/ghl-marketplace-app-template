/*
  # Update Subscription Plans for New Pricing Model

  1. New Columns Added to subscription_plans
    - `daily_cap_messages` (integer) - Daily message limit per plan
    - `custom_fields_limit` (integer) - Number of custom fields allowed
    - `ai_summary_included` (boolean) - Whether AI Summary Field is included
    - `call_extraction_rate_per_minute` (numeric) - Per-minute rate for call extraction
    - `call_package_1_minutes` (integer) - Optional call package 1 minutes
    - `call_package_1_price` (numeric) - Optional call package 1 price
    - `call_package_2_minutes` (integer) - Optional call package 2 minutes  
    - `call_package_2_price` (numeric) - Optional call package 2 price

  2. Security
    - Existing RLS policies remain unchanged
*/

-- Add new columns to subscription_plans table
DO $$
BEGIN
  -- Daily cap for messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'daily_cap_messages'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN daily_cap_messages integer DEFAULT 0 NOT NULL;
  END IF;

  -- Custom fields limit
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'custom_fields_limit'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN custom_fields_limit integer DEFAULT 0 NOT NULL;
  END IF;

  -- AI summary field inclusion
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'ai_summary_included'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN ai_summary_included boolean DEFAULT false NOT NULL;
  END IF;

  -- Call extraction rate per minute
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'call_extraction_rate_per_minute'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN call_extraction_rate_per_minute numeric(10,4) DEFAULT 0.0 NOT NULL;
  END IF;

  -- Call package 1
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'call_package_1_minutes'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN call_package_1_minutes integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'call_package_1_price'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN call_package_1_price numeric(10,2) DEFAULT 0.0;
  END IF;

  -- Call package 2
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'call_package_2_minutes'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN call_package_2_minutes integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'call_package_2_price'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN call_package_2_price numeric(10,2) DEFAULT 0.0;
  END IF;
END $$;