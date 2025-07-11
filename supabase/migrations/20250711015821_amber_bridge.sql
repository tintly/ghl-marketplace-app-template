/*
  # Add field_key column to data_extraction_fields

  1. New Columns
    - `field_key` (text) - The fieldKey from GHL for custom fields, or the target_ghl_key for standard fields
  
  2. Changes
    - Adds a new column to store the field key for easier identification
    - Adds a comment explaining the purpose of the column
*/

-- Add field_key column to data_extraction_fields
ALTER TABLE IF EXISTS public.data_extraction_fields
ADD COLUMN IF NOT EXISTS field_key text;

-- Add comment to explain the purpose of the column
COMMENT ON COLUMN public.data_extraction_fields.field_key IS 'The fieldKey from GHL for custom fields, or the target_ghl_key for standard fields';

-- Create a function to populate field_key for existing records
CREATE OR REPLACE FUNCTION populate_field_keys()
RETURNS void AS $$
DECLARE
  rec RECORD;
  field_key_value TEXT;
  original_data JSONB;
BEGIN
  FOR rec IN SELECT id, field_name, target_ghl_key, original_ghl_field_data FROM public.data_extraction_fields WHERE field_key IS NULL
  LOOP
    -- For standard fields (contains a dot), use the target_ghl_key
    IF rec.target_ghl_key LIKE '%.%' THEN
      field_key_value := rec.target_ghl_key;
    ELSE
      -- For custom fields, try to get fieldKey from original_ghl_field_data
      original_data := rec.original_ghl_field_data;
      
      IF original_data IS NOT NULL AND original_data ? 'fieldKey' THEN
        field_key_value := original_data->>'fieldKey';
      ELSE
        -- Generate a field key from the field name
        field_key_value := 'contact.' || lower(regexp_replace(regexp_replace(rec.field_name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '_', 'g'));
      END IF;
    END IF;
    
    -- Update the record
    UPDATE public.data_extraction_fields
    SET field_key = field_key_value
    WHERE id = rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the function to populate existing records
SELECT populate_field_keys();

-- Drop the function after use
DROP FUNCTION IF EXISTS populate_field_keys();