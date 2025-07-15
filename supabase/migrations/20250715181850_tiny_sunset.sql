/*
  # Add OpenAI Usage Statistics Function

  1. New Functions
    - `get_agency_openai_usage` - Returns usage statistics for an agency's OpenAI keys
  
  2. Purpose
    - Provides a more efficient way to query and aggregate OpenAI usage data
    - Handles edge cases and ensures consistent data format
*/

-- Function to get agency OpenAI usage statistics
CREATE OR REPLACE FUNCTION get_agency_openai_usage(
  p_agency_id TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_date_filter TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set date filter based on days parameter
  v_date_filter := NOW() - (p_days || ' days')::INTERVAL;
  
  -- Get usage data
  WITH usage_data AS (
    SELECT
      model,
      total_tokens,
      cost_estimate,
      created_at,
      openai_key_used
    FROM
      ai_usage_logs
    WHERE
      agency_ghl_id = p_agency_id
      AND created_at >= v_date_filter
  ),
  
  -- Calculate summary statistics
  summary AS (
    SELECT
      COUNT(*) AS total_requests,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(cost_estimate), 0) AS total_cost
    FROM
      usage_data
  ),
  
  -- Group by model
  by_model AS (
    SELECT
      model,
      COUNT(*) AS requests,
      COALESCE(SUM(total_tokens), 0) AS tokens,
      COALESCE(SUM(cost_estimate), 0) AS cost
    FROM
      usage_data
    GROUP BY
      model
  ),
  
  -- Group by key
  by_key AS (
    SELECT
      COALESCE(openai_key_used, 'default') AS key_used,
      COUNT(*) AS requests,
      COALESCE(SUM(total_tokens), 0) AS tokens,
      COALESCE(SUM(cost_estimate), 0) AS cost
    FROM
      usage_data
    GROUP BY
      COALESCE(openai_key_used, 'default')
  ),
  
  -- Group by day
  daily_usage AS (
    SELECT
      TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
      COUNT(*) AS requests,
      COALESCE(SUM(total_tokens), 0) AS tokens,
      COALESCE(SUM(cost_estimate), 0) AS cost
    FROM
      usage_data
    GROUP BY
      TO_CHAR(created_at, 'YYYY-MM-DD')
  )
  
  -- Build the final result
  SELECT
    JSONB_BUILD_OBJECT(
      'total_requests', COALESCE((SELECT total_requests FROM summary), 0),
      'total_tokens', COALESCE((SELECT total_tokens FROM summary), 0),
      'total_cost', COALESCE((SELECT total_cost FROM summary), 0),
      'by_model', COALESCE(
        (SELECT 
          JSONB_OBJECT_AGG(
            model, 
            JSONB_BUILD_OBJECT(
              'requests', requests,
              'tokens', tokens,
              'cost', cost
            )
          )
        FROM by_model),
        '{}'::JSONB
      ),
      'by_key', COALESCE(
        (SELECT 
          JSONB_OBJECT_AGG(
            key_used, 
            JSONB_BUILD_OBJECT(
              'requests', requests,
              'tokens', tokens,
              'cost', cost
            )
          )
        FROM by_key),
        '{}'::JSONB
      ),
      'daily_usage', COALESCE(
        (SELECT 
          JSONB_OBJECT_AGG(
            date, 
            JSONB_BUILD_OBJECT(
              'requests', requests,
              'tokens', tokens,
              'cost', cost
            )
          )
        FROM daily_usage),
        '{}'::JSONB
      )
    ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_agency_openai_usage(TEXT, INTEGER) TO authenticated;