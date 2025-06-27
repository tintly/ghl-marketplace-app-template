/*
  # Fix user_id column type from uuid to text

  1. Database Changes
    - Drop all RLS policies that depend on user_id columns
    - Drop foreign key constraints referencing user_id columns
    - Change user_id column types from uuid to text in all affected tables
    - Recreate RLS policies with proper text-based user ID handling

  2. Security
    - Maintain RLS protection by recreating policies after column changes
    - Use auth.uid()::text for proper comparison with text-based user IDs

  3. Tables Modified
    - ghl_configurations: user_id, created_by columns
    - user_profiles: user_id column
    - location_users: user_id, invited_by columns
    - location_invitations: invited_by, accepted_by columns
*/

-- Step 1: Drop ALL RLS policies that reference user_id columns
-- This must be done before altering column types

-- Drop ghl_configurations policies
DROP POLICY IF EXISTS "ghl_configs_all_own" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configs_select_own" ON ghl_configurations;

-- Drop user_profiles policies
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Drop location_users policies
DROP POLICY IF EXISTS "location_users_select_own" ON location_users;
DROP POLICY IF EXISTS "location_users_all_by_config_owner" ON location_users;

-- Drop location_invitations policies
DROP POLICY IF EXISTS "location_invitations_select_own_sent" ON location_invitations;
DROP POLICY IF EXISTS "location_invitations_all_by_config_owner" ON location_invitations;

-- Step 2: Drop foreign key constraints
ALTER TABLE ghl_configurations DROP CONSTRAINT IF EXISTS ghl_configurations_user_id_fkey;
ALTER TABLE ghl_configurations DROP CONSTRAINT IF EXISTS ghl_configurations_created_by_fkey;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;
ALTER TABLE location_users DROP CONSTRAINT IF EXISTS location_users_user_id_fkey;
ALTER TABLE location_users DROP CONSTRAINT IF EXISTS location_users_invited_by_fkey;
ALTER TABLE location_invitations DROP CONSTRAINT IF EXISTS location_invitations_invited_by_fkey;
ALTER TABLE location_invitations DROP CONSTRAINT IF EXISTS location_invitations_accepted_by_fkey;

-- Step 3: Change column types from uuid to text
ALTER TABLE ghl_configurations ALTER COLUMN user_id TYPE text;
ALTER TABLE ghl_configurations ALTER COLUMN created_by TYPE text;
ALTER TABLE user_profiles ALTER COLUMN user_id TYPE text;
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

-- Recreate user_profiles policies
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

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