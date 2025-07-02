// Quick script to check what conversation data we have
const SUPABASE_URL = 'https://zjgwpgllznqhexyadozz.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZ3dwZ2xsem5xaGV4eWFkb3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4OTkyMjIsImV4cCI6MjA2NjQ3NTIyMn0.IsFHmEfDc3Yg-suEPgsCJITOYTcH8CCh0UGEyFPLasI';

async function checkConversations() {
  try {
    console.log('🔍 Checking conversation data in database...');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/ghl_conversations?select=conversation_id,location_id,message_type,direction,date_added&order=date_added.desc&limit=10`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (response.ok) {
      const conversations = await response.json();
      console.log(`✅ Found ${conversations.length} conversation records`);
      
      if (conversations.length > 0) {
        console.log('\nRecent conversations:');
        conversations.forEach((conv, i) => {
          console.log(`  ${i + 1}. ${conv.conversation_id} (${conv.location_id}) - ${conv.message_type} ${conv.direction} - ${conv.date_added}`);
        });
        
        // Test with the most recent conversation
        const testConversationId = conversations[0].conversation_id;
        console.log(`\n🎯 Testing with conversation: ${testConversationId}`);
        
        // Test conversation history function
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
        
        console.log('Conversation History Status:', historyResponse.status);
        const historyData = await historyResponse.json();
        console.log('History Response:', JSON.stringify(historyData, null, 2));
        
      } else {
        console.log('No conversations found. You can test by:');
        console.log('1. Sending a webhook from GHL');
        console.log('2. Using the webhook test function');
      }
    } else {
      console.log('❌ Failed to query conversations:', response.status);
      const errorText = await response.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkConversations();