/*
  # Update RLS Policies for JWT Authentication

  1. Drop existing policies that use auth.uid()
  2. Create new policies that use JWT claims via helper functions
  3. Maintain security while enabling GHL authentication

  This migration updates all RLS policies to work with custom JWT tokens
  that contain GHL user information instead of relying on Supabase's
  built-in authentication system.
*/

-- Drop existing policies for ghl_configurations
DROP POLICY IF EXISTS "ghl_configurations_insert" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_link_update" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_own_access" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_read_by_location" ON ghl_configurations;

-- Create new JWT-based policies for ghl_configurations
CREATE POLICY "ghl_configurations_jwt_insert"
  ON ghl_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    user_id = get_ghl_user_id()
  );

CREATE POLICY "ghl_configurations_jwt_select"
  ON ghl_configurations
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (user_id = get_ghl_user_id() OR user_has_location_access(ghl_account_id))
  );

CREATE POLICY "ghl_configurations_jwt_update"
  ON ghl_configurations
  FOR UPDATE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_owns_ghl_config(user_id)
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    user_id = get_ghl_user_id()
  );

CREATE POLICY "ghl_configurations_jwt_delete"
  ON ghl_configurations
  FOR DELETE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_owns_ghl_config(user_id)
  );

-- Drop existing policies for data_extraction_fields
DROP POLICY IF EXISTS "data_extraction_fields_all_by_config_owner" ON data_extraction_fields;
DROP POLICY IF EXISTS "data_extraction_fields_select_by_config_owner" ON data_extraction_fields;

-- Create new JWT-based policies for data_extraction_fields
CREATE POLICY "data_extraction_fields_jwt_all"
  ON data_extraction_fields
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  );

-- Drop existing policies for location_users
DROP POLICY IF EXISTS "location_users_all_by_config_owner" ON location_users;
DROP POLICY IF EXISTS "location_users_select_own" ON location_users;

-- Create new JWT-based policies for location_users
CREATE POLICY "location_users_jwt_all"
  ON location_users
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (user_id = get_ghl_user_id() OR 
     location_config_id IN (
       SELECT id FROM ghl_configurations 
       WHERE user_owns_ghl_config(user_id)
     ))
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    location_config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  );

-- Drop existing policies for notification_triggers
DROP POLICY IF EXISTS "notification_triggers_all_by_config_owner" ON notification_triggers;
DROP POLICY IF EXISTS "notification_triggers_select_by_config_owner" ON notification_triggers;

-- Create new JWT-based policies for notification_triggers
CREATE POLICY "notification_triggers_jwt_all"
  ON notification_triggers
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  );

-- Drop existing policies for contextual_rules
DROP POLICY IF EXISTS "contextual_rules_all_by_config_owner" ON contextual_rules;
DROP POLICY IF EXISTS "contextual_rules_select_by_config_owner" ON contextual_rules;

-- Create new JWT-based policies for contextual_rules
CREATE POLICY "contextual_rules_jwt_all"
  ON contextual_rules
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  );

-- Drop existing policies for stop_triggers
DROP POLICY IF EXISTS "stop_triggers_all_by_config_owner" ON stop_triggers;
DROP POLICY IF EXISTS "stop_triggers_select_by_config_owner" ON stop_triggers;

-- Create new JWT-based policies for stop_triggers
CREATE POLICY "stop_triggers_jwt_all"
  ON stop_triggers
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  );

-- Drop existing policies for ai_prompt_configs
DROP POLICY IF EXISTS "ai_prompt_configs_all_by_config_owner" ON ai_prompt_configs;
DROP POLICY IF EXISTS "ai_prompt_configs_select_by_config_owner" ON ai_prompt_configs;

-- Create new JWT-based policies for ai_prompt_configs
CREATE POLICY "ai_prompt_configs_jwt_all"
  ON ai_prompt_configs
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  );

-- Drop existing policies for location_invitations
DROP POLICY IF EXISTS "location_invitations_all_by_config_owner" ON location_invitations;
DROP POLICY IF EXISTS "location_invitations_select_own_email" ON location_invitations;
DROP POLICY IF EXISTS "location_invitations_select_own_sent" ON location_invitations;

-- Create new JWT-based policies for location_invitations
CREATE POLICY "location_invitations_jwt_all"
  ON location_invitations
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (invited_by = get_ghl_user_id() OR 
     location_config_id IN (
       SELECT id FROM ghl_configurations 
       WHERE user_owns_ghl_config(user_id)
     ))
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    location_config_id IN (
      SELECT id FROM ghl_configurations 
      WHERE user_owns_ghl_config(user_id)
    )
  );

-- Keep service_role policies unchanged (they bypass RLS anyway)
-- These are needed for edge functions and admin operations