/*
  # Fix Standard Field Types in data_extraction_fields

  1. Changes
    - Add 'standard' as a valid field_type value
    - Update existing standard fields to use the correct field_type
    - Ensure proper handling of standard vs custom fields

  2. Benefits
    - Fixes the issue with standard fields being treated as custom fields
    - Ensures proper API payload construction for GHL
    - Maintains backward compatibility with existing data
*/

-- First, update the field_type check constraint to include 'standard'
ALTER TABLE data_extraction_fields 
DROP CONSTRAINT IF EXISTS data_extraction_fields_field_type_check;

ALTER TABLE data_extraction_fields 
ADD CONSTRAINT data_extraction_fields_field_type_check 
CHECK (field_type = ANY (ARRAY[
  'TEXT'::text, 
  'NUMERICAL'::text, 
  'SINGLE_OPTIONS'::text, 
  'MULTIPLE_OPTIONS'::text, 
  'DATE'::text,
  'EMAIL'::text,
  'PHONE'::text,
  'standard'::text
]));

-- Update all fields with target_ghl_key containing a dot (.) to have field_type = 'standard'
UPDATE data_extraction_fields
SET field_type = 'standard'
WHERE target_ghl_key LIKE 'contact.%';

-- Add a comment explaining the field_type values
COMMENT ON COLUMN data_extraction_fields.field_type IS 
'Field type: TEXT, NUMERICAL, SINGLE_OPTIONS, MULTIPLE_OPTIONS, DATE, EMAIL, PHONE, or standard for built-in GHL fields';