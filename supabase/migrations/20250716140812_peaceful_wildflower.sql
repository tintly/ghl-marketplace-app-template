/*
  # Fix Usage Statistics for Custom OpenAI Keys

  1. New Functions
    - `get_agency_usage_statistics` - Gets usage statistics for an agency's custom OpenAI keys
    - `calculate_customer_cost` - Calculates the customer cost based on token usage

  2. Triggers
    - Add trigger to update usage tracking table when AI usage logs are created
    
  3. Views
    - Add view for agency usage statistics
*/

-- Function to get agency usage statistics
CREATE OR REPLACE FUNCTION get_agency_usage_statistics(agency_id TEXT, timeframe TEXT DEFAULT '30d')
RETURNS JSONB AS $$
DECLARE
  date_filter TIMESTAMP;
  result JSONB;
BEGIN
  -- Set date filter based on timeframe
  CASE timeframe
    WHEN '7d' THEN date_filter := NOW() - INTERVAL '7 days';
    WHEN '30d' THEN date_filter := NOW() - INTERVAL '30 days';
    WHEN '90d' THEN date_filter := NOW() - INTERVAL '90 days';
    ELSE date_filter := NOW() - INTERVAL '30 days';
  END CASE;

  -- Get usage statistics
  SELECT jsonb_build_object(
    'total_requests', COUNT(*),
    'total_tokens', COALESCE(SUM(total_tokens), 0),
    'total_cost', COALESCE(SUM(cost_estimate), 0),
    'by_model', (
      SELECT jsonb_object_agg(
        model, 
        jsonb_build_object(
          'requests', COUNT(*),
          'tokens', COALESCE(SUM(total_tokens), 0),
          'cost', COALESCE(SUM(cost_estimate), 0)
        )
      )
      FROM ai_usage_logs
      WHERE agency_ghl_id = agency_id
      AND created_at >= date_filter
      GROUP BY model
    ),
    'by_key', (
      SELECT jsonb_object_agg(
        COALESCE(openai_key_used, 'default'),
        jsonb_build_object(
          'requests', COUNT(*),
          'tokens', COALESCE(SUM(total_tokens), 0),
          'cost', COALESCE(SUM(cost_estimate), 0)
        )
      )
      FROM ai_usage_logs
      WHERE agency_ghl_id = agency_id
      AND created_at >= date_filter
      GROUP BY openai_key_used
    ),
    'daily_usage', (
      SELECT jsonb_object_agg(
        TO_CHAR(created_at, 'YYYY-MM-DD'),
        jsonb_build_object(
          'requests', COUNT(*),
          'tokens', COALESCE(SUM(total_tokens), 0),
          'cost', COALESCE(SUM(cost_estimate), 0)
        )
      )
      FROM ai_usage_logs
      WHERE agency_ghl_id = agency_id
      AND created_at >= date_filter
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    )
  ) INTO result
  FROM ai_usage_logs
  WHERE agency_ghl_id = agency_id
  AND created_at >= date_filter;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate customer cost
CREATE OR REPLACE FUNCTION calculate_customer_cost() 
RETURNS TRIGGER AS $$
DECLARE
  customer_cost NUMERIC(10,6);
  platform_cost NUMERIC(10,6);
  markup_factor NUMERIC(10,6) := 1.3; -- 30% markup
BEGIN
  -- Calculate costs
  platform_cost := NEW.cost_estimate;
  customer_cost := platform_cost * markup_factor;
  
  -- Update the record
  NEW.platform_cost_estimate := platform_cost;
  NEW.customer_cost_estimate := customer_cost;
  NEW.customer_cost_calculated := TRUE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to calculate customer cost
DROP TRIGGER IF EXISTS calculate_customer_cost_trigger ON ai_usage_logs;
CREATE TRIGGER calculate_customer_cost_trigger
BEFORE INSERT OR UPDATE ON ai_usage_logs
FOR EACH ROW
EXECUTE FUNCTION calculate_customer_cost_trigger();

-- Create view for agency usage statistics
CREATE OR REPLACE VIEW agency_usage_statistics AS
SELECT 
  agency_ghl_id,
  DATE_TRUNC('day', created_at) AS usage_date,
  COUNT(*) AS requests,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_estimate) AS platform_cost,
  SUM(customer_cost_estimate) AS customer_cost,
  COUNT(DISTINCT openai_key_used) AS unique_keys_used
FROM 
  ai_usage_logs
WHERE 
  agency_ghl_id IS NOT NULL
GROUP BY 
  agency_ghl_id, DATE_TRUNC('day', created_at)
ORDER BY 
  agency_ghl_id, DATE_TRUNC('day', created_at) DESC;

-- Update usage tracking function to include custom key usage
CREATE OR REPLACE FUNCTION update_usage_tracking_from_logs() 
RETURNS TRIGGER AS $$
DECLARE
  month_year TEXT;
  location_id TEXT;
BEGIN
  -- Format month_year as YYYY-MM
  month_year := TO_CHAR(NEW.created_at, 'YYYY-MM');
  location_id := NEW.location_id;
  
  -- Update usage tracking
  INSERT INTO usage_tracking (
    location_id, 
    month_year, 
    messages_used, 
    tokens_used, 
    cost_estimate,
    custom_key_used
  ) VALUES (
    location_id,
    month_year,
    1, -- One message
    NEW.total_tokens,
    NEW.customer_cost_estimate,
    NEW.openai_key_used IS NOT NULL
  )
  ON CONFLICT (location_id, month_year) 
  DO UPDATE SET
    messages_used = usage_tracking.messages_used + 1,
    tokens_used = usage_tracking.tokens_used + NEW.total_tokens,
    cost_estimate = usage_tracking.cost_estimate + NEW.customer_cost_estimate,
    custom_key_used = usage_tracking.custom_key_used OR (NEW.openai_key_used IS NOT NULL),
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS update_usage_tracking_trigger ON ai_usage_logs;
CREATE TRIGGER update_usage_tracking_trigger
AFTER INSERT ON ai_usage_logs
FOR EACH ROW
EXECUTE FUNCTION update_usage_tracking_from_logs();

-- Add custom_key_used column to usage_tracking if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usage_tracking' AND column_name = 'custom_key_used'
  ) THEN
    ALTER TABLE usage_tracking ADD COLUMN custom_key_used BOOLEAN DEFAULT FALSE;
  END IF;
END $$;