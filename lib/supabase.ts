
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
}

// Fallback for Demo Mode if keys are missing
// We detect "placeholder" which is sometimes set by default in templates
export const isDemoMode = isMissingKeys || supabaseUrl.includes('placeholder');

export const finalUrl = isDemoMode ? 'https://placeholder.supabase.co' : supabaseUrl;
export const finalKey = isDemoMode ? 'placeholder' : supabaseAnonKey;

// Create client with standard configuration
// Removed custom fetch wrapper to avoid hanging request issues
export const supabase = createClient(finalUrl, finalKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
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
