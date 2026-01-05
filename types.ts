export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Meeting {
  id: string;
  created_at: string;
  title: string;
  date: string;
  location_name: string;
  description: string;
  cover_image_url: string;
  maps_url?: string;
  is_pinned?: boolean; // New field for pinning events
  custom_data?: Record<string, string | number | boolean>; // JSONB column
}

export interface ItineraryItem {
  id: string;
  meeting_id: string;
  start_time: string;
  title: string;
  description?: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'board';
}