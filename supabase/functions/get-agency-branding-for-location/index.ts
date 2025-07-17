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
    console.log('=== GET AGENCY BRANDING REQUEST ===')
    
    const requestBody = await req.json()
    const locationId = requestBody.location_id
    
    if (!locationId) {
      return new Response(
        JSON.stringify({ 
          error: "location_id is required",
          example: { location_id: "abc123" }
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

    console.log('Getting agency branding for location:', locationId)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get the agency_ghl_id for this location
    console.log('Step 1: Getting agency_ghl_id for location')
    const { data: locationConfig, error: locationError } = await supabase
      .from('ghl_configurations')
      .select('agency_ghl_id, ghl_company_id')
      .eq('ghl_account_id', locationId)
      .maybeSingle()

    if (locationError) {
      console.error('Error fetching location config:', locationError)
      throw new Error(`Failed to fetch location configuration: ${locationError.message}`)
    }

    // If no agency ID found, return default branding
    const agencyId = locationConfig?.agency_ghl_id || locationConfig?.ghl_company_id
    if (!agencyId) {
      console.log('No agency ID found for location, returning default branding')
      return new Response(
        JSON.stringify(getDefaultBranding()),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    console.log('Found agency ID for location:', agencyId)

    // Step 2: Get branding for this agency
    console.log('Step 2: Getting branding for agency')
    const { data: branding, error: brandingError } = await supabase
      .from('agency_branding')
      .select('*')
      .eq('agency_ghl_id', agencyId)
      .maybeSingle()

    if (brandingError) {
      console.error('Error fetching agency branding:', brandingError)
      throw new Error(`Failed to fetch agency branding: ${brandingError.message}`)
    }

    // If no branding found, return default branding
    if (!branding) {
      console.log('No branding found for agency, returning default branding')
      return new Response(
        JSON.stringify(getDefaultBranding()),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    console.log('Found branding for agency:', {
      agency_name: branding.agency_name,
      custom_app_name: branding.custom_app_name
    })

    return new Response(
      JSON.stringify(branding),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )

  } catch (error) {
    console.error("=== GET AGENCY BRANDING ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to get agency branding: ${error.message}`,
        details: error.toString(),
        default_branding: getDefaultBranding()
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

function getDefaultBranding() {
  return {
    agency_name: '',
    custom_app_name: 'Data Extractor',
    primary_color: '#3B82F6',
    secondary_color: '#1F2937',
    accent_color: '#10B981',
    hide_ghl_branding: false,
    welcome_message: 'Welcome to your conversation data extractor.',
    support_email: 'support@gohighlevel.com'
  }
}