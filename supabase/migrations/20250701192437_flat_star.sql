/*
  # Fix RLS policies for agency-wide access

  1. Security Changes
    - Update all RLS policies to use location-based access instead of ownership
    - Create missing JWT helper functions
    - Allow agency users to access configurations for locations they have permission to

  2. New Functions
    - get_ghl_user_role() - Extract user role from JWT
    - get_ghl_user_type() - Extract user type from JWT
    - debug_user_access() - Debug function for troubleshooting access

  3. Policy Updates
    - ghl_configurations: Use location access instead of ownership
    - All related tables: Follow same location-based access pattern
    - Maintain security while enabling agency collaboration
*/

-- First, create the missing JWT helper functions
CREATE OR REPLACE FUNCTION get_ghl_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'ghl_user_role',
    'user'
  );
$$;

CREATE OR REPLACE FUNCTION get_ghl_user_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'ghl_user_type',
    'location'
  );
$$;

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION get_ghl_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ghl_user_type() TO authenticated;

-- Update ghl_configurations policies for agency access
DROP POLICY IF EXISTS "ghl_configurations_jwt_select" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_jwt_insert" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_jwt_update" ON ghl_configurations;
DROP POLICY IF EXISTS "ghl_configurations_jwt_delete" ON ghl_configurations;

-- New SELECT policy: Allow access to configurations for locations the user has access to
CREATE POLICY "ghl_configurations_jwt_select"
  ON ghl_configurations
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_has_location_access(ghl_account_id)
  );

-- New INSERT policy: Allow creating configurations for accessible locations
CREATE POLICY "ghl_configurations_jwt_insert"
  ON ghl_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    user_has_location_access(ghl_account_id)
  );

-- New UPDATE policy: Allow updating configurations for accessible locations
CREATE POLICY "ghl_configurations_jwt_update"
  ON ghl_configurations
  FOR UPDATE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_has_location_access(ghl_account_id)
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    user_has_location_access(ghl_account_id)
  );

-- New DELETE policy: Allow deleting configurations for accessible locations (owners or admins)
CREATE POLICY "ghl_configurations_jwt_delete"
  ON ghl_configurations
  FOR DELETE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_has_location_access(ghl_account_id) AND
    (user_owns_ghl_config(user_id) OR get_ghl_user_role() IN ('admin', 'agency'))
  );

-- Update data_extraction_fields policies
DROP POLICY IF EXISTS "data_extraction_fields_jwt_all" ON data_extraction_fields;

CREATE POLICY "data_extraction_fields_jwt_all"
  ON data_extraction_fields
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  );

-- Update notification_triggers policies
DROP POLICY IF EXISTS "notification_triggers_jwt_all" ON notification_triggers;

CREATE POLICY "notification_triggers_jwt_all"
  ON notification_triggers
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  );

-- Update contextual_rules policies
DROP POLICY IF EXISTS "contextual_rules_jwt_all" ON contextual_rules;

CREATE POLICY "contextual_rules_jwt_all"
  ON contextual_rules
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  );

-- Update stop_triggers policies
DROP POLICY IF EXISTS "stop_triggers_jwt_all" ON stop_triggers;

CREATE POLICY "stop_triggers_jwt_all"
  ON stop_triggers
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  );

-- Update ai_prompt_configs policies
DROP POLICY IF EXISTS "ai_prompt_configs_jwt_all" ON ai_prompt_configs;

CREATE POLICY "ai_prompt_configs_jwt_all"
  ON ai_prompt_configs
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  );

-- Update location_users policies (users should see all location_users for locations they have access to)
DROP POLICY IF EXISTS "location_users_jwt_all" ON location_users;

CREATE POLICY "location_users_jwt_all"
  ON location_users
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    ((user_id = get_ghl_user_id()) OR 
     (location_config_id IN (
       SELECT ghl_configurations.id
       FROM ghl_configurations
       WHERE user_has_location_access(ghl_configurations.ghl_account_id)
     )))
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (location_config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  );

-- Update location_invitations policies
DROP POLICY IF EXISTS "location_invitations_jwt_all" ON location_invitations;

CREATE POLICY "location_invitations_jwt_all"
  ON location_invitations
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    ((invited_by = get_ghl_user_id()) OR 
     (location_config_id IN (
       SELECT ghl_configurations.id
       FROM ghl_configurations
       WHERE user_has_location_access(ghl_configurations.ghl_account_id)
     )))
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (location_config_id IN (
      SELECT ghl_configurations.id
      FROM ghl_configurations
      WHERE user_has_location_access(ghl_configurations.ghl_account_id)
    ))
  );

-- Add a helpful function to debug user access
CREATE OR REPLACE FUNCTION debug_user_access()
RETURNS TABLE (
  user_id text,
  user_role text,
  user_type text,
  accessible_locations text[],
  total_configs bigint,
  accessible_configs bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    get_ghl_user_id() as user_id,
    get_ghl_user_role() as user_role,
    get_ghl_user_type() as user_type,
    ARRAY(
      SELECT DISTINCT ghl_account_id 
      FROM ghl_configurations 
      WHERE user_has_location_access(ghl_account_id)
    ) as accessible_locations,
    (SELECT COUNT(*) FROM ghl_configurations WHERE is_active = true) as total_configs,
    (SELECT COUNT(*) FROM ghl_configurations WHERE is_active = true AND user_has_location_access(ghl_account_id)) as accessible_configs;
END;
$$;

-- Grant execute permission on the debug function
GRANT EXECUTE ON FUNCTION debug_user_access() TO authenticated;

-- Add comments explaining the changes
COMMENT ON POLICY "ghl_configurations_jwt_select" ON ghl_configurations IS 
'Updated for agency access: Users can access configurations for any location they have access to, not just ones they own';

COMMENT ON POLICY "data_extraction_fields_jwt_all" ON data_extraction_fields IS 
'Updated for agency access: Users can access extraction fields for any configuration in locations they have access to';

COMMENT ON FUNCTION get_ghl_user_role() IS 
'Extract user role from JWT claims for authorization decisions';

COMMENT ON FUNCTION get_ghl_user_type() IS 
'Extract user type from JWT claims for authorization decisions';

COMMENT ON FUNCTION debug_user_access() IS 
'Debug function to help troubleshoot user access permissions and see what locations/configs a user can access';