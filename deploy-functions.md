# Edge Function Deployment Guide

## Current Issue
Your edge functions exist in the code but are returning "NOT_FOUND" errors because they're not properly deployed to Supabase.

## Solution Steps

### 1. Check Supabase CLI Installation
```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Check if CLI is installed
supabase --version
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link Your Project
```bash
supabase link --project-ref zjgwpgllznqhexyadozz
```

### 4. Deploy Edge Functions
```bash
# Deploy all functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy debug-ghl-token
```

### 5. Verify Deployment
Run the test script:
```bash
node test-edge-function.js
```

## Alternative: Manual Deployment via Supabase Dashboard

1. Go to your Supabase dashboard
2. Navigate to Edge Functions
3. Create new function named `debug-ghl-token`
4. Copy the code from `supabase/functions/debug-ghl-token/index.ts`
5. Deploy the function

## Environment Variables

Make sure these are set in your Supabase project:
- `GHL_APP_SHARED_SECRET`
- `GHL_MARKETPLACE_CLIENT_ID`
- `GHL_MARKETPLACE_CLIENT_SECRET`
- `GHL_API_DOMAIN`
- `JWT_SECRET`

## Troubleshooting

If functions still don't work:
1. Check Supabase project logs
2. Verify environment variables are set
3. Check function permissions
4. Try redeploying with `--no-verify-jwt` flag