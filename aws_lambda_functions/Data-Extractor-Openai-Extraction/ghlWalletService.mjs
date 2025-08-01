// Path: ghlWalletService.mjs

// --- CRITICAL CHANGE FOR X-RAY SDK IMPORT ---
let AWSXRay;
try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
    console.log("X-Ray SDK loaded successfully in ghlWalletService.");
} catch (e) {
    console.error("Failed to load AWS X-Ray SDK in ghlWalletService:", e);
    AWSXRay = {}; // Fallback to an empty object to prevent errors
}
// --- END CRITICAL CHANGE ---

const GHL_API_DOMAIN = process.env.GHL_API_DOMAIN || 'https://services.leadconnectorhq.com';

/**
 * Check if a GHL account has sufficient funds for billing
 * @param {string} accessToken - The GHL access token for the billing entity
 * @param {string} companyId - The GHL company/location ID to check funds for
 * @returns {Promise<{hasFunds: boolean}>} - Object containing hasFunds boolean
 */
export async function checkFunds(accessToken, companyId) {
  const segment = AWSXRay.getSegment ? AWSXRay.getSegment() : null;
  let responseData;

  const operation = async (subsegment) => {
    try {
      const url = `${GHL_API_DOMAIN}/marketplace/billing/charges/has-funds`;
      
      if (subsegment) {
        subsegment.addAnnotation('ghlWalletOperation', 'checkFunds');
        subsegment.addAnnotation('companyId', companyId);
      }

      console.log(`Checking funds for company: ${companyId}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (subsegment) {
          subsegment.addError(new Error(`GHL Wallet API error: ${response.status}`));
          subsegment.addMetadata('ghlErrorResponse', errorText);
        }
        throw new Error(`GHL Wallet API error: ${response.status} - ${errorText}`);
      }

      responseData = await response.json();
      
      if (subsegment) {
        subsegment.addAnnotation('hasFunds', responseData.hasFunds);
      }

      console.log(`Funds check result for ${companyId}:`, responseData.hasFunds);
      return responseData;

    } catch (e) {
      if (subsegment) {
        subsegment.addError(e);
      }
      throw e;
    } finally {
      if (subsegment) {
        subsegment.close();
      }
    }
  };

  if (segment && AWSXRay.captureAsyncFunc) {
    return AWSXRay.captureAsyncFunc('GHL_Wallet_CheckFunds', operation, segment);
  } else {
    console.warn("X-Ray tracing for GHL Wallet checkFunds skipped.");
    return operation(null);
  }
}

/**
 * Create a charge in the GHL Wallet
 * @param {string} accessToken - The GHL access token for the billing entity
 * @param {Object} chargePayload - The charge payload object
 * @returns {Promise<{chargeId: string}>} - Object containing the created charge ID
 */
export async function createCharge(accessToken, chargePayload) {
  const segment = AWSXRay.getSegment ? AWSXRay.getSegment() : null;
  let responseData;

  const operation = async (subsegment) => {
    try {
      const url = `${GHL_API_DOMAIN}/marketplace/billing/charges`;
      
      if (subsegment) {
        subsegment.addAnnotation('ghlWalletOperation', 'createCharge');
        subsegment.addAnnotation('meterId', chargePayload.meterId);
        subsegment.addAnnotation('units', chargePayload.units);
        subsegment.addAnnotation('companyId', chargePayload.companyId);
      }

      console.log('Creating GHL Wallet charge:', {
        meterId: chargePayload.meterId,
        units: chargePayload.units,
        companyId: chargePayload.companyId,
        description: chargePayload.description
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(chargePayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (subsegment) {
          subsegment.addError(new Error(`GHL Wallet charge failed: ${response.status}`));
          subsegment.addMetadata('ghlErrorResponse', errorText);
        }
        throw new Error(`GHL Wallet charge failed: ${response.status} - ${errorText}`);
      }

      responseData = await response.json();
      
      if (subsegment) {
        subsegment.addAnnotation('chargeCreated', true);
        subsegment.addAnnotation('chargeId', responseData.chargeId);
      }

      console.log('GHL Wallet charge created successfully:', responseData.chargeId);
      return responseData;

    } catch (e) {
      if (subsegment) {
        subsegment.addError(e);
      }
      throw e;
    } finally {
      if (subsegment) {
        subsegment.close();
      }
    }
  };

  if (segment && AWSXRay.captureAsyncFunc) {
    return AWSXRay.captureAsyncFunc('GHL_Wallet_CreateCharge', operation, segment);
  } else {
    console.warn("X-Ray tracing for GHL Wallet createCharge skipped.");
    return operation(null);
  }
}

/**
 * Refresh GHL access token using refresh token
 * @param {string} refreshToken - The GHL refresh token
 * @param {string} clientId - The GHL client ID
 * @param {string} clientSecret - The GHL client secret
 * @returns {Promise<{access_token: string, refresh_token: string, expires_in: number}>} - New token data
 */
export async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const segment = AWSXRay.getSegment ? AWSXRay.getSegment() : null;
  let responseData;

  const operation = async (subsegment) => {
    try {
      const url = `${GHL_API_DOMAIN}/oauth/token`;
      
      if (subsegment) {
        subsegment.addAnnotation('ghlOperation', 'refreshToken');
      }

      console.log('Refreshing GHL access token...');
      
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (subsegment) {
          subsegment.addError(new Error(`Token refresh failed: ${response.status}`));
          subsegment.addMetadata('ghlErrorResponse', errorText);
        }
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      responseData = await response.json();
      
      if (subsegment) {
        subsegment.addAnnotation('tokenRefreshed', true);
      }

      console.log('GHL access token refreshed successfully');
      return responseData;

    } catch (e) {
      if (subsegment) {
        subsegment.addError(e);
      }
      throw e;
    } finally {
      if (subsegment) {
        subsegment.close();
      }
    }
  };

  if (segment && AWSXRay.captureAsyncFunc) {
    return AWSXRay.captureAsyncFunc('GHL_RefreshToken', operation, segment);
  } else {
    console.warn("X-Ray tracing for GHL token refresh skipped.");
    return operation(null);
  }
}