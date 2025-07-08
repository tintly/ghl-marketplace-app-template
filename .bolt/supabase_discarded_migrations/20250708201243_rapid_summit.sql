/*
  # Fix services_mentioned field and improve field type handling

  1. Changes
    - Ensure services_mentioned is properly handled as a custom field
    - Add validation for standard vs custom field detection
    - Create a view to help debug field mapping issues
    - Add helper functions for field type detection

  2. Benefits
    - Prevents "property services_mentioned should not exist" API errors
    - Improves reliability of field updates
    - Makes it easier to diagnose field mapping problems
*/

-- Create a view to help debug field mappings
CREATE OR REPLACE VIEW field_mapping_debug AS
SELECT 
  def.id,
  def.field_name,
  def.target_ghl_key,
  def.field_type,
  is_standard_field(def.target_ghl_key) AS is_standard,
  convert_to_ghl_field_name(def.target_ghl_key) AS ghl_api_field_name,
  def.overwrite_policy,
  def.config_id,
  gc.business_name,
  gc.ghl_account_id
FROM 
  data_extraction_fields def
JOIN
  ghl_configurations gc ON def.config_id = gc.id
WHERE 
  gc.is_active = true;

-- Grant access to the view
GRANT SELECT ON field_mapping_debug TO authenticated;
GRANT SELECT ON field_mapping_debug TO service_role;

-- Create a function to validate if a field is a valid GHL standard field
CREATE OR REPLACE FUNCTION is_valid_ghl_standard_field(field_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN field_name = ANY(ARRAY[
    'firstName', 'lastName', 'name', 'email', 'phone', 
    'companyName', 'address1', 'city', 'state', 'country', 
    'postalCode', 'website', 'dateOfBirth', 'tags'
  ]);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_valid_ghl_standard_field(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_ghl_standard_field(text) TO service_role;

-- Update any services_mentioned fields to ensure they're treated as custom fields
UPDATE data_extraction_fields
SET field_type = 'TEXT',
    target_ghl_key = 
      CASE 
        -- If it's already a UUID or doesn't start with 'contact.', keep it as is
        WHEN target_ghl_key NOT LIKE 'contact.%' THEN target_ghl_key
        -- Otherwise, check if we have original field data with an ID
        WHEN original_ghl_field_data->>'id' IS NOT NULL THEN original_ghl_field_data->>'id'
        -- If all else fails, keep the original key
        ELSE target_ghl_key
      END
WHERE field_name = 'Services Mentioned' 
   OR field_name = 'Services Requested'
   OR field_name ILIKE '%service%'
   OR target_ghl_key = 'contact.services_mentioned'
   OR target_ghl_key = 'contact.services_requested';

-- Add comment to document the changes
COMMENT ON VIEW field_mapping_debug IS 'Debug view to help identify field mapping issues between extraction fields and GHL API';
COMMENT ON FUNCTION is_valid_ghl_standard_field(text) IS 'Checks if a field name is a valid GHL standard field that can be used at the top level of the contact object';