// Secure test script for conversation processing edge functions
// This script reads environment variables and doesn't expose API keys

async function testConversationFunctions() {
  console.log('🧪 Testing Conversation Processing Functions');
  console.log('='.repeat(50));

  // Get environment variables (these should be set in your environment)
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zjgwpgllznqhexyadozz.supabase.co';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY environment variable not set');
    console.log('Please set your environment variables before running this test');
    return;
  }

  // Test conversation ID (you can replace with a real one from your database)
  const testConversationId = 'test-conversation-123';

  try {
    // Test 1: Get Conversation History
    console.log('\n📋 Test 1: Get Conversation History');
    console.log('-'.repeat(30));
    
    const historyResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-conversation-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        conversation_id: testConversationId
      })
    });

    console.log('Status:', historyResponse.status);
    const historyData = await historyResponse.json();
    console.log('Response:', JSON.stringify(historyData, null, 2));

    // Test 2: Generate AI Extraction Payload
    console.log('\n🤖 Test 2: Generate AI Extraction Payload');
    console.log('-'.repeat(30));
    
    const payloadResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-extraction-payload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        conversation_id: testConversationId
      })
    });

    console.log('Status:', payloadResponse.status);
    const payloadData = await payloadResponse.json();
    console.log('Response:', JSON.stringify(payloadData, null, 2));

    // Test 3: Check for Real Conversations
    console.log('\n🔍 Test 3: Check for Real Conversations');
    console.log('-'.repeat(30));
    
    // Query the database for actual conversation IDs
    const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/ghl_conversations?select=conversation_id,location_id,message_type&limit=5`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (dbResponse.ok) {
      const conversations = await dbResponse.json();
      console.log(`Found ${conversations.length} conversations in database`);
      
      if (conversations.length > 0) {
        const realConversationId = conversations[0].conversation_id;
        console.log(`Testing with real conversation: ${realConversationId}`);
        
        // Test with real conversation
        await testWithRealConversation(SUPABASE_URL, SUPABASE_ANON_KEY, realConversationId);
      } else {
        console.log('No conversations found in database yet');
        console.log('💡 You can test the webhook handler by sending a test webhook from GHL');
      }
    } else {
      console.log('Could not query conversations table:', dbResponse.status);
      const errorText = await dbResponse.text();
      console.log('Error:', errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Function to test with a real conversation ID
async function testWithRealConversation(supabaseUrl, anonKey, conversationId) {
  console.log(`\n🎯 Testing with real conversation: ${conversationId}`);
  console.log('='.repeat(50));

  try {
    // Get conversation history
    const historyResponse = await fetch(`${supabaseUrl}/functions/v1/get-conversation-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        conversation_id: conversationId
      })
    });

    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      console.log('✅ Conversation History Success');
      console.log(`Messages found: ${historyData.messages?.length || 0}`);
      console.log(`Location ID: ${historyData.location_id}`);
      
      if (historyData.messages && historyData.messages.length > 0) {
        console.log('Sample messages:');
        historyData.messages.slice(0, 3).forEach((msg, i) => {
          console.log(`  ${i + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
        });

        // Now test AI extraction payload
        const payloadResponse = await fetch(`${supabaseUrl}/functions/v1/ai-extraction-payload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`
          },
          body: JSON.stringify({
            conversation_id: conversationId
          })
        });

        if (payloadResponse.ok) {
          const payloadData = await payloadResponse.json();
          console.log('✅ AI Extraction Payload Success');
          console.log(`Business: ${payloadData.business_context?.name}`);
          console.log(`Fields to extract: ${payloadData.fields_to_extract?.length || 0}`);
          console.log(`Conversation messages: ${payloadData.conversation_history?.length || 0}`);
          
          if (payloadData.fields_to_extract && payloadData.fields_to_extract.length > 0) {
            console.log('Fields to extract:');
            payloadData.fields_to_extract.slice(0, 5).forEach((field, i) => {
              console.log(`  ${i + 1}. ${field.name} (${field.ghl_key}) - ${field.type || 'TEXT'}`);
            });
          }

          // Show sample conversation for context
          if (payloadData.conversation_history && payloadData.conversation_history.length > 0) {
            console.log('\nSample conversation:');
            payloadData.conversation_history.slice(0, 3).forEach((msg, i) => {
              console.log(`  ${i + 1}. [${msg.role}] ${msg.content.substring(0, 80)}...`);
            });
          }
        } else {
          const errorText = await payloadResponse.text();
          console.log('❌ AI Extraction Payload Failed:', payloadResponse.status);
          console.log('Error:', errorText);
        }
      } else {
        console.log('No messages found in this conversation');
      }
    } else {
      const errorText = await historyResponse.text();
      console.log('❌ Conversation History Failed:', historyResponse.status);
      console.log('Error:', errorText);
    }

  } catch (error) {
    console.error('❌ Real conversation test failed:', error.message);
  }
}

// Function to test webhook handler with sample data
async function testWebhookHandler() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zjgwpgllznqhexyadozz.supabase.co';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_ANON_KEY) {
    console.error('❌ Environment variables not set');
    return;
  }

  console.log('\n📨 Testing Webhook Handler');
  console.log('-'.repeat(30));

  // Sample webhook payload (based on GHL webhook format)
  const sampleWebhook = {
    type: 'InboundMessage',
    locationId: '3lkoUn4O7jExzrkx3shg',
    conversationId: `test-conv-${Date.now()}`,
    contactId: 'test-contact-123',
    messageId: `test-msg-${Date.now()}`,
    messageType: 'SMS',
    direction: 'inbound',
    body: 'Hi, I need help with my order. My name is John Smith and my phone is 555-123-4567.',
    dateAdded: new Date().toISOString(),
    status: 'delivered'
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ghl-webhook-handler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(sampleWebhook)
    });

    console.log('Webhook Status:', response.status);
    const result = await response.json();
    console.log('Webhook Response:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Webhook processed successfully');
      console.log('💡 You can now test the conversation functions with this conversation ID:', sampleWebhook.conversationId);
      
      // Test the conversation functions with the new conversation
      setTimeout(() => {
        testWithRealConversation(SUPABASE_URL, SUPABASE_ANON_KEY, sampleWebhook.conversationId);
      }, 1000);
    }

  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
  }
}

// Export functions for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testConversationFunctions,
    testWithRealConversation,
    testWebhookHandler
  };
}

// Run the test if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  testConversationFunctions();
}

// For browser environments
if (typeof window !== 'undefined') {
  window.testConversationFunctions = testConversationFunctions;
  window.testWebhookHandler = testWebhookHandler;
}