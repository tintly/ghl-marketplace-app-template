/*
  # Add service role policies for all tables

  1. Changes
    - Add service role policies to allow Edge Functions to manage all data
    - Use DROP POLICY IF EXISTS to avoid duplicate policy errors
    - Recreate policies with proper permissions

  2. Security
    - Service role gets full access to all tables for Edge Function operations
    - User-level RLS policies remain intact for authenticated users
*/

-- Drop existing service role policies if they exist, then recreate them

-- ghl_configurations
DROP POLICY IF EXISTS "service_role_all_ghl_configurations" ON ghl_configurations;
CREATE POLICY "service_role_all_ghl_configurations" ON ghl_configurations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- data_extraction_fields
DROP POLICY IF EXISTS "service_role_all_data_extraction_fields" ON data_extraction_fields;
CREATE POLICY "service_role_all_data_extraction_fields" ON data_extraction_fields
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- notification_triggers
DROP POLICY IF EXISTS "service_role_all_notification_triggers" ON notification_triggers;
CREATE POLICY "service_role_all_notification_triggers" ON notification_triggers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- contextual_rules
DROP POLICY IF EXISTS "service_role_all_contextual_rules" ON contextual_rules;
CREATE POLICY "service_role_all_contextual_rules" ON contextual_rules
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- stop_triggers
DROP POLICY IF EXISTS "service_role_all_stop_triggers" ON stop_triggers;
CREATE POLICY "service_role_all_stop_triggers" ON stop_triggers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ai_prompt_configs
DROP POLICY IF EXISTS "service_role_all_ai_prompt_configs" ON ai_prompt_configs;
CREATE POLICY "service_role_all_ai_prompt_configs" ON ai_prompt_configs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- location_users
DROP POLICY IF EXISTS "service_role_all_location_users" ON location_users;
CREATE POLICY "service_role_all_location_users" ON location_users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- location_invitations
DROP POLICY IF EXISTS "service_role_all_location_invitations" ON location_invitations;
CREATE POLICY "service_role_all_location_invitations" ON location_invitations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);