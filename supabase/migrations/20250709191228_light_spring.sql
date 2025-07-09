/*
  # Fix Webhook Handler for Inbound Message Extraction

  1. Changes
    - Update the webhook handler to only extract data from inbound messages
    - Continue logging all messages (inbound, outbound, calls, voicemails)
    - Add better logging to indicate why a message is being skipped
    
  2. Benefits
    - Prevents unnecessary AI extraction for outbound messages
    - Saves on API costs by only processing relevant messages
    - Maintains complete conversation history for context
*/

-- This migration doesn't modify the database schema
-- The actual changes are in the edge function code
-- See supabase/functions/ghl-webhook-handler/index.ts