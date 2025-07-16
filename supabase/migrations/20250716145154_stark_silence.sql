/*
  # Add OpenAI Model Pricing Information
  
  1. New Tables
    - `openai_model_pricing` - Stores pricing information for different OpenAI models
      - `id` (uuid, primary key)
      - `model_id` (text, unique)
      - `input_price_per_million` (numeric)
      - `output_price_per_million` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on the new table
    - Add policies for service role and authenticated users
*/

-- Create table for OpenAI model pricing
CREATE TABLE IF NOT EXISTS public.openai_model_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text UNIQUE NOT NULL,
  input_price_per_million numeric(10,3) NOT NULL,
  output_price_per_million numeric(10,3) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.openai_model_pricing ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "service_role_all_openai_model_pricing" 
  ON public.openai_model_pricing
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_select_openai_model_pricing" 
  ON public.openai_model_pricing
  FOR SELECT
  TO authenticated
  USING (true);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_openai_model_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_openai_model_pricing_updated_at
BEFORE UPDATE ON public.openai_model_pricing
FOR EACH ROW
EXECUTE FUNCTION update_openai_model_pricing_updated_at();

-- Insert pricing data for all models
INSERT INTO public.openai_model_pricing (model_id, input_price_per_million, output_price_per_million)
VALUES
  -- GPT-4 series
  ('gpt-4.1', 2.00, 8.00),
  ('gpt-4.1-mini', 0.40, 1.60),
  ('gpt-4.1-nano', 0.10, 0.40),
  ('gpt-4.5-preview', 75.00, 150.00),
  ('gpt-4o', 2.50, 10.00),
  ('gpt-4o-mini', 0.15, 0.60),
  
  -- O series
  ('o1', 15.00, 60.00),
  ('o1-mini', 1.10, 4.40),
  ('o1-pro', 150.00, 600.00),
  ('o3', 2.00, 8.00),
  ('o3-mini', 1.10, 4.40),
  ('o3-pro', 20.00, 80.00),
  ('o4-mini', 1.10, 4.40)
ON CONFLICT (model_id) 
DO UPDATE SET 
  input_price_per_million = EXCLUDED.input_price_per_million,
  output_price_per_million = EXCLUDED.output_price_per_million,
  updated_at = now();

-- Add function to calculate cost based on tokens and model
CREATE OR REPLACE FUNCTION calculate_openai_cost(
  p_model_id text,
  p_input_tokens integer,
  p_output_tokens integer
)
RETURNS numeric AS $$
DECLARE
  v_input_price numeric;
  v_output_price numeric;
  v_total_cost numeric;
BEGIN
  -- Get pricing for the model
  SELECT 
    input_price_per_million, 
    output_price_per_million
  INTO 
    v_input_price, 
    v_output_price
  FROM 
    public.openai_model_pricing
  WHERE 
    model_id = p_model_id;
  
  -- If model not found, use gpt-4o-mini as default
  IF v_input_price IS NULL THEN
    SELECT 
      input_price_per_million, 
      output_price_per_million
    INTO 
      v_input_price, 
      v_output_price
    FROM 
      public.openai_model_pricing
    WHERE 
      model_id = 'gpt-4o-mini';
  END IF;
  
  -- Calculate cost
  v_total_cost := (p_input_tokens * v_input_price / 1000000) + 
                  (p_output_tokens * v_output_price / 1000000);
  
  RETURN round(v_total_cost, 6);
END;
$$ LANGUAGE plpgsql;

-- Add a column to store the model used in ai_usage_logs
ALTER TABLE public.ai_usage_logs 
ADD COLUMN IF NOT EXISTS model_used text;

-- Update the calculate_customer_cost_trigger function to use the new pricing
CREATE OR REPLACE FUNCTION calculate_customer_cost_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_cost numeric;
BEGIN
  -- Use the new function to calculate cost based on model
  IF NEW.model IS NOT NULL AND NEW.input_tokens > 0 THEN
    v_customer_cost := calculate_openai_cost(
      NEW.model, 
      NEW.input_tokens, 
      NEW.output_tokens
    );
    
    NEW.customer_cost_estimate := v_customer_cost;
    NEW.customer_cost_calculated := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;