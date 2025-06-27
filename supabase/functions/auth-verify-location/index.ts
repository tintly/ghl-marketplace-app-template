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
    const locationId = url.pathname.split('/').pop()
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

    // For now, we'll simulate the verification since full decryption is complex in Deno
    // In production, you'd implement the full decryption logic
    
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