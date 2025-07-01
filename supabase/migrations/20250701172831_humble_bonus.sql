/*
  # Fix field type constraints and standard field support

  1. Database Updates
    - Update field_type check constraint to include all valid types
    - Ensure proper field type mapping for standard fields
  
  2. Standard Field Support
    - Fix field type validation for EMAIL and PHONE types
    - Update constraint to allow all standard field types
*/

-- Update the field_type check constraint to include EMAIL and PHONE types
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
  'PHONE'::text
]));

-- Add index for better performance on field_type queries
CREATE INDEX IF NOT EXISTS idx_data_extraction_fields_field_type 
ON data_extraction_fields (field_type);

-- Add index for target_ghl_key for better lookup performance
CREATE INDEX IF NOT EXISTS idx_data_extraction_fields_target_key 
ON data_extraction_fields (target_ghl_key);