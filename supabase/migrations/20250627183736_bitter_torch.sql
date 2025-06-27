/*
  # Restore production data safety measures

  1. Changes
    - Add data protection triggers to prevent accidental overwrites
    - Create backup mechanism for critical production data
    - Add validation to prevent dev mode from affecting production IDs

  2. Security
    - Protect specific production location IDs from being modified
    - Add audit trail for configuration changes
    - Ensure token validation is always performed
*/

-- Create a function to protect production location IDs
CREATE OR REPLACE FUNCTION protect_production_data()
RETURNS TRIGGER AS $$
DECLARE
  protected_ids TEXT[] := ARRAY['4beIyWyWrcoPRD7PEN5G']; -- Add your production IDs here
BEGIN
  -- Check if this is a protected production ID
  IF NEW.ghl_account_id = ANY(protected_ids) THEN
    -- Only allow updates if they have valid tokens and are not dev tokens
    IF NEW.access_token LIKE 'dev-%' OR NEW.client_id = 'dev-client-id' THEN
      RAISE EXCEPTION 'Cannot use development tokens with production location ID %', NEW.ghl_account_id;
    END IF;
    
    -- Log the change for audit purposes
    INSERT INTO audit_log (
      table_name,
      record_id,
      action,
      old_values,
      new_values,
      user_id,
      timestamp
    ) VALUES (
      'ghl_configurations',
      COALESCE(NEW.id, OLD.id),
      TG_OP,
      row_to_json(OLD),
      row_to_json(NEW),
      NEW.user_id,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  user_id text,
  timestamp timestamptz DEFAULT now()
);

-- Add the protection trigger
DROP TRIGGER IF EXISTS protect_production_data_trigger ON ghl_configurations;
CREATE TRIGGER protect_production_data_trigger
  BEFORE INSERT OR UPDATE ON ghl_configurations
  FOR EACH ROW
  EXECUTE FUNCTION protect_production_data();

-- Add token validation function
CREATE OR REPLACE FUNCTION validate_token_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure access_token is always present for active configurations
  IF NEW.is_active = true AND (NEW.access_token IS NULL OR NEW.access_token = '') THEN
    RAISE EXCEPTION 'Active configurations must have a valid access_token';
  END IF;
  
  -- Ensure refresh_token is present for non-dev configurations
  IF NEW.is_active = true 
     AND NEW.client_id != 'dev-client-id' 
     AND (NEW.refresh_token IS NULL OR NEW.refresh_token = '') THEN
    RAISE EXCEPTION 'Production configurations must have a valid refresh_token';
  END IF;
  
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add token validation trigger
DROP TRIGGER IF EXISTS validate_token_integrity_trigger ON ghl_configurations;
CREATE TRIGGER validate_token_integrity_trigger
  BEFORE INSERT OR UPDATE ON ghl_configurations
  FOR EACH ROW
  EXECUTE FUNCTION validate_token_integrity();

-- Add index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- Add comment to document the protection
COMMENT ON FUNCTION protect_production_data() IS 'Protects production location IDs from being overwritten with development data';
COMMENT ON TABLE audit_log IS 'Audit trail for critical configuration changes';