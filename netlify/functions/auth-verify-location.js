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
    const pathSegments = event.path.split('/');
    const locationId = pathSegments[pathSegments.length - 1];
    const { key } = JSON.parse(event.body);
    
    if (!key || !locationId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'SSO key and locationId are required'
        })
      };
    }

    const userData = decryptSSOData(key);
    const userLocationId = userData.activeLocation || userData.companyId;
    
    if (userLocationId !== locationId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Access denied to this location'
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        hasAccess: true
      })
    };
  } catch (error) {
    console.error('Location access verification error:', error);
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to verify location access'
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