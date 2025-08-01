import {
    SecretsManagerClient,
    GetSecretValueCommand,
  } from '@aws-sdk/client-secrets-manager'
  import {
    LambdaClient,
    InvokeCommand,
  } from '@aws-sdk/client-lambda'
  
  // --- AWS X-Ray Integration ---
  export let AWSXRay
  try {
    const AWSXRayModule = await import('aws-xray-sdk-core')
    AWSXRay = AWSXRayModule.default || AWSXRayModule
    console.log('AWS X-Ray SDK loaded successfully')
  } catch (e) {
    console.warn(
      'AWS X-Ray SDK not loaded. Tracing disabled. Error:',
      e.message
    )
    AWSXRay = null
  }
  
  // --- AWS Environment Variables and Client Initialization ---
  export const SECRET_NAME = process.env.SECRET_NAME || "SUPABASE_DATA_EXTRACTOR";
  export const AWS_REGION = process.env.AWS_REGION || "us-east-2";
  
  export const AI_EXTRACTION_LAMBDA_ARN = process.env.AI_EXTRACTION_LAMBDA_ARN;
  export const CALL_PROCESSING_LAMBDA_ARN = process.env.CALL_PROCESSING_LAMBDA_ARN;
  export const EMAIL_PROCESSING_LAMBDA_ARN = process.env.EMAIL_PROCESSING_LAMBDA_ARN;
  
  let secretsClient = new SecretsManagerClient({ region: AWS_REGION });
  let lambdaClient = new LambdaClient({ region: AWS_REGION });
  
  if (AWSXRay) {
      secretsClient = AWSXRay.captureAWSv3Client(secretsClient);
      lambdaClient = AWSXRay.captureAWSv3Client(lambdaClient);
      console.log("AWS SDK clients instrumented for X-Ray.");
  }
  
  export { secretsClient, lambdaClient };
  
  /**
   * Function to fetch secrets from AWS Secrets Manager.
   * @returns {Promise<{SUPABASE_PROJECT_URL: string, SUPABASE_ANON_PUBLIC: string, SUPABASE_SERVICE_ROLE_SECRET: string}>}
   * @throws {Error} if secrets cannot be fetched or parsed.
   */
  export async function loadSecrets() {
    console.log(`Fetching secrets from Secrets Manager: ${SECRET_NAME} in ${AWS_REGION}`);
    try {
      const response = await secretsClient.send(
        new GetSecretValueCommand({
          SecretId: SECRET_NAME,
          VersionStage: "AWSCURRENT",
        })
      );
  
      const secretString = response.SecretString;
      if (secretString) {
        const secrets = JSON.parse(secretString);
        console.log("Supabase secrets loaded successfully.");
        return {
            SUPABASE_PROJECT_URL: secrets.SUPABASE_PROJECT_URL,
            SUPABASE_ANON_PUBLIC: secrets.SUPABASE_ANON_PUBLIC,
            SUPABASE_SERVICE_ROLE_SECRET: secrets.SUPABASE_SERVICE_ROLE_SECRET,
        };
      } else {
        throw new Error("SecretString is empty or null.");
      }
    } catch (error) {
      console.error("Error fetching secrets:", error);
      throw error;
    }
  }
  
  /**
   * Invokes a downstream Lambda function asynchronously.
   * @param {string} functionArn - The ARN of the Lambda function to invoke.
   * @param {object} payload - The payload to send to the invoked function.
   * @param {object} [parentSegment] - The X-Ray parent segment for tracing (optional).
   */
  export async function invokeDownstreamLambda(functionArn, payload, parentSegment) {
      if (!functionArn) {
          console.log("No ARN provided for downstream Lambda invocation. Skipping.");
          return;
      }
  
      if (AWSXRay && parentSegment) {
          await AWSXRay.captureAsyncFunc('InvokeDownstreamLambda', async (subsegment) => {
              try {
                  subsegment.addAnnotation('InvokedFunctionArn', functionArn);
                  subsegment.addAnnotation('InvocationType', 'Event');
                  subsegment.addMetadata('Payload', payload);
  
                  const command = new InvokeCommand({
                      FunctionName: functionArn,
                      InvocationType: 'Event',
                      Payload: JSON.stringify(payload),
                  });
                  await lambdaClient.send(command);
                  console.log(`Successfully invoked downstream Lambda: ${functionArn}`);
              } catch (error) {
                  console.error(`Error invoking downstream Lambda ${functionArn}:`, error);
                  subsegment.addError(error);
              } finally {
                  subsegment.close();
              }
          }, parentSegment);
      } else {
          try {
              const command = new InvokeCommand({
                  FunctionName: functionArn,
                  InvocationType: 'Event',
                  Payload: JSON.stringify(payload),
              });
              await lambdaClient.send(command);
              console.log(`Successfully invoked downstream Lambda: ${functionArn}`);
          } catch (error) {
              console.error(`Error invoking downstream Lambda ${functionArn}:`, error);
          }
      }
  }