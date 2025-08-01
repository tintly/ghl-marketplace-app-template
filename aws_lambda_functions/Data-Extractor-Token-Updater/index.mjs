import https from 'https';
import { URL } from 'url'; // Import URL for parsing hostname

export const handler = async (event) => {
    const supabaseUrl = process.env.SUPABASE_URL; // e.g., https://your-project-ref.supabase.co
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Your Supabase anon key

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
        throw new Error('Missing environment variables.');
    }

    const options = {
        hostname: new URL(supabaseUrl).hostname,
        path: '/functions/v1/refresh-tokens',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log('Edge Function response:', data);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve({
                            statusCode: res.statusCode,
                            body: JSON.parse(data)
                        });
                    } catch (parseError) {
                        console.error('Failed to parse JSON response:', parseError);
                        reject(new Error(`Failed to parse JSON response: ${data}`));
                    }
                } else {
                    reject(new Error(`Edge Function returned status code ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error calling Edge Function:', error);
            reject(error);
        });

        req.end();
    });
};
