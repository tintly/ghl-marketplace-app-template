/*
  # Update AI Usage Logs to Show Customer Costs

  1. New Fields
    - Add `platform_cost_estimate` to store the actual OpenAI cost
    - Add `customer_cost_estimate` to store the cost shown to customers
    - Add `customer_cost_calculated` flag to track if customer cost has been calculated
  
  2. Changes
    - Rename existing `cost_estimate` to `platform_cost_estimate` for clarity
    - Add function to calculate customer cost based on subscription plan
*/

-- Add new columns to ai_usage_logs
ALTER TABLE ai_usage_logs 
  ADD COLUMN IF NOT EXISTS platform_cost_estimate NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS customer_cost_estimate NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS customer_cost_calculated BOOLEAN DEFAULT FALSE;

-- Migrate existing data: copy current cost_estimate to platform_cost_estimate
UPDATE ai_usage_logs 
SET platform_cost_estimate = cost_estimate
WHERE platform_cost_estimate IS NULL AND cost_estimate IS NOT NULL;

-- Function to calculate customer cost based on subscription plan
CREATE OR REPLACE FUNCTION calculate_customer_cost(
  p_location_id TEXT,
  p_tokens INTEGER,
  p_platform_cost NUMERIC(10,6)
)
RETURNS NUMERIC(10,6)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_data JSONB;
  overage_price NUMERIC(10,6);
  customer_cost NUMERIC(10,6);
BEGIN
  -- Get location's subscription plan
  plan_data := get_location_subscription_plan(p_location_id);
  
  -- Get overage price from plan
  overage_price := (plan_data->>'overage_price')::NUMERIC(10,6);
  
  -- Calculate customer cost based on tokens and overage price
  -- For simplicity, we'll use 1 message = 1 API call
  -- In a real implementation, you might have a more complex formula
  customer_cost := 1 * overage_price;
  
  RETURN customer_cost;
END;
$$;

-- Function to update customer costs for all logs
CREATE OR REPLACE FUNCTION update_all_customer_costs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
  log_record RECORD;
BEGIN
  FOR log_record IN 
    SELECT id, location_id, total_tokens, platform_cost_estimate
    FROM ai_usage_logs
    WHERE customer_cost_calculated = FALSE OR customer_cost_estimate IS NULL
  LOOP
    UPDATE ai_usage_logs
    SET 
      customer_cost_estimate = calculate_customer_cost(
        log_record.location_id,
        log_record.total_tokens,
        log_record.platform_cost_estimate
      ),
      customer_cost_calculated = TRUE
    WHERE id = log_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$;

-- Trigger to automatically calculate customer cost on insert or update
CREATE OR REPLACE FUNCTION calculate_customer_cost_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only calculate if we have the necessary data
  IF NEW.location_id IS NOT NULL AND NEW.total_tokens IS NOT NULL AND NEW.platform_cost_estimate IS NOT NULL THEN
    NEW.customer_cost_estimate := calculate_customer_cost(
      NEW.location_id,
      NEW.total_tokens,
      NEW.platform_cost_estimate
    );
    NEW.customer_cost_calculated := TRUE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS calculate_customer_cost_trigger ON ai_usage_logs;
CREATE TRIGGER calculate_customer_cost_trigger
BEFORE INSERT OR UPDATE ON ai_usage_logs
FOR EACH ROW
EXECUTE FUNCTION calculate_customer_cost_trigger();

-- Update all existing records
SELECT update_all_customer_costs();