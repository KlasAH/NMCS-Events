
import { createClient } from '@supabase/supabase-js';

// Access environment variables safely for Vite
const getEnvVar = (key: string) => {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            let value = import.meta.env[key] || '';
            // CRITICAL FIX: Docker/Coolify sometimes injects quotes or whitespace.
            // We must strip start/end quotes and trim whitespace.
            if (typeof value === 'string') {
                value = value.replace(/^['"]|['"]$/g, '').trim();
            }
            return value;
        }
    } catch (e) {
        console.warn('Error reading environment variables:', e);
    }
    return '';
};

// CRITICAL FOR COOLIFY/DOCKER:
// Vite ignores variables that do not start with VITE_.
// We must explicitly look for VITE_SUPABASE_URL.
let supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_KEY');

// SAFETY: Remove trailing slash if user added it in Coolify
if (supabaseUrl && supabaseUrl.endsWith('/')) {
    supabaseUrl = supabaseUrl.slice(0, -1);
}

// Debugging for Coolify/Docker deployments
const isMissingKeys = !supabaseUrl || !supabaseAnonKey;

if (isMissingKeys) {
    console.warn(
        '%c[NMCS Warning] Supabase keys are missing!', 
        'color: orange; font-weight: bold; font-size: 14px; background: #333; padding: 4px;'
    );
    console.warn(
        'TROUBLESHOOTING FOR COOLIFY/DOCKER:\n' +
        '1. "Invisible Variable Bug": Vite ignores env vars unless they start with "VITE_".\n' +
        '   - Rename SUPABASE_URL -> VITE_SUPABASE_URL\n' +
        '   - Rename SUPABASE_KEY -> VITE_SUPABASE_ANON_KEY\n' +
        '2. "Build Time Injection": In Docker, you might need to redeploy after setting vars.\n'
    );
}

// Fallback for Demo Mode if keys are missing
// We detect "placeholder" which is sometimes set by default in templates
export const isDemoMode = isMissingKeys || supabaseUrl.includes('placeholder');

export const finalUrl = isDemoMode ? 'https://placeholder.supabase.co' : supabaseUrl;
export const finalKey = isDemoMode ? 'placeholder' : supabaseAnonKey;

// Create client with specific configuration for connection stability
export const supabase = createClient(finalUrl, finalKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    // Retry configuration for flaky connections (Cold Starts)
    global: {
        fetch: (url, options) => {
            // Use AbortController for broader compatibility than AbortSignal.timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            return fetch(url, {
                ...options,
                signal: controller.signal
            }).then(response => {
                clearTimeout(timeoutId);
                return response;
            }).catch(err => {
                clearTimeout(timeoutId);
                console.error("Supabase Fetch Error:", err);
                throw err;
            });
        }
    }
});

// Storage Bucket Configuration
export const STORAGE_BUCKET = 'nmcs-assets';

/**
 * Generates a public URL for a file in the 'nmcs-assets' Supabase Storage bucket.
 * 
 * @param path - The file path (e.g., 'logos/my-logo.png' or 'models/r53.png')
 * @returns The full public URL
 */
export const getAssetUrl = (path: string) => {
    if (!path) return '';
    // Return immediately if it's already an external link, blob, or data URI
    if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
    
    // Check if it's already a full Supabase URL (edge case)
    if (path.includes(finalUrl)) return path;

    // Remove leading slash if present to ensure correct pathing
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(cleanPath);
    return data.publicUrl;
};
