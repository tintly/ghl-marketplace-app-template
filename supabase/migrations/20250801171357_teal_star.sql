/*
  # Create Agency Licensed Locations Table

  1. New Table
    - `agency_licensed_locations`
      - `id` (uuid, primary key)
      - `agency_ghl_id` (text, not null) - References agency_permissions
      - `location_ghl_id` (text, not null, unique) - References ghl_configurations
      - `is_active` (boolean, default true)
      - `licensed_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `agency_licensed_locations` table
    - Add policies for agency admins to manage their own licensed locations
    - Add policy for service_role access

  3. Triggers
    - Auto-update `updated_at` timestamp
*/

CREATE TABLE IF NOT EXISTS agency_licensed_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_ghl_id text NOT NULL,
  location_ghl_id text NOT NULL UNIQUE,
  is_active boolean DEFAULT true NOT NULL,
  licensed_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE agency_licensed_locations ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'agency_licensed_locations_agency_ghl_id_fkey'
  ) THEN
    ALTER TABLE agency_licensed_locations 
    ADD CONSTRAINT agency_licensed_locations_agency_ghl_id_fkey 
    FOREIGN KEY (agency_ghl_id) REFERENCES agency_permissions(agency_ghl_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'agency_licensed_locations_location_ghl_id_fkey'
  ) THEN
    ALTER TABLE agency_licensed_locations 
    ADD CONSTRAINT agency_licensed_locations_location_ghl_id_fkey 
    FOREIGN KEY (location_ghl_id) REFERENCES ghl_configurations(ghl_account_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_agency_licensed_locations_agency_id 
ON agency_licensed_locations (agency_ghl_id);

CREATE INDEX IF NOT EXISTS idx_agency_licensed_locations_location_id 
ON agency_licensed_locations (location_ghl_id);

CREATE INDEX IF NOT EXISTS idx_agency_licensed_locations_active 
ON agency_licensed_locations (agency_ghl_id, is_active);

-- RLS Policies
CREATE POLICY "Agency can manage own licensed locations"
  ON agency_licensed_locations
  FOR ALL
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id()
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    get_ghl_user_type() = 'agency' AND 
    agency_ghl_id = get_ghl_company_id()
  );

CREATE POLICY "Locations can read their license status"
  ON agency_licensed_locations
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    location_ghl_id = get_ghl_location_id()
  );

CREATE POLICY "service_role_all_agency_licensed_locations"
  ON agency_licensed_locations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_agency_licensed_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_agency_licensed_locations_updated_at ON agency_licensed_locations;
CREATE TRIGGER update_agency_licensed_locations_updated_at
  BEFORE UPDATE ON agency_licensed_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_agency_licensed_locations_updated_at();