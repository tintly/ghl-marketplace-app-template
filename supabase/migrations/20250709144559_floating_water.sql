/*
  # Fix Subscription RLS Policies

  1. Changes
    - Add INSERT and UPDATE policies for location_subscriptions table
    - Allow users to manage their own subscriptions
    - Fix RLS policy for subscription upgrades
*/

-- Add INSERT policy for location_subscriptions
CREATE POLICY "Users can insert their own location subscriptions"
  ON location_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    location_id = get_ghl_location_id()
  );

-- Add UPDATE policy for location_subscriptions
CREATE POLICY "Users can update their own location subscriptions"
  ON location_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    location_id = get_ghl_location_id()
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    location_id = get_ghl_location_id()
  );

-- Add DELETE policy for location_subscriptions
CREATE POLICY "Users can delete their own location subscriptions"
  ON location_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    location_id = get_ghl_location_id()
  );

-- Add INSERT policy for usage_tracking
CREATE POLICY "Service can insert usage tracking"
  ON usage_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (
      -- Location can track its own usage
      location_id = get_ghl_location_id() OR
      -- Agency can track usage for its locations
      (
        get_ghl_user_type() = 'agency' AND
        location_id IN (
          SELECT ghl_account_id 
          FROM ghl_configurations 
          WHERE agency_ghl_id = get_ghl_company_id()
        )
      )
    )
  );

-- Add UPDATE policy for usage_tracking
CREATE POLICY "Service can update usage tracking"
  ON usage_tracking
  FOR UPDATE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    (
      -- Location can update its own usage
      location_id = get_ghl_location_id() OR
      -- Agency can update usage for its locations
      (
        get_ghl_user_type() = 'agency' AND
        location_id IN (
          SELECT ghl_account_id 
          FROM ghl_configurations 
          WHERE agency_ghl_id = get_ghl_company_id()
        )
      )
    )
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    (
      -- Location can update its own usage
      location_id = get_ghl_location_id() OR
      -- Agency can update usage for its locations
      (
        get_ghl_user_type() = 'agency' AND
        location_id IN (
          SELECT ghl_account_id 
          FROM ghl_configurations 
          WHERE agency_ghl_id = get_ghl_company_id()
        )
      )
    )
  );