/*
  # Fix Service Role Policies

  This migration ensures service role policies exist for all tables without conflicts.
  Service role policies allow edge functions and admin operations to bypass RLS.
*/

-- Add service role policies for ghl_configurations (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ghl_configurations' 
    AND policyname = 'service_role_all_ghl_configurations'
  ) THEN
    CREATE POLICY "service_role_all_ghl_configurations" ON ghl_configurations
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add service role policies for data_extraction_fields (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'data_extraction_fields' 
    AND policyname = 'service_role_all_data_extraction_fields'
  ) THEN
    CREATE POLICY "service_role_all_data_extraction_fields" ON data_extraction_fields
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add service role policies for notification_triggers (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_triggers' 
    AND policyname = 'service_role_all_notification_triggers'
  ) THEN
    CREATE POLICY "service_role_all_notification_triggers" ON notification_triggers
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add service role policies for contextual_rules (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'contextual_rules' 
    AND policyname = 'service_role_all_contextual_rules'
  ) THEN
    CREATE POLICY "service_role_all_contextual_rules" ON contextual_rules
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add service role policies for stop_triggers (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stop_triggers' 
    AND policyname = 'service_role_all_stop_triggers'
  ) THEN
    CREATE POLICY "service_role_all_stop_triggers" ON stop_triggers
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add service role policies for ai_prompt_configs (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_prompt_configs' 
    AND policyname = 'service_role_all_ai_prompt_configs'
  ) THEN
    CREATE POLICY "service_role_all_ai_prompt_configs" ON ai_prompt_configs
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add service role policies for location_users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'location_users' 
    AND policyname = 'service_role_all_location_users'
  ) THEN
    CREATE POLICY "service_role_all_location_users" ON location_users
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add service role policies for location_invitations (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'location_invitations' 
    AND policyname = 'service_role_all_location_invitations'
  ) THEN
    CREATE POLICY "service_role_all_location_invitations" ON location_invitations
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;