/*
  # Fix Standard Field Handling and Add Services Field Support

  1. Changes
    - Add proper handling for services field in contact updates
    - Update field type validation for standard fields
    - Add helper function to validate GHL API field names

  2. Benefits
    - Prevents API errors when updating contacts
    - Ensures proper field type mapping
    - Improves data extraction reliability
*/

-- Create a function to validate GHL API field names
CREATE OR REPLACE FUNCTION is_valid_ghl_field(field_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN field_name IN (
    'firstName', 'lastName', 'name', 'email', 'phone', 
    'companyName', 'address1', 'city', 'state', 'country', 
    'postalCode', 'website', 'dateOfBirth', 'tags'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_valid_ghl_field(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_ghl_field(text) TO service_role;

-- Add comment to document the function
COMMENT ON FUNCTION is_valid_ghl_field(text) IS 'Validates if a field name is a valid GHL API standard field';

-- Update the field mapping for services field to ensure it's handled as a custom field
UPDATE data_extraction_fields
SET field_type = 'TEXT'
WHERE field_name ILIKE '%service%' AND target_ghl_key NOT LIKE 'contact.%';

-- Create a view to help debug field mappings
CREATE OR REPLACE VIEW field_mapping_debug AS
SELECT 
  field_name,
  target_ghl_key,
  field_type,
  CASE 
    WHEN target_ghl_key LIKE 'contact.%' THEN convert_to_ghl_field_name(target_ghl_key)
    ELSE target_ghl_key
  END AS ghl_api_field_name,
  is_standard_field(target_ghl_key) AS is_standard,
  is_valid_ghl_field(convert_to_ghl_field_name(target_ghl_key)) AS is_valid_ghl_field,
  overwrite_policy
FROM 
  data_extraction_fields
ORDER BY 
  is_standard_field(target_ghl_key) DESC, field_name;

-- Grant access to the view
GRANT SELECT ON field_mapping_debug TO authenticated;
GRANT SELECT ON field_mapping_debug TO service_role;