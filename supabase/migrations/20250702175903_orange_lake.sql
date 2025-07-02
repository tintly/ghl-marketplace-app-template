/*
  # Add overwrite policy to data extraction fields

  1. Schema Changes
    - Add `overwrite_policy` column to `data_extraction_fields` table
    - Set default value to 'ask' for user confirmation
    - Add check constraint for valid policy values

  2. Valid Policy Values
    - 'always': Always overwrite existing data
    - 'never': Never overwrite existing data
    - 'only_empty': Only fill empty fields
    - 'ask': Ask user for confirmation (default)
*/

-- Add overwrite_policy column to data_extraction_fields table
ALTER TABLE data_extraction_fields 
ADD COLUMN IF NOT EXISTS overwrite_policy text DEFAULT 'ask';

-- Add check constraint for valid overwrite policy values
ALTER TABLE data_extraction_fields 
ADD CONSTRAINT data_extraction_fields_overwrite_policy_check 
CHECK (overwrite_policy IN ('always', 'never', 'only_empty', 'ask'));

-- Add index for better performance when querying by overwrite policy
CREATE INDEX IF NOT EXISTS idx_data_extraction_fields_overwrite_policy 
ON data_extraction_fields (overwrite_policy);

-- Add comment to document the purpose
COMMENT ON COLUMN data_extraction_fields.overwrite_policy IS 'Policy for handling existing data: always, never, only_empty, ask';