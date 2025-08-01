// Path: secrets.mjs

import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

// These global variables will cache the secrets after the first fetch (on a cold start)
let SUPABASE_PROJECT_URL;
let SUPABASE_SERVICE_ROLE_SECRET;

// These environment variables tell the function WHERE to find the secret, not what the secret is.
const SECRET_NAME = process.env.SECRET_NAME || "SUPABASE_DATA_EXTRACTOR"; // Ensure this matches your secret name
const AWS_REGION = process.env.AWS_REGION_SELECT || "us-east-2";

const secretsClient = new SecretsManagerClient({
  region: AWS_REGION,
});

/**
 * Fetches secrets from AWS Secrets Manager and loads them into memory.
 * This function is designed to run only once per container lifetime (on a cold start).
 */
export async function loadSecrets() {
  // If secrets are already loaded (on a warm start), do nothing.
  if (SUPABASE_PROJECT_URL && SUPABASE_SERVICE_ROLE_SECRET) {
    console.log("Secrets are already loaded in memory.");
    return;
  }

  console.log(`Fetching secrets from Secrets Manager: ${SECRET_NAME} in ${AWS_REGION}`);
  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: SECRET_NAME,
        VersionStage: "AWSCURRENT", // Default, but good to be explicit
      })
    );

    const secretString = response.SecretString;
    if (secretString) {
      const secrets = JSON.parse(secretString);
      // IMPORTANT: The keys here must match the keys in your AWS Secret
      SUPABASE_PROJECT_URL = secrets.SUPABASE_PROJECT_URL;
      SUPABASE_SERVICE_ROLE_SECRET = secrets.SUPABASE_SERVICE_ROLE_SECRET;
      console.log("Supabase secrets loaded and cached successfully.");
    } else {
      throw new Error("SecretString from Secrets Manager is empty.");
    }
  } catch (error) {
    console.error("Fatal error: Could not fetch secrets from AWS Secrets Manager.", error);
    throw error; // Re-throw to halt execution if secrets are unavailable
  }
}

/**
 * Synchronously returns the loaded Supabase secrets.
 * Throws an error if loadSecrets() has not been successfully called first.
 * @returns {Object} An object containing Supabase secrets.
 */
export function getAppSecrets() {
  if (!SUPABASE_PROJECT_URL || !SUPABASE_SERVICE_ROLE_SECRET) {
    throw new Error("Supabase secrets have not been loaded. Ensure loadSecrets() is called before this function.");
  }
  return {
    SUPABASE_PROJECT_URL,
    SUPABASE_SERVICE_ROLE_SECRET
  };
}