/*
  # Convert user_id columns from uuid to text

  1. Changes
    - Convert user_id and related columns from uuid to text across all tables
    - Update all RLS policies to handle text-based user IDs
    - Remove foreign key constraints that reference auth.users

  2. Security
    - Recreate all RLS policies with proper text-based comparisons
    - Maintain same access control logic

  3. Notes
    - This allows storing GoHighLevel user IDs which are text-based
    - Policies use auth.uid()::text for comparison with text user_id columns
*/

-- Step 1: Drop ALL RLS policies that might reference user_id columns
-- This includes policies on tables that have foreign key relationships

-- Drop ghl_configurations policies
DROP POLICY IF EXISTS "ghl_configs_all_own" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configs_select_own" ON ghl_configurations;

-- Drop data_extraction_fields policies (these reference ghl_configurations.user_id indirectly)
DROP POLICY IF EXISTS "data_extraction_fields_all_by_config_owner" ON data_extraction_fields;
DROP POLICY IF EXISTS "data_extraction_fields_select_by_config_owner" ON data_extraction_fields;

-- Drop notification_triggers policies
DROP POLICY IF EXISTS "notification_triggers_all_by_config_owner" ON notification_triggers;
DROP POLICY IF EXISTS "notification_triggers_select_by_config_owner" ON notification_triggers;

-- Drop contextual_rules policies
DROP POLICY IF EXISTS "contextual_rules_all_by_config_owner" ON contextual_rules;
DROP POLICY IF EXISTS "contextual_rules_select_by_config_owner" ON contextual_rules;

-- Drop stop_triggers policies
DROP POLICY IF EXISTS "stop_triggers_all_by_config_owner" ON stop_triggers;
DROP POLICY IF EXISTS "stop_triggers_select_by_config_owner" ON stop_triggers;

-- Drop ai_prompt_configs policies
DROP POLICY IF EXISTS "ai_prompt_configs_all_by_config_owner" ON ai_prompt_configs;
DROP POLICY IF EXISTS "ai_prompt_configs_select_by_config_owner" ON ai_prompt_configs;

-- Drop location_users policies
DROP POLICY IF EXISTS "location_users_select_own" ON location_users;
DROP POLICY IF EXISTS "location_users_all_by_config_owner" ON location_users;

-- Drop location_invitations policies
DROP POLICY IF EXISTS "location_invitations_select_own_sent" ON location_invitations;
DROP POLICY IF EXISTS "location_invitations_select_own_email" ON location_invitations;
DROP POLICY IF EXISTS "location_invitations_all_by_config_owner" ON location_invitations;

-- Step 2: Drop foreign key constraints
ALTER TABLE ghl_configurations DROP CONSTRAINT IF EXISTS ghl_configurations_user_id_fkey;
ALTER TABLE ghl_configurations DROP CONSTRAINT IF EXISTS ghl_configurations_created_by_fkey;
ALTER TABLE location_users DROP CONSTRAINT IF EXISTS location_users_user_id_fkey;
ALTER TABLE location_users DROP CONSTRAINT IF EXISTS location_users_invited_by_fkey;
ALTER TABLE location_invitations DROP CONSTRAINT IF EXISTS location_invitations_invited_by_fkey;
ALTER TABLE location_invitations DROP CONSTRAINT IF EXISTS location_invitations_accepted_by_fkey;

-- Step 3: Change column types from uuid to text
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

-- Recreate data_extraction_fields policies
CREATE POLICY "data_extraction_fields_all_by_config_owner" ON data_extraction_fields
  FOR ALL TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "data_extraction_fields_select_by_config_owner" ON data_extraction_fields
  FOR SELECT TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

-- Recreate notification_triggers policies
CREATE POLICY "notification_triggers_all_by_config_owner" ON notification_triggers
  FOR ALL TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "notification_triggers_select_by_config_owner" ON notification_triggers
  FOR SELECT TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

-- Recreate contextual_rules policies
CREATE POLICY "contextual_rules_all_by_config_owner" ON contextual_rules
  FOR ALL TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "contextual_rules_select_by_config_owner" ON contextual_rules
  FOR SELECT TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

-- Recreate stop_triggers policies
CREATE POLICY "stop_triggers_all_by_config_owner" ON stop_triggers
  FOR ALL TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "stop_triggers_select_by_config_owner" ON stop_triggers
  FOR SELECT TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

-- Recreate ai_prompt_configs policies
CREATE POLICY "ai_prompt_configs_all_by_config_owner" ON ai_prompt_configs
  FOR ALL TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "ai_prompt_configs_select_by_config_owner" ON ai_prompt_configs
  FOR SELECT TO authenticated
  USING (config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));

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

CREATE POLICY "location_invitations_select_own_email" ON location_invitations
  FOR SELECT TO authenticated
  USING (invited_email = auth.email());

CREATE POLICY "location_invitations_all_by_config_owner" ON location_invitations
  FOR ALL TO authenticated
  USING (location_config_id IN (
    SELECT id FROM ghl_configurations 
    WHERE user_id = auth.uid()::text
  ));