// secrets.mjs
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let secretsCache = {};
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

export async function getSecrets() {
    if (Object.keys(secretsCache).length > 0) {
        // console.log("Using cached secrets.");
        return secretsCache;
    }

    const secretName = process.env.SECRET_NAME;
    if (!secretName) {
        throw new Error("Environment variable SECRET_NAME is not set.");
    }

    if (!secretsClient) {
        secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
        if (AWSXRay) {
            secretsClient = AWSXRay.captureAWSv3Client(secretsClient);
        }
    }

    try {
        // console.log(`Fetching secrets from Secrets Manager: ${secretName}`);
        const command = new GetSecretValueCommand({ SecretId: secretName });
        const data = await secretsClient.send(command);

        if ('SecretString' in data) {
            secretsCache = JSON.parse(data.SecretString);
            return secretsCache;
        } else {
            // Handle binary secrets if needed, but for now we expect SecretString
            throw new Error("Secret does not contain SecretString.");
        }
    } catch (error) {
        console.error("Error fetching secrets:", error);
        throw error;
    }
}