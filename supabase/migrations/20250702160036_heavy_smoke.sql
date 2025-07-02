/*
  # AI Usage Logging Table

  1. New Tables
    - `ai_usage_logs`
      - `id` (uuid, primary key)
      - `location_id` (text, indexed) - The GHL location ID
      - `model` (text) - OpenAI model used (e.g., gpt-4, gpt-3.5-turbo)
      - `input_tokens` (integer) - Number of input tokens
      - `output_tokens` (integer) - Number of output tokens
      - `total_tokens` (integer) - Total tokens used
      - `cost_estimate` (decimal) - Estimated cost in USD
      - `conversation_id` (text) - Related conversation ID
      - `extraction_type` (text) - Type of extraction performed
      - `success` (boolean) - Whether the extraction was successful
      - `error_message` (text) - Error message if failed
      - `response_time_ms` (integer) - Response time in milliseconds
      - `created_at` (timestamptz)

  2. Indexes
    - Location ID for filtering by location
    - Model for usage analysis
    - Created at for time-based queries
    - Success status for error analysis

  3. Security
    - Enable RLS on `ai_usage_logs` table
    - Add policy for service role (edge functions)
    - Add policy for authenticated users to read their location's usage
*/

-- Create the AI usage logs table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cost_estimate decimal(10,6) DEFAULT 0.000000,
  conversation_id text,
  extraction_type text DEFAULT 'data_extraction',
  success boolean NOT NULL DEFAULT false,
  error_message text,
  response_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_location_id ON ai_usage_logs (location_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON ai_usage_logs (model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_success ON ai_usage_logs (success, location_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_conversation ON ai_usage_logs (conversation_id);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_location_date ON ai_usage_logs (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_location_model ON ai_usage_logs (location_id, model, created_at DESC);

-- Enable Row Level Security
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service role (edge functions can insert/update anything)
CREATE POLICY "service_role_all_ai_usage_logs"
  ON ai_usage_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users (can only read their location's usage)
CREATE POLICY "ai_usage_logs_jwt_select"
  ON ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_has_location_access(location_id)
  );

-- Add helpful comments
COMMENT ON TABLE ai_usage_logs IS 'Logs AI API usage for billing and analytics purposes';
COMMENT ON COLUMN ai_usage_logs.cost_estimate IS 'Estimated cost in USD based on token usage and model pricing';
COMMENT ON COLUMN ai_usage_logs.extraction_type IS 'Type of AI extraction: data_extraction, prompt_generation, etc.';