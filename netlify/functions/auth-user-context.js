const { createDecipheriv, createHash } = require('crypto');

exports.handler = async (event, context) => {
  // Add CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Processing auth request...');
    
    const { key } = JSON.parse(event.body);
    
    if (!key) {
      console.log('No SSO key provided');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        body: JSON.stringify({
          error: 'SSO key is required'
        })
      };
    }

    console.log('Attempting to decrypt SSO data...');
    const userData = decryptSSOData(key);
    console.log('SSO data decrypted successfully');
    
    // Extract locationId from companyId context
    const locationId = userData.activeLocation || userData.companyId;
    
    const userContext = {
      userId: userData.userId,
      email: userData.email,
      userName: userData.userName,
      role: userData.role,
      type: userData.type,
      companyId: userData.companyId,
      locationId: locationId,
      activeLocation: userData.activeLocation
    };

    console.log('User context created:', { userId: userContext.userId, email: userContext.email });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({
        success: true,
        user: userContext
      })
    };
  } catch (error) {
    console.error('SSO decryption error:', error);
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({
        error: 'Failed to decrypt SSO data: ' + error.message
      })
    };
  }
};

function decryptSSOData(key) {
  try {
    console.log('Starting decryption process...');
    
    // Check if shared secret is available
    const sharedSecret = process.env.GHL_APP_SHARED_SECRET;
    if (!sharedSecret) {
      throw new Error('GHL_APP_SHARED_SECRET environment variable is not set');
    }
    
    console.log('Shared secret found, proceeding with decryption...');
    
    const blockSize = 16;
    const keySize = 32;
    const ivSize = 16;
    const saltSize = 8;
    
    const rawEncryptedData = Buffer.from(key, 'base64');
    console.log('Raw encrypted data length:', rawEncryptedData.length);
    
    if (rawEncryptedData.length < blockSize) {
      throw new Error('Invalid encrypted data: too short');
    }
    
    const salt = rawEncryptedData.subarray(saltSize, blockSize);
    const cipherText = rawEncryptedData.subarray(blockSize);
    
    console.log('Salt length:', salt.length, 'Cipher text length:', cipherText.length);
    
    let result = Buffer.alloc(0, 0);
    while (result.length < (keySize + ivSize)) {
      const hasher = createHash('md5');
      result = Buffer.concat([
        result,
        hasher.update(Buffer.concat([
          result.subarray(-ivSize),
          Buffer.from(sharedSecret, 'utf-8'),
          salt
        ])).digest()
      ]);
    }
    
    console.log('Key derivation complete, result length:', result.length);
    
    const decipher = createDecipheriv(
      'aes-256-cbc',
      result.subarray(0, keySize),
      result.subarray(keySize, keySize + ivSize)
    );
    
    const decrypted = decipher.update(cipherText);
    const finalDecrypted = Buffer.concat([decrypted, decipher.final()]);
    
    console.log('Decryption complete, parsing JSON...');
    const parsedData = JSON.parse(finalDecrypted.toString());
    console.log('JSON parsed successfully');
    
    return parsedData;
  } catch (error) {
    console.error('Detailed decryption error:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}