/*
  # Update Agency Permissions for Tier System

  1. New Columns Added to agency_permissions
    - `agency_tier` (text) - Agency tier level (Tier 1, Tier 2, Tier 3)
    - `call_extraction_discount_rate` (numeric) - Discounted call extraction rate for agencies

  2. Security
    - Existing RLS policies remain unchanged
*/

-- Add new columns to agency_permissions table
DO $$
BEGIN
  -- Agency tier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_permissions' AND column_name = 'agency_tier'
  ) THEN
    ALTER TABLE agency_permissions ADD COLUMN agency_tier text DEFAULT 'Tier 1' NOT NULL;
  END IF;

  -- Call extraction discount rate for agencies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_permissions' AND column_name = 'call_extraction_discount_rate'
  ) THEN
    ALTER TABLE agency_permissions ADD COLUMN call_extraction_discount_rate numeric(10,4) DEFAULT 0.25 NOT NULL;
  END IF;
END $$;

-- Add check constraint for agency_tier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'agency_permissions_agency_tier_check'
  ) THEN
    ALTER TABLE agency_permissions 
    ADD CONSTRAINT agency_permissions_agency_tier_check 
    CHECK (agency_tier IN ('Tier 1', 'Tier 2', 'Tier 3'));
  END IF;
END $$;