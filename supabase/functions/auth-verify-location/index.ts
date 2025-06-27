import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== "POST") {
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

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const locationId = pathParts[pathParts.length - 1]
    const { key } = await req.json()
    
    if (!key || !locationId) {
      return new Response(
        JSON.stringify({ error: "SSO key and locationId are required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    const userData = decryptSSOData(key)
    const userLocationId = userData.activeLocation || userData.companyId
    
    if (userLocationId !== locationId) {
      return new Response(
        JSON.stringify({ error: "Access denied to this location" }),
        {
          status: 403,
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
        hasAccess: true
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
    console.error("Location access verification error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to verify location access" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }
})

function decryptSSOData(key: string) {
  try {
    const sharedSecret = Deno.env.get("GHL_APP_SHARED_SECRET")
    if (!sharedSecret) {
      throw new Error('GHL_APP_SHARED_SECRET environment variable is not set')
    }
    
    const blockSize = 16
    const keySize = 32
    const ivSize = 16
    const saltSize = 8
    
    const rawEncryptedData = new Uint8Array(
      atob(key).split('').map(c => c.charCodeAt(0))
    )
    const salt = rawEncryptedData.slice(saltSize, blockSize)
    const cipherText = rawEncryptedData.slice(blockSize)
    
    // This is a simplified version - in production you'd implement the full decryption
    // For now, we'll return a mock response to test the flow
    return {
      userId: 'test-user-id',
      email: 'test@example.com',
      userName: 'Test User',
      role: 'admin',
      type: 'location',
      companyId: 'test-company-id',
      activeLocation: 'test-location-id'
    }
  } catch (error) {
    console.error("Error decrypting SSO data:", error)
    throw error
  }
}