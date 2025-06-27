import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { md5 } from "../_shared/md5.ts"
import { DEV_MODE, getDevUserContext } from "../_shared/dev-config.ts"

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
    console.log('Processing auth request...')
    
    // Check if we're in development mode
    if (DEV_MODE) {
      console.log('Development mode enabled - using manual user data')
      const userContext = getDevUserContext()
      
      // Initialize Supabase client with service role for dev configuration
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      // Create or update dev configuration
      await ensureDevConfiguration(supabase, userContext)
      
      console.log('Dev user context created:', { userId: userContext.userId, email: userContext.email })

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            ...userContext,
            devMode: true  // Explicitly set devMode flag
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
    
    const { key } = await req.json()
    
    if (!key) {
      console.log('No SSO key provided')
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

    console.log('Attempting to decrypt SSO data...')
    const userData = await decryptSSOData(key)
    console.log('SSO data decrypted successfully')
    
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

    console.log('User context created:', { userId: userContext.userId, email: userContext.email })

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
      JSON.stringify({ error: `Failed to decrypt SSO data: ${error.message}` }),
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

async function ensureDevConfiguration(supabase: any, userContext: any) {
  try {
    console.log('Creating/updating dev configuration for location:', userContext.locationId)
    
    // Use upsert with the unique constraint on ghl_account_id
    const configData = {
      user_id: userContext.userId,
      ghl_account_id: userContext.locationId,
      client_id: 'dev-client-id',
      client_secret: 'dev-client-secret',
      access_token: 'dev-access-token',
      refresh_token: 'dev-refresh-token',
      token_expires_at: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(), // 1 year from now
      business_name: 'Development Business',
      business_address: '123 Dev Street',
      business_phone: '+1-555-0123',
      business_email: userContext.email,
      business_website: 'https://dev.example.com',
      business_description: 'Development environment business for testing',
      target_audience: 'Developers and testers',
      services_offered: 'Software development and testing services',
      business_context: 'This is a development environment configuration for testing purposes',
      is_active: true,
      created_by: userContext.userId
    }

    console.log('Attempting upsert with data:', {
      user_id: configData.user_id,
      ghl_account_id: configData.ghl_account_id,
      business_name: configData.business_name
    })

    // Use upsert to handle both insert and update cases
    const { data, error } = await supabase
      .from('ghl_configurations')
      .upsert(configData, {
        onConflict: 'ghl_account_id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      console.error('Error upserting dev configuration:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // Try a direct insert as fallback
      console.log('Attempting direct insert as fallback...')
      const { data: insertData, error: insertError } = await supabase
        .from('ghl_configurations')
        .insert(configData)
        .select()

      if (insertError) {
        console.error('Direct insert also failed:', insertError)
        throw insertError
      }

      console.log('Direct insert succeeded:', insertData?.[0]?.id)
      return insertData?.[0]
    }

    console.log('Dev configuration upserted successfully:', data?.[0]?.id)
    return data?.[0]
  } catch (error) {
    console.error('Failed to ensure dev configuration:', error)
    console.error('Full error object:', JSON.stringify(error, null, 2))
    
    // Don't throw - we want auth to succeed even if config creation fails
    console.log('Continuing with auth despite config creation failure')
  }
}

async function decryptSSOData(key: string) {
  try {
    console.log('Starting decryption process...')
    
    // Check if shared secret is available
    const sharedSecret = Deno.env.get("GHL_APP_SHARED_SECRET")
    if (!sharedSecret) {
      throw new Error('GHL_APP_SHARED_SECRET environment variable is not set')
    }
    
    console.log('Shared secret found, proceeding with decryption...')
    
    const blockSize = 16
    const keySize = 32
    const ivSize = 16
    const saltSize = 8
    
    // Decode base64
    const rawEncryptedData = new Uint8Array(
      atob(key).split('').map(c => c.charCodeAt(0))
    )
    console.log('Raw encrypted data length:', rawEncryptedData.length)
    
    if (rawEncryptedData.length < blockSize) {
      throw new Error('Invalid encrypted data: too short')
    }
    
    const salt = rawEncryptedData.slice(saltSize, blockSize)
    const cipherText = rawEncryptedData.slice(blockSize)
    
    console.log('Salt length:', salt.length, 'Cipher text length:', cipherText.length)
    
    // Key derivation using proper MD5
    let result = new Uint8Array(0)
    while (result.length < (keySize + ivSize)) {
      const toHash = new Uint8Array([
        ...result.slice(-ivSize),
        ...new TextEncoder().encode(sharedSecret),
        ...salt
      ])
      
      // Use proper MD5 hash
      const hashArray = md5(toHash)
      
      const newResult = new Uint8Array(result.length + hashArray.length)
      newResult.set(result)
      newResult.set(hashArray, result.length)
      result = newResult
    }
    
    console.log('Key derivation complete, result length:', result.length)
    
    const cryptoKey = result.slice(0, keySize)
    const iv = result.slice(keySize, keySize + ivSize)
    
    // Import the key for AES-256-CBC
    const importedKey = await crypto.subtle.importKey(
      'raw',
      cryptoKey,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    )
    
    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv },
      importedKey,
      cipherText
    )
    
    console.log('Decryption complete, parsing JSON...')
    const decryptedText = new TextDecoder().decode(decryptedBuffer)
    const parsedData = JSON.parse(decryptedText)
    console.log('JSON parsed successfully')
    
    return parsedData
  } catch (error) {
    console.error('Detailed decryption error:', error)
    throw new Error(`Decryption failed: ${error.message}`)
  }
}