/*
  # Fix location_users user_id constraint for OAuth installations

  1. Changes
    - Make user_id nullable in location_users table
    - Update the add_location_owner trigger function to handle null user_id
    - This allows OAuth installations to work without immediate user context

  2. Security
    - RLS policies still protect data access
    - Users can be added to locations later when they access through GHL SSO
*/

-- Make user_id nullable in location_users to support OAuth installations
ALTER TABLE location_users 
ALTER COLUMN user_id DROP NOT NULL;

-- Add a comment to explain why this is nullable
COMMENT ON COLUMN location_users.user_id IS 'User ID from GHL SSO. Can be null initially for OAuth installations.';

-- Update the trigger function to handle null user_id
CREATE OR REPLACE FUNCTION add_location_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Only add location owner if user_id is provided
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO location_users (
      location_config_id,
      user_id,
      role,
      invited_by
    ) VALUES (
      NEW.id,
      NEW.user_id,
      'owner',
      NEW.created_by
    )
    ON CONFLICT (location_config_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;