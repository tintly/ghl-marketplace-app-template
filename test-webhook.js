// Test the webhook handler with sample GHL data
const SUPABASE_URL = 'https://zjgwpgllznqhexyadozz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZ3dwZ2xsem5xaGV4eWFkb3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4OTkyMjIsImV4cCI6MjA2NjQ3NTIyMn0.IsFHmEfDc3Yg-suEPgsCJITOYTcH8CCh0UGEyFPLasI';

async function testWebhook() {
  console.log('📨 Testing webhook handler with sample data...');
  
  const sampleWebhook = {
    type: 'InboundMessage',
    locationId: '3lkoUn4O7jExzrkx3shg',
    conversationId: `test-conv-${Date.now()}`,
    contactId: 'test-contact-123',
    messageId: `test-msg-${Date.now()}`,
    messageType: 'SMS',
    direction: 'inbound',
    body: 'Hi, I need help with my order. My name is John Smith and my phone is 555-123-4567. My email is john@example.com.',
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
      console.log(`📝 Created conversation: ${sampleWebhook.conversationId}`);
      
      // Wait a moment then test the conversation functions
      console.log('\n⏳ Waiting 2 seconds then testing conversation functions...');
      setTimeout(async () => {
        await testConversationFunctions(sampleWebhook.conversationId);
      }, 2000);
    }

  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
  }
}

async function testConversationFunctions(conversationId) {
  console.log(`\n🧪 Testing conversation functions with: ${conversationId}`);
  
  try {
    // Test 1: Get conversation history
    console.log('\n1. Testing get-conversation-history...');
    const historyResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-conversation-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ conversation_id: conversationId })
    });

    console.log('History Status:', historyResponse.status);
    const historyData = await historyResponse.json();
    console.log('History Data:', JSON.stringify(historyData, null, 2));

    // Test 2: Generate AI extraction payload
    console.log('\n2. Testing ai-extraction-payload...');
    const payloadResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-extraction-payload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ conversation_id: conversationId })
    });

    console.log('Payload Status:', payloadResponse.status);
    const payloadData = await payloadResponse.json();
    console.log('Payload Data:', JSON.stringify(payloadData, null, 2));

    if (payloadResponse.ok && payloadData.fields_to_extract) {
      console.log('\n✅ SUCCESS! All functions working correctly');
      console.log(`📊 Summary:`);
      console.log(`   - Conversation messages: ${payloadData.conversation_history?.length || 0}`);
      console.log(`   - Fields to extract: ${payloadData.fields_to_extract?.length || 0}`);
      console.log(`   - Business: ${payloadData.business_context?.name}`);
    }

  } catch (error) {
    console.error('❌ Conversation function test failed:', error.message);
  }
}

testWebhook();