/*
  # Create GHL Conversations Table

  1. New Tables
    - `ghl_conversations`
      - `id` (uuid, primary key)
      - `location_id` (text, indexed)
      - `conversation_id` (text, indexed)
      - `contact_id` (text, indexed)
      - `message_id` (text, unique)
      - `message_type` (text) - SMS, CALL, Email, etc.
      - `direction` (text) - inbound, outbound
      - `body` (text) - message content
      - `attachments` (jsonb) - array of attachment URLs
      - `status` (text) - delivered, completed, voicemail, etc.
      - `date_added` (timestamptz) - when message was created in GHL
      - `webhook_received_at` (timestamptz) - when we received the webhook
      - `raw_webhook_data` (jsonb) - complete webhook payload for debugging
      - `processed` (boolean) - whether this message has been processed for extraction
      - `processing_error` (text) - any errors during processing
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Location ID for filtering by location
    - Conversation ID for grouping messages
    - Contact ID for contact-specific queries
    - Message ID for deduplication
    - Date added for chronological queries
    - Processed status for batch processing

  3. Security
    - Enable RLS on `ghl_conversations` table
    - Add policy for service role (webhooks)
    - Add policy for authenticated users to read their location's data
*/

-- Create the conversations table
CREATE TABLE IF NOT EXISTS ghl_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL,
  conversation_id text NOT NULL,
  contact_id text,
  message_id text UNIQUE,
  message_type text NOT NULL,
  direction text NOT NULL,
  body text,
  attachments jsonb DEFAULT '[]'::jsonb,
  status text,
  date_added timestamptz NOT NULL,
  webhook_received_at timestamptz DEFAULT now(),
  raw_webhook_data jsonb NOT NULL,
  processed boolean DEFAULT false,
  processing_error text,
  
  -- Call-specific fields
  call_duration integer,
  call_status text,
  
  -- Email-specific fields
  email_message_id text,
  email_thread_id text,
  email_from text,
  email_to jsonb,
  email_cc jsonb,
  email_bcc jsonb,
  email_subject text,
  
  -- User and provider info
  user_id text,
  conversation_provider_id text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_location_id ON ghl_conversations (location_id);
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_conversation_id ON ghl_conversations (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_contact_id ON ghl_conversations (contact_id);
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_message_id ON ghl_conversations (message_id);
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_date_added ON ghl_conversations (date_added DESC);
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_processed ON ghl_conversations (processed, location_id);
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_message_type ON ghl_conversations (message_type, location_id);
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_direction ON ghl_conversations (direction, location_id);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_location_conversation ON ghl_conversations (location_id, conversation_id, date_added DESC);
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_location_contact ON ghl_conversations (location_id, contact_id, date_added DESC);
CREATE INDEX IF NOT EXISTS idx_ghl_conversations_unprocessed ON ghl_conversations (location_id, processed, date_added ASC) WHERE processed = false;

-- Enable Row Level Security
ALTER TABLE ghl_conversations ENABLE ROW LEVEL SECURITY;

-- Policy for service role (webhooks can insert/update anything)
CREATE POLICY "service_role_all_ghl_conversations"
  ON ghl_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users (can only read their location's data)
CREATE POLICY "ghl_conversations_jwt_select"
  ON ghl_conversations
  FOR SELECT
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_has_location_access(location_id)
  );

-- Policy for authenticated users to update processing status
CREATE POLICY "ghl_conversations_jwt_update_processing"
  ON ghl_conversations
  FOR UPDATE
  TO authenticated
  USING (
    is_ghl_user_authenticated() AND 
    user_has_location_access(location_id)
  )
  WITH CHECK (
    is_ghl_user_authenticated() AND 
    user_has_location_access(location_id)
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ghl_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ghl_conversations_updated_at
  BEFORE UPDATE ON ghl_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_conversations_updated_at();