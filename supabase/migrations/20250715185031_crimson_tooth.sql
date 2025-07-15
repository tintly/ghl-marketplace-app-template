/*
  # Add webhook handler function

  1. New Functions
    - `process_ghl_webhook` - Processes incoming GoHighLevel webhooks
    - `trigger_ai_extraction` - Triggers AI extraction for new messages

  2. Triggers
    - Add trigger to automatically process new messages

  This migration adds functions to handle incoming webhooks from GoHighLevel
  and automatically trigger AI extraction for new messages.
*/

-- Function to process GHL webhooks
CREATE OR REPLACE FUNCTION process_ghl_webhook(
  webhook_payload JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_location_id TEXT;
  v_conversation_id TEXT;
  v_contact_id TEXT;
  v_message_id TEXT;
  v_message_type TEXT;
  v_direction TEXT;
  v_body TEXT;
  v_date_added TIMESTAMPTZ;
  v_event_type TEXT;
  v_record_id UUID;
BEGIN
  -- Extract event type
  v_event_type := webhook_payload->>'event';
  
  -- Only process conversation message events
  IF v_event_type != 'conversation.message.created' THEN
    RAISE NOTICE 'Ignoring unsupported event type: %', v_event_type;
    RETURN FALSE;
  END IF;
  
  -- Extract required fields
  v_location_id := webhook_payload->>'locationId';
  v_conversation_id := (webhook_payload->'conversation'->>'id');
  v_contact_id := (webhook_payload->'contact'->>'id');
  v_message_id := (webhook_payload->'message'->>'id');
  v_message_type := (webhook_payload->'message'->>'type');
  v_direction := (webhook_payload->'message'->>'direction');
  v_body := (webhook_payload->'message'->>'body');
  v_date_added := (webhook_payload->'message'->>'dateAdded')::TIMESTAMPTZ;
  
  -- Validate required fields
  IF v_location_id IS NULL OR v_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Missing required fields: locationId and conversationId';
  END IF;
  
  -- Insert into ghl_conversations table
  INSERT INTO ghl_conversations (
    location_id,
    conversation_id,
    contact_id,
    message_id,
    message_type,
    direction,
    body,
    date_added,
    webhook_received_at,
    raw_webhook_data,
    processed
  ) VALUES (
    v_location_id,
    v_conversation_id,
    v_contact_id,
    v_message_id,
    v_message_type,
    v_direction,
    v_body,
    COALESCE(v_date_added, now()),
    now(),
    webhook_payload,
    FALSE
  )
  RETURNING id INTO v_record_id;
  
  RAISE NOTICE 'Message inserted successfully: %', v_record_id;
  
  -- If this is an inbound message, trigger extraction
  IF v_direction = 'inbound' THEN
    PERFORM trigger_ai_extraction(v_conversation_id, v_location_id, v_contact_id);
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error processing webhook: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to trigger AI extraction
CREATE OR REPLACE FUNCTION trigger_ai_extraction(
  p_conversation_id TEXT,
  p_location_id TEXT,
  p_contact_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_config_id UUID;
  v_agency_id TEXT;
BEGIN
  -- Get configuration ID and agency ID for this location
  SELECT id, agency_ghl_id 
  INTO v_config_id, v_agency_id
  FROM ghl_configurations
  WHERE ghl_account_id = p_location_id
  AND is_active = TRUE
  LIMIT 1;
  
  IF v_config_id IS NULL THEN
    RAISE NOTICE 'No active configuration found for location: %', p_location_id;
    RETURN FALSE;
  END IF;
  
  -- Log the extraction request
  INSERT INTO ai_usage_logs (
    location_id,
    agency_ghl_id,
    model,
    conversation_id,
    extraction_type,
    success,
    created_at
  ) VALUES (
    p_location_id,
    v_agency_id,
    'gpt-4o',
    p_conversation_id,
    'data_extraction',
    FALSE, -- Will be updated when extraction completes
    now()
  );
  
  RAISE NOTICE 'AI extraction triggered for conversation: %', p_conversation_id;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error triggering extraction: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to process new messages
CREATE OR REPLACE FUNCTION process_new_message() RETURNS TRIGGER AS $$
BEGIN
  -- If this is an inbound message, trigger extraction
  IF NEW.direction = 'inbound' AND NEW.processed = FALSE THEN
    PERFORM trigger_ai_extraction(NEW.conversation_id, NEW.location_id, NEW.contact_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to automatically process new messages
DROP TRIGGER IF EXISTS process_new_message_trigger ON ghl_conversations;
CREATE TRIGGER process_new_message_trigger
AFTER INSERT ON ghl_conversations
FOR EACH ROW
EXECUTE FUNCTION process_new_message();