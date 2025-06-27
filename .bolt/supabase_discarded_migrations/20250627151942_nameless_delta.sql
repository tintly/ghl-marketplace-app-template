/*
  # Update user_id columns from uuid to text

  1. Changes
    - Convert user_id related columns from uuid to text type
    - Update RLS policies to work with text-based user IDs
    - Only modify tables that actually exist in the database

  2. Security
    - Recreate all RLS policies with proper text-based comparisons
    - Maintain existing access control patterns

  3. Notes
    - Skips user_profiles table operations since it doesn't exist
    - Focuses on tables that are confirmed to exist in the schema
*/

-- Step 1: Drop ALL RLS policies that reference user_id columns
-- This must be done before altering column types

-- Drop ghl_configurations policies
DROP POLICY IF EXISTS "ghl_configs_all_own" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configs_select_own" ON ghl_configurations;

-- Drop location_users policies
DROP POLICY IF EXISTS "location_users_select_own" ON location_users;
DROP POLICY IF EXISTS "location_users_all_by_config_owner" ON location_users;

-- Drop location_invitations policies
DROP POLICY IF EXISTS "location_invitations_select_own_sent" ON location_invitations;
DROP POLICY IF EXISTS "location_invitations_all_by_config_owner" ON location_invitations;

-- Step 2: Drop foreign key constraints for existing tables
ALTER TABLE ghl_configurations DROP CONSTRAINT IF EXISTS ghl_configurations_user_id_fkey;
ALTER TABLE ghl_configurations DROP CONSTRAINT IF EXISTS ghl_configurations_created_by_fkey;
ALTER TABLE location_users DROP CONSTRAINT IF EXISTS location_users_user_id_fkey;
ALTER TABLE location_users DROP CONSTRAINT IF EXISTS location_users_invited_by_fkey;
ALTER TABLE location_invitations DROP CONSTRAINT IF EXISTS location_invitations_invited_by_fkey;
ALTER TABLE location_invitations DROP CONSTRAINT IF EXISTS location_invitations_accepted_by_fkey;

-- Step 3: Change column types from uuid to text for existing tables only
ALTER TABLE ghl_configurations ALTER COLUMN user_id TYPE text;
ALTER TABLE ghl_configurations ALTER COLUMN created_by TYPE text;
ALTER TABLE location_users ALTER COLUMN user_id TYPE text;
ALTER TABLE location_users ALTER COLUMN invited_by TYPE text;
ALTER TABLE location_invitations ALTER COLUMN invited_by TYPE text;
ALTER TABLE location_invitations ALTER COLUMN accepted_by TYPE text;

-- Step 4: Recreate RLS policies with text-based user ID handling

-- Recreate ghl_configurations policies
CREATE POLICY "ghl_configs_all_own" ON ghl_configurations
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "ghl_configs_select_own" ON ghl_configurations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

-- Recreate location_users policies
CREATE POLICY "location_users_select_own" ON location_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "location_users_all_by_config_owner" ON location_users
  FOR ALL TO authenticated
  USING (location_config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

-- Recreate location_invitations policies
CREATE POLICY "location_invitations_select_own_sent" ON location_invitations
  FOR SELECT TO authenticated
  USING (invited_by = auth.uid()::text);

CREATE POLICY "location_invitations_all_by_config_owner" ON location_invitations
  FOR ALL TO authenticated
  USING (location_config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));