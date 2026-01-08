
import { createClient } from '@supabase/supabase-js';

// Access environment variables safely for Vite
const getEnvVar = (key: string) => {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            return import.meta.env[key] || '';
        }
    } catch (e) {
        console.warn('Error reading environment variables:', e);
    }
    return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_KEY');

// Debugging for Coolify/Docker deployments
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '%c[NMCS Warning] Supabase keys are missing!', 
        'color: orange; font-weight: bold; font-size: 12px;'
    );
    console.warn(
        'If you are running in Coolify/Docker, ensure your Environment Variables start with "VITE_".\n' +
        'Example: SUPABASE_URL -> VITE_SUPABASE_URL'
    );
}

// Fallback for Demo Mode if keys are missing
export const isDemoMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder');

const finalUrl = isDemoMode ? 'https://placeholder.supabase.co' : supabaseUrl;
const finalKey = isDemoMode ? 'placeholder' : supabaseAnonKey;

export const supabase = createClient(finalUrl, finalKey);

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
