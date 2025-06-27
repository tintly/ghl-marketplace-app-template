# GoHighLevel Data Extractor

A React application for extracting conversation data from GoHighLevel using Supabase Edge Functions.

## Architecture

- **Frontend**: React app built with Vite
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Deployment**: Netlify (frontend) + Supabase (backend functions)
- **Authentication**: GoHighLevel SSO integration

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Set up environment variables in Supabase:
   - Go to Settings > Edge Functions
   - Add environment variable: `GHL_APP_SHARED_SECRET` (your GoHighLevel app shared secret)

### 2. Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy edge functions
supabase functions deploy auth-user-context
supabase functions deploy auth-verify-location
```

### 3. Frontend Setup

1. Copy `ui/.env.example` to `ui/.env.local`
2. Fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Local Development

```bash
# Start the development server
npm run dev
```

### 5. Deploy to Netlify

1. Connect your repository to Netlify
2. Set build settings:
   - Build command: `npm run build`
   - Publish directory: `ui/dist`
3. Add environment variables in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

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

## GoHighLevel Integration

This app integrates with GoHighLevel through:

1. **SSO Authentication**: Uses GHL's iframe SSO to get encrypted user data
2. **API Access**: Exchanges authorization codes for access tokens
3. **Data Extraction**: Processes conversation data based on configured rules

## Environment Variables

### Supabase Edge Functions
- `GHL_APP_SHARED_SECRET`: Your GoHighLevel app's shared secret for SSO decryption

### Frontend (Netlify)
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Database Schema

The app uses the provided database schema with tables for:
- User profiles and authentication
- GHL configurations and integrations
- Data extraction field definitions
- Contextual rules and triggers
- Location user management

## License

This project is licensed under the MIT License.