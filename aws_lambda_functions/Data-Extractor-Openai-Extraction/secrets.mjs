// secrets.mjs
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let secretsClient; // Initialized once for warm starts

// X-Ray integration for Secrets Manager client
let AWSXRay;
try {
    const xrayModule = await import('aws-xray-sdk-core');
    AWSXRay = xrayModule.default || xrayModule;
} catch (e) {
    console.warn("X-Ray SDK not loaded for secrets.mjs:", e.message);
    AWSXRay = null;
}

// Caches for different secret types
let supabaseSecretsCache = {};
let openaiSecretsCache = {};

/**
 * Initializes the Secrets Manager client if it hasn't been already.
 */
function initializeSecretsClient() {
    if (!secretsClient) {
        secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
        if (AWSXRay) {
            secretsClient = AWSXRay.captureAWSv3Client(secretsClient);
        }
    }
}

/**
 * Fetches a secret from AWS Secrets Manager by its environment variable name.
 * Caches the result for subsequent calls within the same Lambda invocation.
 * @param {string} secretEnvVarName - The name of the environment variable that holds the Secrets Manager secret name (e.g., 'SUPABASE_SECRET_NAME').
 * @param {object} cache - The cache object to store the fetched secret.
 * @returns {Promise<object>} The parsed secret object.
 */
async function fetchAndCacheSecret(secretEnvVarName, cache) {
    if (Object.keys(cache).length > 0) {
        // console.log(`Using cached secrets for ${secretEnvVarName}.`);
        return cache;
    }

    const secretName = process.env[secretEnvVarName];
    if (!secretName) {
        throw new Error(`Environment variable ${secretEnvVarName} is not set.`);
    }

    initializeSecretsClient(); // Ensure client is initialized

    try {
        // console.log(`Fetching secrets from Secrets Manager: ${secretName}`);
        const command = new GetSecretValueCommand({ SecretId: secretName });
        const data = await secretsClient.send(command);

        if ('SecretString' in data) {
            // Merge fetched secrets into the provided cache object
            Object.assign(cache, JSON.parse(data.SecretString));
            return cache;
        } else {
            // Handle binary secrets if needed, but for now we expect SecretString
            throw new Error(`Secret '${secretName}' does not contain SecretString.`);
        }
    } catch (error) {
        console.error(`Error fetching secret '${secretName}':`, error);
        throw error;
    }
}

/**
 * Retrieves Supabase secrets from Secrets Manager.
 * @returns {Promise<object>} An object containing Supabase URL and Service Role Key.
 */
export async function getSupabaseSecrets() {
    return fetchAndCacheSecret('SUPABASE_SECRET_NAME', supabaseSecretsCache);
}

/**
 * Retrieves OpenAI secrets from Secrets Manager.
 * @returns {Promise<object>} An object containing OpenAI API Key and Org ID.
 */
export async function getOpenAISecrets() {
    return fetchAndCacheSecret('OPENAI_SECRET_NAME', openaiSecretsCache);
}