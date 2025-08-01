// helpers.mjs

// X-Ray SDK import and initialization for helpers
let AWSXRay;
try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
} catch (e) {
    console.warn("X-Ray SDK not loaded for helpers.mjs:", e.message);
    AWSXRay = null;
}

/**
 * Helper function to decrypt API key (placeholder for actual decryption logic)
 * @param {string} encryptedKey - The key to decrypt. Assumed base64 encoded for this example.
 * @returns {string} The decrypted key.
 */
export async function decryptApiKey(encryptedKey) {
    // This is a placeholder. In a real application, you would use a secure key management system
    // like KMS, AWS Secrets Manager's encryption, or another robust method.
    // For now, assuming it's base64 encoded for simplicity (as hinted by the original code's `atob`).
    try {
        return atob(encryptedKey);
    } catch (e) {
        console.error('Failed to base64 decode API key:', e);
        // If base64 decode fails, return the original string.
        // This might indicate it's not base64, or already plain text.
        return encryptedKey;
    }
}

/**
 * Updates an existing usage log record in Supabase.
 * @param {object} supabase - The Supabase client instance.
 * @param {string} logId - The ID of the log record to update.
 * @param {object} updates - An object containing the fields to update.
 * @param {object} [parentSegment=null] - The parent X-Ray segment for subsegment creation.
 */
export async function updateUsageLog(supabase, logId, updates, parentSegment = null) {
    const operation = async (subsegment) => {
        try {
            const { error } = await supabase.from('ai_usage_logs').update(updates).eq('id', logId);
            if (error) {
                console.error('Failed to update usage log:', error);
                if (subsegment) subsegment.addError(error);
                throw error; // Propagate error for main handler's catch
            } else {
                console.log('Usage log updated successfully.');
            }
        } catch (e) {
            if (subsegment) subsegment.addError(e);
            throw e;
        }
    };

    if (AWSXRay && AWSXRay.captureAsyncFunc) {
        return AWSXRay.captureAsyncFunc('Supabase - updateUsageLog', operation, parentSegment);
    } else {
        return operation(null); // No X-Ray segment if SDK not loaded
    }
}