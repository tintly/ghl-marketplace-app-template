/*
  # Simplify overwrite policies - remove 'ask' option

  1. Schema Changes
    - Update check constraint to remove 'ask' option
    - Update existing 'ask' policies to 'always' (default behavior)

  2. Valid Policy Values (simplified)
    - 'always': Always overwrite existing data (default)
    - 'never': Never overwrite existing data
    - 'only_empty': Only fill empty fields
*/

-- Update existing 'ask' policies to 'always' (the new default)
UPDATE data_extraction_fields 
SET overwrite_policy = 'always' 
WHERE overwrite_policy = 'ask';

-- Update the check constraint to remove 'ask' option
ALTER TABLE data_extraction_fields 
DROP CONSTRAINT IF EXISTS data_extraction_fields_overwrite_policy_check;

ALTER TABLE data_extraction_fields 
ADD CONSTRAINT data_extraction_fields_overwrite_policy_check 
CHECK (overwrite_policy IN ('always', 'never', 'only_empty'));

-- Update the default value to 'always'
ALTER TABLE data_extraction_fields 
ALTER COLUMN overwrite_policy SET DEFAULT 'always';

-- Update the comment to reflect the simplified options
COMMENT ON COLUMN data_extraction_fields.overwrite_policy IS 'Policy for handling existing data: always, never, only_empty';