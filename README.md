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

### 3. Update Environment Variables
Update the following files with your Supabase credentials:
- `ui/.env.local` (for local development)
- `ui/.env.production` (for production deployment)

Replace:
- `https://your-project-ref.supabase.co` with your actual Supabase URL
- `your-anon-key-here` with your actual anon key

### 4. Deploy Edge Functions
The following edge functions need to be deployed to Supabase:
- `auth-user-context` - Handles SSO authentication
- `auth-verify-location` - Verifies location access

### 5. Set Environment Variables in Netlify
In your Netlify dashboard, add these environment variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

## Architecture

- **Frontend**: React app built with Vite
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Deployment**: Netlify (frontend) + Supabase (backend functions)
- **Authentication**: GoHighLevel SSO integration

## Database Schema

The app uses the provided database schema with tables for:
- User profiles and authentication
- GHL configurations and integrations
- Data extraction field definitions
- Contextual rules and triggers
- Location user management

## GoHighLevel Integration

This app integrates with GoHighLevel through:

1. **SSO Authentication**: Uses GHL's iframe SSO to get encrypted user data
2. **API Access**: Exchanges authorization codes for access tokens
3. **Data Extraction**: Processes conversation data based on configured rules

## Environment Variables

### Frontend (Netlify)
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Supabase Edge Functions
- `GHL_APP_SHARED_SECRET`: Your GoHighLevel app's shared secret for SSO decryption

## Project Structure

```
├── ui/                          # React frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── services/          # API services
│   │   └── ...
│   └── dist/                  # Built frontend (generated)
├── supabase/
│   └── functions/             # Edge functions
│       ├── auth-user-context/ # SSO authentication
│       └── auth-verify-location/ # Location access verification
└── netlify.toml              # Netlify configuration
```

## Development

```bash
# Start the development server
npm run dev
```

## Deployment

The app is configured to deploy automatically to Netlify. Make sure to set the required environment variables in your Netlify dashboard.

## License

This project is licensed under the MIT License.