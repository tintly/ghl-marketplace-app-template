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
    console.log('=== AUTH REQUEST START ===')
    
    // Check if we're in development mode
    if (DEV_MODE) {
      console.log('Development mode enabled - using manual user data')
      const userContext = getDevUserContext()
      
      // Initialize Supabase client with service role for dev configuration
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      
      console.log('Environment check:', {
        supabaseUrl: supabaseUrl ? 'Set' : 'Missing',
        serviceKey: supabaseServiceKey ? 'Set' : 'Missing',
        devMode: DEV_MODE
      })
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing Supabase environment variables')
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              ...userContext,
              devMode: true,
              configError: 'Missing Supabase environment variables'
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
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      // Create or update dev configuration with detailed error handling
      const configResult = await ensureDevConfiguration(supabase, userContext)
      
      console.log('=== AUTH REQUEST COMPLETE ===')
      console.log('Final result:', {
        userId: userContext.userId,
        email: userContext.email,
        configResult: configResult ? 'Success' : 'Failed'
      })

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            ...userContext,
            devMode: true,
            configCreated: !!configResult,
            configId: configResult?.id || null
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
    console.error("=== AUTH REQUEST ERROR ===")
    console.error("Error type:", typeof error)
    console.error("Error message:", error.message)
    console.error("Error stack:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to process auth request: ${error.message}`,
        details: error.toString()
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
})

async function ensureDevConfiguration(supabase: any, userContext: any) {
  try {
    console.log('=== DEV CONFIGURATION START ===')
    console.log('User context:', {
      userId: userContext.userId,
      locationId: userContext.locationId,
      email: userContext.email
    })
    
    // Test database connection with a simple query
    console.log('Step 1: Testing database connection...')
    try {
      const { data: healthCheck, error: healthError } = await supabase
        .from('ghl_configurations')
        .select('id')
        .limit(1)

      if (healthError) {
        console.error('Database health check failed:', {
          code: healthError.code,
          message: healthError.message,
          details: healthError.details,
          hint: healthError.hint
        })
        throw new Error(`Database connection failed: ${healthError.message}`)
      }
      
      console.log('Database connection successful')
    } catch (dbError) {
      console.error('Database connection test failed:', dbError)
      throw new Error(`Database unavailable: ${dbError.message}`)
    }
    
    // Check if configuration already exists
    console.log('Step 2: Checking for existing configuration...')
    try {
      const { data: existingConfig, error: checkError } = await supabase
        .from('ghl_configurations')
        .select('*')
        .eq('ghl_account_id', userContext.locationId)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing config:', {
          code: checkError.code,
          message: checkError.message,
          details: checkError.details
        })
        throw new Error(`Failed to check existing configuration: ${checkError.message}`)
      }
      
      if (existingConfig) {
        console.log('Found existing configuration:', {
          id: existingConfig.id,
          userId: existingConfig.user_id,
          businessName: existingConfig.business_name
        })
        
        // If exists but no user_id, update it
        if (!existingConfig.user_id) {
          console.log('Step 2a: Linking existing config to user...')
          const { data: updatedConfig, error: updateError } = await supabase
            .from('ghl_configurations')
            .update({ 
              user_id: userContext.userId,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingConfig.id)
            .select()
            .single()

          if (updateError) {
            console.error('Failed to link config:', {
              code: updateError.code,
              message: updateError.message,
              details: updateError.details
            })
            // Return original config even if linking fails
            return existingConfig
          }
          
          console.log('Successfully linked config to user')
          return updatedConfig
        }
        
        console.log('Configuration already properly linked')
        return existingConfig
      }
      
      console.log('No existing configuration found')
    } catch (checkError) {
      console.error('Error in configuration check:', checkError)
      throw checkError
    }

    // Create new configuration
    console.log('Step 3: Creating new dev configuration...')
    const configData = {
      user_id: userContext.userId,
      ghl_account_id: userContext.locationId,
      client_id: 'dev-client-id',
      client_secret: 'dev-client-secret',
      access_token: 'dev-access-token',
      refresh_token: 'dev-refresh-token',
      token_expires_at: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(),
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

    console.log('Configuration data prepared:', {
      user_id: configData.user_id,
      ghl_account_id: configData.ghl_account_id,
      business_name: configData.business_name
    })

    try {
      const { data: newConfig, error: insertError } = await supabase
        .from('ghl_configurations')
        .insert(configData)
        .select()
        .single()

      if (insertError) {
        console.error('=== INSERT ERROR DETAILS ===')
        console.error('Error code:', insertError.code)
        console.error('Error message:', insertError.message)
        console.error('Error details:', insertError.details)
        console.error('Error hint:', insertError.hint)
        console.error('Full error object:', JSON.stringify(insertError, null, 2))
        
        // Check if it's a unique constraint violation
        if (insertError.code === '23505') {
          console.log('Unique constraint violation - attempting to fetch existing record')
          try {
            const { data: existingAfterError, error: fetchError } = await supabase
              .from('ghl_configurations')
              .select('*')
              .eq('ghl_account_id', userContext.locationId)
              .single()
              
            if (!fetchError && existingAfterError) {
              console.log('Found existing record after constraint violation:', existingAfterError.id)
              return existingAfterError
            } else {
              console.error('Failed to fetch existing record:', fetchError)
            }
          } catch (fetchError) {
            console.error('Error fetching after constraint violation:', fetchError)
          }
        }
        
        throw new Error(`Database insert failed: ${insertError.message} (Code: ${insertError.code})`)
      }

      console.log('=== SUCCESS ===')
      console.log('Dev configuration created successfully:', {
        id: newConfig.id,
        ghl_account_id: newConfig.ghl_account_id,
        user_id: newConfig.user_id
      })
      return newConfig
      
    } catch (insertError) {
      console.error('Insert operation failed:', insertError)
      throw insertError
    }
    
  } catch (error) {
    console.error('=== CONFIGURATION CREATION FAILED ===')
    console.error('Error type:', typeof error)
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    // Return null instead of throwing to allow auth to continue
    console.log('Returning null to allow auth to continue despite config failure')
    return null
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