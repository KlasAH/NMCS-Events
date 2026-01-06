
import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env;

const supabaseUrl = env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper for demo purposes if no connection
export const isDemoMode = !env?.VITE_SUPABASE_URL;

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
    if (path.includes(supabaseUrl)) return path;

    // Remove leading slash if present to ensure correct pathing
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(cleanPath);
    return data.publicUrl;
};
