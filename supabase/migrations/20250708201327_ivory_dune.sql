/*
  # Fix Field Handling for GHL Contact Updates

  1. Changes
    - Add function to validate standard GHL fields
    - Create view to help debug field mapping issues
    - Add helper function to properly map field types
    - Fix handling of custom vs standard fields

  2. Security
    - Maintain existing RLS policies
    - Grant proper function permissions
*/

-- Create a function to validate if a field is a valid GHL standard field
CREATE OR REPLACE FUNCTION is_valid_ghl_standard_field(field_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  valid_fields text[] := ARRAY[
    'firstName', 'lastName', 'name', 'email', 'phone', 
    'companyName', 'address1', 'city', 'state', 'country', 
    'postalCode', 'website', 'dateOfBirth', 'tags', 'address',
    'timezone', 'source', 'type', 'assignedTo'
  ];
BEGIN
  RETURN field_name = ANY(valid_fields);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_valid_ghl_standard_field(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_ghl_standard_field(text) TO service_role;

-- Create a view to help debug field mapping issues
CREATE OR REPLACE VIEW field_mapping_debug AS
SELECT 
  def.id,
  def.field_name,
  def.target_ghl_key,
  def.field_type,
  def.overwrite_policy,
  CASE 
    WHEN def.target_ghl_key LIKE 'contact.%' THEN 'standard'
    ELSE 'custom'
  END AS field_category,
  CASE 
    WHEN def.target_ghl_key LIKE 'contact.%' THEN 
      convert_to_ghl_field_name(def.target_ghl_key)
    ELSE def.target_ghl_key
  END AS ghl_api_key,
  is_valid_ghl_standard_field(
    CASE 
      WHEN def.target_ghl_key LIKE 'contact.%' THEN 
        convert_to_ghl_field_name(def.target_ghl_key)
      ELSE NULL
    END
  ) AS is_valid_standard_field,
  gc.business_name,
  gc.ghl_account_id
FROM 
  data_extraction_fields def
JOIN 
  ghl_configurations gc ON def.config_id = gc.id;

-- Add comment to document the view
COMMENT ON VIEW field_mapping_debug IS 'Debug view to help identify field mapping issues between extraction fields and GHL API';

-- Create a function to determine if a field should be treated as a custom field
CREATE OR REPLACE FUNCTION should_treat_as_custom_field(field_key text, field_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If it doesn't start with contact., it's definitely a custom field
  IF field_key NOT LIKE 'contact.%' THEN
    RETURN TRUE;
  END IF;
  
  -- Get the standard field name that would be used in the GHL API
  DECLARE
    standard_field_name text := convert_to_ghl_field_name(field_key);
  BEGIN
    -- If it's not a valid GHL standard field, treat as custom
    IF NOT is_valid_ghl_standard_field(standard_field_name) THEN
      RETURN TRUE;
    END IF;
  END;
  
  -- Otherwise, it's a standard field
  RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION should_treat_as_custom_field(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION should_treat_as_custom_field(text, text) TO service_role;

-- Add comment to document the function
COMMENT ON FUNCTION should_treat_as_custom_field(text, text) IS 'Determines if a field should be treated as a custom field in GHL API requests';