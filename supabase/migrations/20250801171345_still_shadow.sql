/*
  # Update AI Usage Logs for Call Tracking

  1. New Columns Added to ai_usage_logs
    - `call_minutes_used` (numeric) - Minutes of call audio processed
    - `is_call_extraction` (boolean) - Whether this is call or message extraction

  2. Security
    - Existing RLS policies remain unchanged
*/

-- Add new columns to ai_usage_logs table
DO $$
BEGIN
  -- Call minutes used
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_usage_logs' AND column_name = 'call_minutes_used'
  ) THEN
    ALTER TABLE ai_usage_logs ADD COLUMN call_minutes_used numeric(10,2) DEFAULT 0.0 NOT NULL;
  END IF;

  -- Is call extraction flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_usage_logs' AND column_name = 'is_call_extraction'
  ) THEN
    ALTER TABLE ai_usage_logs ADD COLUMN is_call_extraction boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add index for call extraction queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_call_extraction 
ON ai_usage_logs (location_id, is_call_extraction, created_at DESC);

-- Add index for call minutes tracking
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_call_minutes 
ON ai_usage_logs (location_id, call_minutes_used, created_at DESC) 
WHERE call_minutes_used > 0;