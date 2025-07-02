# Test Environment Setup

## Setting Environment Variables

Before running the conversation function tests, you need to set up your environment variables securely.

### Option 1: Using .env file (Recommended for local testing)

Create a `.env` file in your project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://zjgwpgllznqhexyadozz.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: For testing with service role (more permissions)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Option 2: Using environment variables directly

```bash
# Linux/Mac
export VITE_SUPABASE_URL="https://zjgwpgllznqhexyadozz.supabase.co"
export VITE_SUPABASE_ANON_KEY="your_anon_key_here"

# Windows
set VITE_SUPABASE_URL=https://zjgwpgllznqhexyadozz.supabase.co
set VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Running the Tests

### Node.js Environment
```bash
node test-conversation-functions.js
```

### Browser Environment
1. Open your browser's developer console
2. Load the test file
3. Run: `testConversationFunctions()`

## Test Functions Available

1. **testConversationFunctions()** - Main test suite
2. **testWebhookHandler()** - Test webhook processing
3. **testWithRealConversation(url, key, conversationId)** - Test with specific conversation

## What the Tests Do

1. **Conversation History Test**: Tests the `get-conversation-history` edge function
2. **AI Extraction Payload Test**: Tests the `ai-extraction-payload` edge function  
3. **Real Data Test**: Queries your database for actual conversations and tests with real data
4. **Webhook Test**: Sends a sample webhook to test the webhook handler

## Expected Results

✅ **Success**: Functions return proper JSON responses with conversation data
❌ **Failure**: Check console for error messages and troubleshooting info

## Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- The test file reads from environment variables only
- No hardcoded credentials in the test files