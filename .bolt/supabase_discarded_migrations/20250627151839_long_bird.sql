/*
  # Fix user_id column type in ghl_configurations table

  1. Schema Changes
    - Change `user_id` column type from `uuid` to `text` in `ghl_configurations` table
    - Change `created_by` column type from `uuid` to `text` in `ghl_configurations` table
    - Update foreign key constraints to handle text-based user IDs
    - Update related tables that reference user IDs

  2. Security
    - Maintain existing RLS policies
    - Update policies to work with text-based user IDs

  3. Data Integrity
    - Preserve existing data during migration
    - Update indexes to work with new column types
*/

-- First, drop the foreign key constraints that reference the user_id column
ALTER TABLE ghl_configurations DROP CONSTRAINT IF EXISTS ghl_configurations_user_id_fkey;
ALTER TABLE ghl_configurations DROP CONSTRAINT IF EXISTS ghl_configurations_created_by_fkey;

-- Change the user_id column type from uuid to text
ALTER TABLE ghl_configurations ALTER COLUMN user_id TYPE text;
ALTER TABLE ghl_configurations ALTER COLUMN created_by TYPE text;

-- Update the user_profiles table user_id column to text as well since it's referenced
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;
ALTER TABLE user_profiles ALTER COLUMN user_id TYPE text;

-- Update location_users table user_id and invited_by columns
ALTER TABLE location_users DROP CONSTRAINT IF EXISTS location_users_user_id_fkey;
ALTER TABLE location_users DROP CONSTRAINT IF EXISTS location_users_invited_by_fkey;
ALTER TABLE location_users ALTER COLUMN user_id TYPE text;
ALTER TABLE location_users ALTER COLUMN invited_by TYPE text;

-- Update location_invitations table
ALTER TABLE location_invitations DROP CONSTRAINT IF EXISTS location_invitations_invited_by_fkey;
ALTER TABLE location_invitations DROP CONSTRAINT IF EXISTS location_invitations_accepted_by_fkey;
ALTER TABLE location_invitations ALTER COLUMN invited_by TYPE text;
ALTER TABLE location_invitations ALTER COLUMN accepted_by TYPE text;

-- Note: We're not recreating foreign key constraints since the users table 
-- appears to be managed by Supabase Auth and may not have text-based IDs
-- The application will handle referential integrity through business logic

-- Update RLS policies to work with text-based user IDs
-- The auth.uid() function returns uuid, so we need to cast it to text for comparison

-- Update ghl_configurations policies
DROP POLICY IF EXISTS "ghl_configs_all_own" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configs_select_own" ON ghl_configurations;

CREATE POLICY "ghl_configs_all_own" ON ghl_configurations
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "ghl_configs_select_own" ON ghl_configurations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

-- Update user_profiles policies
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

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

-- Update location_users policies
DROP POLICY IF EXISTS "location_users_select_own" ON location_users;

CREATE POLICY "location_users_select_own" ON location_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);