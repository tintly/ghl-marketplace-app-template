import { createClient } from 'npm:@supabase/supabase-js@2'
import { md5 } from "../_shared/md5.ts"
import { 
  DEV_MODE, 
  getDevUserContext, 
  validateRealAccountTokens,
  shouldCreateDevConfig
} from "../_shared/dev-config.ts"

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
      console.log('Development mode enabled - using real GHL account with proper token validation')
      
      const userContext = getDevUserContext()
      
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      
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
      
      // Check for existing configuration with real tokens
      const configResult = await validateRealAccountConfiguration(supabase, userContext)
      
      console.log('=== AUTH REQUEST COMPLETE ===')
      console.log('Final result:', {
        userId: userContext.userId,
        email: userContext.email,
        configResult: configResult ? 'Found' : 'Missing'
      })

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            ...userContext,
            devMode: true,
            configFound: !!configResult,
            configId: configResult?.id || null,
            tokenStatus: configResult?.tokenStatus || 'missing',
            tokenValidation: configResult?.tokenValidation || null
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
    
    // Production mode - handle SSO decryption
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

    // Initialize Supabase to validate configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Validate production configuration
    const configResult = await validateRealAccountConfiguration(supabase, userContext)

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          ...userContext,
          configValidated: !!configResult,
          configId: configResult?.id || null,
          tokenStatus: configResult?.tokenStatus || 'unknown',
          tokenValidation: configResult?.tokenValidation || null
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
  } catch (error) {
    console.error("=== AUTH REQUEST ERROR ===")
    console.error("Error message:", error.message)
    
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

async function validateRealAccountConfiguration(supabase: any, userContext: any) {
  try {
    console.log('=== REAL ACCOUNT CONFIGURATION VALIDATION ===')
    console.log('User context:', {
      userId: userContext.userId,
      locationId: userContext.locationId,
      email: userContext.email
    })
    
    // Check if configuration exists
    const { data: existingConfig, error: checkError } = await supabase
      .from('ghl_configurations')
      .select('*')
      .eq('ghl_account_id', userContext.locationId)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing config:', checkError)
      throw new Error(`Failed to check existing configuration: ${checkError.message}`)
    }
    
    if (existingConfig) {
      console.log('Found existing configuration:', {
        id: existingConfig.id,
        userId: existingConfig.user_id,
        businessName: existingConfig.business_name,
        hasAccessToken: !!existingConfig.access_token,
        hasRefreshToken: !!existingConfig.refresh_token,
        tokenExpiry: existingConfig.token_expires_at,
        isDevToken: existingConfig.access_token?.startsWith('dev-')
      })
      
      // Validate token status using the real account validation
      const tokenValidation = validateRealAccountTokens(existingConfig)
      console.log('Token validation result:', tokenValidation)
      
      // If configuration exists but no user_id, link it
      if (!existingConfig.user_id) {
        console.log('Linking existing config to user...')
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
          console.error('Failed to link config:', updateError)
          return { 
            ...existingConfig, 
            tokenStatus: 'link_failed',
            tokenValidation 
          }
        }
        
        console.log('Successfully linked config to user')
        return { 
          ...updatedConfig, 
          tokenStatus: 'linked',
          tokenValidation 
        }
      }
      
      return { 
        ...existingConfig, 
        tokenStatus: 'found',
        tokenValidation 
      }
    }
    
    console.log('No existing configuration found')
    return {
      tokenStatus: 'missing',
      tokenValidation: {
        isValid: false,
        message: 'No configuration found. Please install the app via OAuth.',
        severity: 'error'
      }
    }
    
  } catch (error) {
    console.error('Error in configuration validation:', error)
    return {
      tokenStatus: 'error',
      tokenValidation: {
        isValid: false,
        message: `Configuration validation failed: ${error.message}`,
        severity: 'error'
      }
    }
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