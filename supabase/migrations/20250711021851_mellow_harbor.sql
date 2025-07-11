/*
  # Update field keys in data_extraction_fields

  1. Changes
     - Updates the field_key column to remove 'contact.' prefix
     - Updates the fieldKey in original_ghl_field_data to remove 'contact.' prefix
  
  2. Purpose
     - Simplifies field key storage to match the recommended approach
     - Makes field keys more consistent and easier to work with
*/

-- Update field_key column to remove 'contact.' prefix
UPDATE data_extraction_fields
SET field_key = REPLACE(field_key, 'contact.', '')
WHERE field_key LIKE 'contact.%';

-- Update fieldKey in original_ghl_field_data to remove 'contact.' prefix
UPDATE data_extraction_fields
SET original_ghl_field_data = jsonb_set(
  original_ghl_field_data,
  '{fieldKey}',
  to_jsonb(REPLACE(original_ghl_field_data->>'fieldKey', 'contact.', '')),
  true
)
WHERE original_ghl_field_data->>'fieldKey' LIKE 'contact.%';