/*
  # Add fieldKey to data_extraction_fields

  1. New Fields
    - Add `field_key` column to `data_extraction_fields` table
    - This column will store the original fieldKey from GHL for custom fields
    
  2. Migration Function
    - Create a function to extract and populate fieldKey from original_ghl_field_data
    - This ensures existing records are updated with the correct fieldKey
*/

-- Add field_key column to data_extraction_fields table
ALTER TABLE public.data_extraction_fields 
ADD COLUMN IF NOT EXISTS field_key text;

-- Create a function to extract fieldKey from original_ghl_field_data
CREATE OR REPLACE FUNCTION extract_field_keys() RETURNS void AS $$
DECLARE
  field_record RECORD;
BEGIN
  FOR field_record IN 
    SELECT id, original_ghl_field_data, target_ghl_key 
    FROM public.data_extraction_fields
    WHERE field_key IS NULL
  LOOP
    -- For standard fields, use target_ghl_key as field_key
    IF field_record.target_ghl_key LIKE '%.%' THEN
      UPDATE public.data_extraction_fields
      SET field_key = target_ghl_key
      WHERE id = field_record.id;
    -- For custom fields, extract fieldKey from original_ghl_field_data
    ELSIF field_record.original_ghl_field_data IS NOT NULL AND 
          field_record.original_ghl_field_data->>'fieldKey' IS NOT NULL THEN
      UPDATE public.data_extraction_fields
      SET field_key = field_record.original_ghl_field_data->>'fieldKey'
      WHERE id = field_record.id;
    -- Fallback: create a field key from field_name
    ELSE
      UPDATE public.data_extraction_fields
      SET field_key = 'custom_field_' || field_record.target_ghl_key
      WHERE id = field_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the function to populate existing records
SELECT extract_field_keys();

-- Add comment to explain the field_key column
COMMENT ON COLUMN public.data_extraction_fields.field_key IS 'The fieldKey from GHL for custom fields, or the target_ghl_key for standard fields';