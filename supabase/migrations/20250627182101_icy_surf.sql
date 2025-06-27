/*
  # Add service role policies for development configuration creation

  1. New Policies
    - Add service_role policies for all tables to allow Edge Functions to create dev configurations
    - These policies allow the service role to bypass RLS for configuration management

  2. Security
    - Service role policies are separate from user policies
    - Only affects Edge Functions running with service role key
    - User policies remain unchanged for normal app usage
*/

-- Add service role policies for ghl_configurations
CREATE POLICY "service_role_all_ghl_configurations" ON ghl_configurations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add service role policies for data_extraction_fields
CREATE POLICY "service_role_all_data_extraction_fields" ON data_extraction_fields
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add service role policies for notification_triggers
CREATE POLICY "service_role_all_notification_triggers" ON notification_triggers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add service role policies for contextual_rules
CREATE POLICY "service_role_all_contextual_rules" ON contextual_rules
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add service role policies for stop_triggers
CREATE POLICY "service_role_all_stop_triggers" ON stop_triggers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add service role policies for ai_prompt_configs
CREATE POLICY "service_role_all_ai_prompt_configs" ON ai_prompt_configs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add service role policies for location_users
CREATE POLICY "service_role_all_location_users" ON location_users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add service role policies for location_invitations
CREATE POLICY "service_role_all_location_invitations" ON location_invitations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);