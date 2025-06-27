/*
  # Make user_id nullable for OAuth installations

  1. Changes
    - Remove NOT NULL constraint from user_id column in ghl_configurations
    - This allows OAuth installations to work without user context
    - User can be linked later when they access the app through GHL SSO

  2. Security
    - RLS policies still protect data access
    - Only authenticated users can access their own configurations
*/

-- Make user_id nullable to support OAuth installations
ALTER TABLE ghl_configurations 
ALTER COLUMN user_id DROP NOT NULL;

-- Add a comment to explain why this is nullable
COMMENT ON COLUMN ghl_configurations.user_id IS 'User ID from GHL SSO. Can be null for OAuth installations that happen outside GHL context.';