import { createClient } from 'npm:@supabase/supabase-js@2'
import { decryptApiKey } from '../manage-agency-keys/index.ts'

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
    console.log('=== GET AGENCY OPENAI KEY REQUEST ===')
    
    const requestBody = await req.json()
    const agencyId = requestBody.agency_id
    
    if (!agencyId) {
      return new Response(
        JSON.stringify({ 
          error: "agency_id is required",
          example: { agency_id: "4beIyWyWrcoPRD7PEN5G" }
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

    console.log('Fetching OpenAI key for agency:', agencyId)

    // Get encryption key from environment
    const encryptionKey = Deno.env.get('OPENAI_KEY_ENCRYPTION_SECRET')
    if (!encryptionKey) {
      throw new Error('OPENAI_KEY_ENCRYPTION_SECRET environment variable is not set')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the agency's API key
    const { data: keyData, error: keyError } = await supabase
      .from('agency_openai_keys')
      .select('encrypted_openai_api_key, openai_org_id, payment_plan')
      .eq('agency_ghl_id', agencyId)
      .maybeSingle()

    if (keyError) {
      console.error('Error fetching agency API key:', keyError)
      throw new Error(`Failed to fetch agency API key: ${keyError.message}`)
    }

    if (!keyData || !keyData.encrypted_openai_api_key) {
      console.log('No API key found for agency:', agencyId)
      return new Response(
        JSON.stringify({
          success: true,
          has_key: false,
          message: "No API key found for this agency"
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

    // Decrypt the API key
    const decryptedKey = await decryptApiKey(keyData.encrypted_openai_api_key, encryptionKey)
    
    console.log('✅ Successfully retrieved and decrypted API key for agency')

    return new Response(
      JSON.stringify({
        success: true,
        has_key: true,
        openai_api_key: decryptedKey,
        openai_org_id: keyData.openai_org_id,
        payment_plan: keyData.payment_plan
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
    console.error("=== GET AGENCY OPENAI KEY ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to get agency OpenAI key: ${error.message}`,
        details: error.toString()
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