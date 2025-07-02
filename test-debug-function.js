// Test script for the debug-ghl-token edge function
async function testDebugFunction() {
  const locationId = '3lkoUn4O7jExzrkx3shg';
  const functionUrl = 'https://zjgwpgllznqhexyadozz.supabase.co/functions/v1/debug-ghl-token';
  
  console.log('🧪 Testing debug-ghl-token edge function...');
  console.log('Function URL:', functionUrl);
  console.log('Location ID:', locationId);
  
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZ3dwZ2xsem5xaGV4eWFkb3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4OTkyMjIsImV4cCI6MjA2NjQ3NTIyMn0.IsFHmEfDc3Yg-suEPgsCJITOYTcH8CCh0UGEyFPLasI'
      },
      body: JSON.stringify({
        locationId: locationId
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Function call successful!');
        console.log('Debug report:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('✅ Function responded but response is not JSON:', responseText);
      }
    } else {
      console.log('❌ Function call failed');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', errorData);
      } catch (e) {
        console.log('Raw error response:', responseText);
      }
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Run the test
testDebugFunction();