import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createHash } from "https://deno.land/std@0.168.0/crypto/mod.ts"

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
    const { key } = await req.json()
    
    if (!key) {
      return new Response(
        JSON.stringify({ error: "SSO key is required" }),
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
    
    // Extract locationId from companyId context
    const locationId = userData.activeLocation || userData.companyId
    
    const userContext = {
      userId: userData.userId,
      email: userData.email,
      userName: userData.userName,
      role: userData.role,
      type: userData.type,
      companyId: userData.companyId,
      locationId: locationId,
      activeLocation: userData.activeLocation
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: userContext
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
    console.error("SSO decryption error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to decrypt SSO data" }),
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
    const blockSize = 16
    const keySize = 32
    const ivSize = 16
    const saltSize = 8
    
    const rawEncryptedData = new Uint8Array(atob(key).split('').map(c => c.charCodeAt(0)))
    const salt = rawEncryptedData.slice(saltSize, blockSize)
    const cipherText = rawEncryptedData.slice(blockSize)
    
    let result = new Uint8Array(0)
    while (result.length < (keySize + ivSize)) {
      const hasher = createHash("md5")
      const combined = new Uint8Array([
        ...result.slice(-ivSize),
        ...new TextEncoder().encode(Deno.env.get("GHL_APP_SHARED_SECRET") || ""),
        ...salt
      ])
      hasher.update(combined)
      const digest = new Uint8Array(hasher.digest())
      const newResult = new Uint8Array(result.length + digest.length)
      newResult.set(result)
      newResult.set(digest, result.length)
      result = newResult
    }
    
    const cryptoKey = result.slice(0, keySize)
    const iv = result.slice(keySize, keySize + ivSize)
    
    // Note: This is a simplified version. For production, you'd need proper AES-256-CBC decryption
    // which requires WebCrypto API or a crypto library compatible with Deno
    throw new Error("Full AES decryption not implemented in this example")
    
  } catch (error) {
    console.error("Error decrypting SSO data:", error)
    throw error
  }
}