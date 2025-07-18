import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  try {
    console.log('=== GET RECENT CONTACTS REQUEST ===')
    
    const requestBody = await req.json()
    const limit = requestBody.limit || 10
    const locationId = requestBody.location_id
    
    // SECURITY: location_id is now REQUIRED to prevent cross-agency data access
    if (!locationId) {
      return new Response(
        JSON.stringify({ 
          error: "location_id is required for security",
          message: "Must specify location_id to prevent cross-agency data access"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }
    
    console.log('Fetching recent contacts:', {
      limit,
      locationId
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Query to get distinct contact IDs from recent conversations
    // SECURITY: Always filter by location_id to prevent cross-agency access
    const query = supabase
      .from('ghl_conversations')
      .select('contact_id, location_id, date_added')
      .not('contact_id', 'is', null)
      .eq('location_id', locationId)
      .order('date_added', { ascending: false })
      .limit(100) // Get more than we need to ensure we have enough unique contacts
    
    const { data: conversations, error: conversationsError } = await query
    
    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError)
      throw new Error(`Failed to fetch conversations: ${conversationsError.message}`)
    }
    
    console.log(`Found ${conversations?.length || 0} recent conversations`)
    
    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No recent conversations found",
          contacts: []
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }
    
    // Get unique contact IDs with their most recent message date
    const contactMap = new Map()
    conversations.forEach(conv => {
      if (!conv.contact_id) return
      
      if (!contactMap.has(conv.contact_id) || 
          new Date(conv.date_added) > new Date(contactMap.get(conv.contact_id).last_message)) {
        contactMap.set(conv.contact_id, {
          id: conv.contact_id,
          location_id: conv.location_id,
          last_message: conv.date_added
        })
      }
    })
    
    // Get the top N unique contacts
    const uniqueContacts = Array.from(contactMap.values()).slice(0, limit)
    
    console.log(`Found ${uniqueContacts.length} unique contacts`)
    
    if (uniqueContacts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No contacts found in recent conversations",
          contacts: []
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }
    
    // For each contact, fetch basic info from GHL
    const contactDetails = []
    
    for (const contact of uniqueContacts) {
      try {
        // Get GHL configuration for this location
        const { data: config } = await supabase
          .from('ghl_configurations')
          .select('access_token')
          .eq('ghl_account_id', contact.location_id)
          .eq('is_active', true)
          .maybeSingle()
        
        if (!config || !config.access_token) {
          console.log(`No active configuration found for location ${contact.location_id}`)
          contactDetails.push({
            id: contact.id,
            name: `Unknown (${contact.id.substring(0, 8)}...)`,
            location_id: contact.location_id,
            last_message: contact.last_message
          })
          continue
        }
        
        // Fetch contact from GHL
        const contactInfo = await getGHLContact(config.access_token, contact.id)
        
        if (contactInfo) {
          contactDetails.push({
            id: contact.id,
            name: contactInfo.name || `${contactInfo.firstName || ''} ${contactInfo.lastName || ''}`.trim(),
            email: contactInfo.email,
            phone: contactInfo.phone,
            location_id: contact.location_id,
            last_message: contact.last_message
          })
        } else {
          contactDetails.push({
            id: contact.id,
            name: `Contact ${contact.id.substring(0, 8)}...`,
            location_id: contact.location_id,
            last_message: contact.last_message
          })
        }
      } catch (error) {
        console.error(`Error fetching contact ${contact.id}:`, error)
        contactDetails.push({
          id: contact.id,
          name: `Error: ${contact.id.substring(0, 8)}...`,
          location_id: contact.location_id,
          last_message: contact.last_message,
          error: error.message
        })
      }
    }
    
    console.log(`✅ Retrieved details for ${contactDetails.length} contacts`)
    
    return new Response(
      JSON.stringify({
        success: true,
        contacts: contactDetails,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )

  } catch (error) {
    console.error("=== GET RECENT CONTACTS ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to get recent contacts: ${error.message}`,
        details: error.toString(),
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }
})

async function getGHLContact(accessToken: string, contactId: string) {
  try {
    const apiDomain = Deno.env.get('GHL_API_DOMAIN') || 'https://services.leadconnectorhq.com'
    const url = `${apiDomain}/contacts/${contactId}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch contact: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    return responseData.contact || responseData
  } catch (error) {
    console.error('Error fetching contact:', error)
    return null
  }
}