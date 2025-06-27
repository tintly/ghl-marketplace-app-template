const { createDecipheriv, createHash } = require('crypto');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { key } = JSON.parse(event.body);
    
    if (!key) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'SSO key is required'
        })
      };
    }

    const userData = decryptSSOData(key);
    
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
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
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to decrypt SSO data'
      })
    };
  }
};

function decryptSSOData(key) {
  try {
    const blockSize = 16;
    const keySize = 32;
    const ivSize = 16;
    const saltSize = 8;
    
    const rawEncryptedData = Buffer.from(key, 'base64');
    const salt = rawEncryptedData.subarray(saltSize, blockSize);
    const cipherText = rawEncryptedData.subarray(blockSize);
    
    let result = Buffer.alloc(0, 0);
    while (result.length < (keySize + ivSize)) {
      const hasher = createHash('md5');
      result = Buffer.concat([
        result,
        hasher.update(Buffer.concat([
          result.subarray(-ivSize),
          Buffer.from(process.env.GHL_APP_SHARED_SECRET, 'utf-8'),
          salt
        ])).digest()
      ]);
    }
    
    const decipher = createDecipheriv(
      'aes-256-cbc',
      result.subarray(0, keySize),
      result.subarray(keySize, keySize + ivSize)
    );
    
    const decrypted = decipher.update(cipherText);
    const finalDecrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(finalDecrypted.toString());
  } catch (error) {
    console.error('Error decrypting SSO data:', error);
    throw error;
  }
}