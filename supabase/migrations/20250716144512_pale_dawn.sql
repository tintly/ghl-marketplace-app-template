/*
  # Add OpenAI model selection to agency keys

  1. New Columns
    - `openai_model` (text) - Stores the selected OpenAI model for the agency key
    
  2. Changes
    - Added default value of 'gpt-4o-mini' for the openai_model column
*/

-- Add openai_model column to agency_openai_keys table
ALTER TABLE public.agency_openai_keys 
ADD COLUMN IF NOT EXISTS openai_model text DEFAULT 'gpt-4o-mini';

-- Add comment to explain the column
COMMENT ON COLUMN public.agency_openai_keys.openai_model IS 'The OpenAI model to use with this API key';