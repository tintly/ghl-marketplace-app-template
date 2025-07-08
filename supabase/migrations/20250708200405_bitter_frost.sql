/*
  # Fix Standard Fields Extraction

  1. Changes
    - Add a function to determine if a field key is a standard field
    - Update existing extraction fields to properly identify standard fields
    - Add helper function for GHL API field name conversion

  2. Standard Field Handling
    - Properly identify fields like contact.name, contact.email, contact.date_of_birth as standard
    - Ensure correct mapping between snake_case field keys and camelCase GHL API fields
*/

-- Create a function to check if a field key is a standard field
CREATE OR REPLACE FUNCTION is_standard_field(field_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Standard fields have keys that start with 'contact.' followed by a field name
  RETURN field_key LIKE 'contact.%';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_standard_field(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_standard_field(text) TO service_role;

-- Update existing extraction fields to mark standard fields correctly
UPDATE data_extraction_fields
SET field_type = 
  CASE 
    WHEN target_ghl_key LIKE 'contact.%' THEN 
      CASE
        WHEN target_ghl_key = 'contact.email' THEN 'EMAIL'
        WHEN target_ghl_key = 'contact.phone_raw' THEN 'PHONE'
        WHEN target_ghl_key = 'contact.date_of_birth' THEN 'DATE'
        ELSE 'TEXT'
      END
    ELSE field_type
  END
WHERE target_ghl_key LIKE 'contact.%';

-- Add comment to document the changes
COMMENT ON FUNCTION is_standard_field(text) IS 'Helper function to determine if a field key represents a standard GHL contact field';