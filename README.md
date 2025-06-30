# GoHighLevel Data Extractor

A React application for extracting conversation data from GoHighLevel using Supabase Edge Functions.

## Quick Setup Guide

### 1. Connect to Supabase
Click the "Connect to Supabase" button in the top right of bolt.new to set up your Supabase project.

### 2. Get Your Supabase Credentials
After connecting to Supabase:
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy your Project URL and anon/public key

### 3. Set Required Environment Variables

#### In Supabase (for Edge Functions):
Go to your Supabase project dashboard → Settings → Edge Functions → Environment Variables and add:

- `GHL_APP_SHARED_SECRET`: Your GoHighLevel app's shared secret for SSO decryption
- `GHL_MARKETPLACE_CLIENT_ID`: Your GHL marketplace app client ID  
- `GHL_MARKETPLACE_CLIENT_SECRET`: Your GHL marketplace app client secret
- `GHL_API_DOMAIN`: `https://services.leadconnectorhq.com`
- `JWT_SECRET`: Your Supabase JWT secret (found in Settings → API → JWT Secret)

#### In Netlify (for frontend):
In your Netlify dashboard, add these environment variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
- `VITE_GHL_MARKETPLACE_CLIENT_ID`: Your GHL marketplace app client ID

### 4. Deploy Edge Functions
The following edge functions are automatically deployed with your Supabase project:
- `auth-user-context` - Handles SSO authentication and JWT generation
- `auth-verify-location` - Verifies location access
- `oauth-exchange` - Handles OAuth token exchange

### 5. Important: JWT Authentication Setup

This application uses a custom JWT authentication system to bridge GoHighLevel SSO with Supabase RLS:

1. **GHL SSO**: User authenticates via GoHighLevel's iframe SSO
2. **JWT Generation**: Our Edge Function generates a Supabase-compatible JWT with GHL user data
3. **RLS Enforcement**: Supabase uses the JWT to enforce Row Level Security policies

**Critical**: Make sure `JWT_SECRET` is set in your Supabase Edge Functions environment. This should be the same secret used to sign your Supabase JWTs (found in Settings → API → JWT Secret).

### 6. Database Schema

The app uses the provided database schema with tables for:
- User profiles and authentication
- GHL configurations and integrations
- Data extraction field definitions
- Contextual rules and triggers
- Location user management

All tables have Row Level Security (RLS) enabled with JWT-based policies that use the GHL user ID from the JWT claims.

## Architecture

- **Frontend**: React app built with Vite
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Deployment**: Netlify (frontend) + Supabase (backend functions)
- **Authentication**: GoHighLevel SSO → Custom JWT → Supabase RLS

## GoHighLevel Integration

This app integrates with GoHighLevel through:

1. **SSO Authentication**: Uses GHL's iframe SSO to get encrypted user data
2. **JWT Bridge**: Converts GHL user identity to Supabase JWT for RLS
3. **OAuth Installation**: Exchanges authorization codes for access tokens
4. **Data Extraction**: Processes conversation data based on configured rules

## Environment Variables

### Frontend (Netlify)
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_GHL_MARKETPLACE_CLIENT_ID`: Your GHL marketplace client ID

### Supabase Edge Functions
- `GHL_APP_SHARED_SECRET`: Your GoHighLevel app's shared secret for SSO decryption
- `GHL_MARKETPLACE_CLIENT_ID`: Your GHL marketplace app client ID
- `GHL_MARKETPLACE_CLIENT_SECRET`: Your GHL marketplace app client secret
- `GHL_API_DOMAIN`: GoHighLevel API domain (usually `https://services.leadconnectorhq.com`)
- `JWT_SECRET`: Your Supabase JWT secret for signing custom JWTs

## Project Structure

```
├── src/                          # React frontend
│   ├── components/              # React components
│   ├── services/               # API services
│   └── ...
├── supabase/
│   ├── functions/              # Edge functions
│   │   ├── auth-user-context/  # SSO authentication & JWT generation
│   │   ├── auth-verify-location/ # Location access verification
│   │   └── oauth-exchange/     # OAuth token exchange
│   └── migrations/             # Database migrations
└── netlify.toml               # Netlify configuration
```

## Development

```bash
# Start the development server
npm run dev
```

## Deployment

The app is configured to deploy automatically to Netlify. Make sure to set the required environment variables in both Netlify and Supabase dashboards.

## Troubleshooting

### JWT Authentication Issues
- Ensure `JWT_SECRET` is set in Supabase Edge Functions environment
- Check that the JWT secret matches your Supabase project's JWT secret
- Verify that RLS policies are using the correct JWT claim functions

### RLS Policy Issues
- Check that `is_ghl_user_authenticated()` returns true
- Verify `get_ghl_user_id()` returns the correct user ID from JWT claims
- Ensure database functions are created and working properly

## License

This project is licensed under the MIT License.