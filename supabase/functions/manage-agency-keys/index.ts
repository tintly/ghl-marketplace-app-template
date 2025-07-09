import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface AgencyKeyRequest {
  openai_api_key: string
  openai_org_id?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    console.log('=== MANAGE AGENCY KEYS REQUEST ===')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get encryption key from environment
    const encryptionKey = Deno.env.get('OPENAI_KEY_ENCRYPTION_SECRET')
    if (!encryptionKey) {
      throw new Error('OPENAI_KEY_ENCRYPTION_SECRET environment variable is not set')
    }

    // Extract JWT claims to verify agency permissions
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header is required" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Extract JWT token
    const token = authHeader.replace('Bearer ', '')
    
    // Verify JWT and extract claims
    const { data: jwtData, error: jwtError } = await supabase.auth.getUser(token)
    
    if (jwtError) {
      return new Response(
        JSON.stringify({ error: "Invalid JWT token", details: jwtError.message }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Extract claims from JWT
    const jwt = jwtData.user.app_metadata
    const ghlUserId = jwt.ghl_user_id
    const ghlCompanyId = jwt.ghl_company_id
    const ghlUserType = jwt.ghl_user_type
    const ghlPaymentPlan = jwt.ghl_payment_plan || 'standard'

    console.log('JWT claims:', {
      ghlUserId,
      ghlCompanyId,
      ghlUserType,
      ghlPaymentPlan
    })

    // Verify this is an agency user on a premium plan
    if (ghlUserType !== 'agency' || !['premium', 'enterprise'].includes(ghlPaymentPlan)) {
      return new Response(
        JSON.stringify({ 
          error: "Unauthorized. Only agency users on premium plans can manage API keys",
          userType: ghlUserType,
          paymentPlan: ghlPaymentPlan
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Verify company ID is present
    if (!ghlCompanyId) {
      return new Response(
        JSON.stringify({ error: "Company ID not found in JWT claims" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    // Handle different HTTP methods
    if (req.method === "GET") {
      // Get the agency's current API key (encrypted)
      const { data: keyData, error: keyError } = await supabase
        .from('agency_openai_keys')
        .select('id, agency_ghl_id, encrypted_openai_api_key, openai_org_id, payment_plan, created_at, updated_at')
        .eq('agency_ghl_id', ghlCompanyId)
        .maybeSingle()

      if (keyError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch API key", details: keyError.message }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        )
      }

      // If no key exists, return empty data
      if (!keyData) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "No API key found for this agency",
            hasKey: false
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

      // Return key info (but not the actual key)
      return new Response(
        JSON.stringify({
          success: true,
          hasKey: true,
          keyInfo: {
            id: keyData.id,
            agency_ghl_id: keyData.agency_ghl_id,
            has_org_id: !!keyData.openai_org_id,
            payment_plan: keyData.payment_plan,
            created_at: keyData.created_at,
            updated_at: keyData.updated_at,
            // Return a masked version of the key
            masked_key: '••••••••••••••••••••••' + keyData.encrypted_openai_api_key.substring(keyData.encrypted_openai_api_key.length - 4)
          }
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
    else if (req.method === "POST" || req.method === "PUT") {
      // Parse request body
      const requestBody: AgencyKeyRequest = await req.json()
      
      // Validate required fields
      if (!requestBody.openai_api_key) {
        return new Response(
          JSON.stringify({ error: "openai_api_key is required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        )
      }

      // Encrypt the API key
      const encryptedKey = await encryptApiKey(requestBody.openai_api_key, encryptionKey)
      
      // Prepare data for upsert
      const keyData = {
        agency_ghl_id: ghlCompanyId,
        encrypted_openai_api_key: encryptedKey,
        openai_org_id: requestBody.openai_org_id || null,
        payment_plan: ghlPaymentPlan,
        updated_at: new Date().toISOString()
      }

      // Upsert the key data
      const { data: upsertData, error: upsertError } = await supabase
        .from('agency_openai_keys')
        .upsert(keyData, { onConflict: 'agency_ghl_id' })
        .select('id')

      if (upsertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save API key", details: upsertError.message }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "API key saved successfully",
          id: upsertData?.[0]?.id
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
    else if (req.method === "DELETE") {
      // Delete the agency's API key
      const { error: deleteError } = await supabase
        .from('agency_openai_keys')
        .delete()
        .eq('agency_ghl_id', ghlCompanyId)

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "Failed to delete API key", details: deleteError.message }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "API key deleted successfully"
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
    else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

  } catch (error) {
    console.error("=== MANAGE AGENCY KEYS ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to manage agency keys: ${error.message}`,
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

// Helper function to encrypt API key using AES-256-CBC
async function encryptApiKey(apiKey: string, encryptionKey: string): Promise<string> {
  try {
    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(16))
    
    // Convert encryption key to proper format
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(encryptionKey),
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    )
    
    // Encrypt the API key
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-CBC',
        iv
      },
      keyMaterial,
      new TextEncoder().encode(apiKey)
    )
    
    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encryptedData.byteLength)
    result.set(iv)
    result.set(new Uint8Array(encryptedData), iv.length)
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...result))
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error(`Failed to encrypt API key: ${error.message}`)
  }
}

// Helper function to decrypt API key
export async function decryptApiKey(encryptedKey: string, encryptionKey: string): Promise<string> {
  try {
    // Convert from base64
    const encryptedData = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0))
    
    // Extract IV (first 16 bytes)
    const iv = encryptedData.slice(0, 16)
    
    // Extract the encrypted data (everything after IV)
    const data = encryptedData.slice(16)
    
    // Import the encryption key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(encryptionKey),
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    )
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv
      },
      keyMaterial,
      data
    )
    
    // Convert to string
    return new TextDecoder().decode(decryptedData)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error(`Failed to decrypt API key: ${error.message}`)
  }
}