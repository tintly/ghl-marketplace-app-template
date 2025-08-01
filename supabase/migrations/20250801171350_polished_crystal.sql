/*
  # Update Usage Tracking for Daily Caps and Call Minutes

  1. New Columns Added to usage_tracking
    - `daily_messages_used` (integer) - Daily message count
    - `daily_call_minutes_used` (numeric) - Daily call minutes used
    - `call_minutes_used_monthly` (numeric) - Monthly call minutes used
    - `call_cost_estimate_monthly` (numeric) - Monthly call cost estimate

  2. Security
    - Existing RLS policies remain unchanged
*/

-- Add new columns to usage_tracking table
DO $$
BEGIN
  -- Daily messages used
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_tracking' AND column_name = 'daily_messages_used'
  ) THEN
    ALTER TABLE usage_tracking ADD COLUMN daily_messages_used integer DEFAULT 0 NOT NULL;
  END IF;

  -- Daily call minutes used
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_tracking' AND column_name = 'daily_call_minutes_used'
  ) THEN
    ALTER TABLE usage_tracking ADD COLUMN daily_call_minutes_used numeric(10,2) DEFAULT 0.0 NOT NULL;
  END IF;

  -- Monthly call minutes used
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_tracking' AND column_name = 'call_minutes_used_monthly'
  ) THEN
    ALTER TABLE usage_tracking ADD COLUMN call_minutes_used_monthly numeric(10,2) DEFAULT 0.0 NOT NULL;
  END IF;

  -- Monthly call cost estimate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_tracking' AND column_name = 'call_cost_estimate_monthly'
  ) THEN
    ALTER TABLE usage_tracking ADD COLUMN call_cost_estimate_monthly numeric(10,6) DEFAULT 0.0 NOT NULL;
  END IF;
END $$;

-- Add indexes for daily usage queries
CREATE INDEX IF NOT EXISTS idx_usage_tracking_daily_messages 
ON usage_tracking (location_id, month_year, daily_messages_used);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_daily_call_minutes 
ON usage_tracking (location_id, month_year, daily_call_minutes_used);