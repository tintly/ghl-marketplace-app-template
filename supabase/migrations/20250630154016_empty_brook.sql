/*
  # Add original GHL field data storage

  1. Schema Changes
    - Add `original_ghl_field_data` jsonb column to `data_extraction_fields` table
    - This will store the complete GHL custom field response for recreation purposes

  2. Benefits
    - Enables field recreation when GHL fields are deleted
    - Preserves all original metadata including parentId, position, etc.
    - Flexible storage for future GHL API changes
*/

-- Add jsonb column to store original GHL field data
ALTER TABLE data_extraction_fields 
ADD COLUMN IF NOT EXISTS original_ghl_field_data jsonb DEFAULT '{}'::jsonb;

-- Add index for better performance when querying original field data
CREATE INDEX IF NOT EXISTS idx_data_extraction_fields_original_data 
ON data_extraction_fields USING gin (original_ghl_field_data);

-- Add comment to document the purpose
COMMENT ON COLUMN data_extraction_fields.original_ghl_field_data IS 'Complete GHL custom field response data for recreation and debugging purposes';