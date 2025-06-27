/*
  # Add unique constraint for GHL account ID

  1. Database Changes
    - Add unique constraint on `ghl_account_id` in `ghl_configurations` table
    - This enables proper upsert functionality for OAuth installations

  2. Notes
    - This constraint ensures one configuration per GHL account
    - Supports the ON CONFLICT clause in upsert operations
*/

-- Add unique constraint on ghl_account_id
ALTER TABLE ghl_configurations 
ADD CONSTRAINT ghl_configurations_ghl_account_id_key 
UNIQUE (ghl_account_id);