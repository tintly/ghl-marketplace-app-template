/*
  # Fix Standard Fields Mapping and Validation

  1. Changes
    - Add helper function to convert snake_case field keys to GHL's camelCase format
    - Update existing standard field entries to ensure proper field type
    - Add index for faster standard field lookups

  2. Benefits
    - Ensures standard fields like dateOfBirth are properly mapped
    - Improves performance for standard field lookups
    - Maintains compatibility with GHL API expectations
*/

-- Create a function to convert snake_case field keys to GHL's camelCase format
CREATE OR REPLACE FUNCTION convert_to_ghl_field_name(field_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_part text;
  ghl_key text;
BEGIN
  -- Remove 'contact.' prefix if present
  IF field_key LIKE 'contact.%' THEN
    key_part := substring(field_key FROM 9); -- 'contact.' is 8 chars + 1
  ELSE
    key_part := field_key;
  END IF;
  
  -- Map specific fields to their GHL API equivalents
  CASE key_part
    WHEN 'date_of_birth' THEN ghl_key := 'dateOfBirth';
    WHEN 'first_name' THEN ghl_key := 'firstName';
    WHEN 'last_name' THEN ghl_key := 'lastName';
    WHEN 'postal_code' THEN ghl_key := 'postalCode';
    WHEN 'phone_raw' THEN ghl_key := 'phone';
    WHEN 'full_address' THEN ghl_key := 'address';
    WHEN 'address1' THEN ghl_key := 'address1';
    WHEN 'company_name' THEN ghl_key := 'companyName';
    -- Fields that don't need conversion
    WHEN 'name' THEN ghl_key := 'name';
    WHEN 'email' THEN ghl_key := 'email';
    WHEN 'city' THEN ghl_key := 'city';
    WHEN 'state' THEN ghl_key := 'state';
    WHEN 'country' THEN ghl_key := 'country';
    WHEN 'website' THEN ghl_key := 'website';
    ELSE ghl_key := key_part;
  END CASE;
  
  RETURN ghl_key;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION convert_to_ghl_field_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_to_ghl_field_name(text) TO service_role;

-- Add comment to document the function
COMMENT ON FUNCTION convert_to_ghl_field_name(text) IS 'Converts snake_case field keys to GHL API camelCase format';

-- Create an index to speed up standard field lookups
CREATE INDEX IF NOT EXISTS idx_data_extraction_fields_standard_fields
ON data_extraction_fields (target_ghl_key)
WHERE target_ghl_key LIKE 'contact.%';

-- Update the field_type for standard date fields to ensure proper handling
UPDATE data_extraction_fields
SET field_type = 'DATE'
WHERE target_ghl_key = 'contact.date_of_birth';

-- Update the field_type for standard email fields
UPDATE data_extraction_fields
SET field_type = 'EMAIL'
WHERE target_ghl_key = 'contact.email';

-- Update the field_type for standard phone fields
UPDATE data_extraction_fields
SET field_type = 'PHONE'
WHERE target_ghl_key = 'contact.phone_raw';