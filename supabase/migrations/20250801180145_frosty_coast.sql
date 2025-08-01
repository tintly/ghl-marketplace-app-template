/*
  # Add GHL Charge ID to AI Usage Logs

  1. Schema Changes
    - Add `ghl_charge_id` column to `ai_usage_logs` table
    - Add index for efficient querying by charge ID

  2. Purpose
    - Track GoHighLevel Wallet charges associated with AI usage
    - Enable reconciliation between usage logs and billing charges
    - Support metered pricing implementation
*/

-- Add ghl_charge_id column to ai_usage_logs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_usage_logs' AND column_name = 'ghl_charge_id'
  ) THEN
    ALTER TABLE ai_usage_logs ADD COLUMN ghl_charge_id text;
  END IF;
END $$;

-- Add index for efficient querying by charge ID
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_ghl_charge_id 
ON ai_usage_logs (ghl_charge_id) 
WHERE ghl_charge_id IS NOT NULL;