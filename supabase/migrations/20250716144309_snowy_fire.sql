/*
  # Add OpenAI model selection to agency_openai_keys

  1. New Columns
    - `openai_model` (text) - Stores the selected OpenAI model for the agency key
  
  2. Changes
    - Add default value of 'gpt-4o-mini' for the new column
*/

-- Add openai_model column to agency_openai_keys table
ALTER TABLE public.agency_openai_keys 
ADD COLUMN IF NOT EXISTS openai_model text NOT NULL DEFAULT 'gpt-4o-mini';

-- Update existing records to use the default model
UPDATE public.agency_openai_keys
SET openai_model = 'gpt-4o-mini'
WHERE openai_model IS NULL;