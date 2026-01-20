
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface LinkItem {
  label: string;
  url: string;
}

export interface ContactPerson {
  name: string;
  email?: string;
  phone?: string;
}

export interface HotelDetails {
  id?: string; // Support for multiple
  name: string;
  address: string;
  map_url: string;
  website_url?: string; // Replaces prices
  description: string;
  booking_links?: LinkItem[];
  image_url?: string;
  contact?: ContactPerson; 
}

export interface ParkingDetails {
  id?: string; // Support for multiple
  location: string;
  cost: string;
  security_info: string;
  map_url?: string;
  apps?: LinkItem[]; // EasyPark, Parkster etc
  image_url?: string;
}

export interface MapConfig {
  groupName?: string;
  label: string;
  url: string;
}

export interface ExtraInfoSection {
  id: string;
  type: 'food' | 'racing' | 'roadtrip' | 'general';
  title: string;
  icon: 'utensils' | 'flag' | 'info' | 'map' | 'car'; 
  content: string;
  links?: LinkItem[];
  image_url?: string;
  address?: string;
  website_url?: string;
  track_map_image_url?: string; // New for Track Day
  rules_content?: string; // New for Track Day
}

export interface Meeting {
  id: string;
  created_at: string;
  title: string;
  date: string;
  end_date?: string;
  location_name: string;
  description: string;
  cover_image_url: string;
  pdf_url?: string;
  maps_config?: MapConfig[]; 
  is_pinned?: boolean;
  status?: 'draft' | 'published'; // Added status
  // Updated to allow arrays or legacy single object
  hotel_info?: HotelDetails | HotelDetails[]; 
  parking_info?: ParkingDetails | ParkingDetails[];
  extra_info?: ExtraInfoSection[];
  custom_data?: Record<string, string | number | boolean>;
  
  // NEW: Photos
  google_photos_url?: string;
  gallery_images?: string[]; // Array of public URLs
}

export interface ItineraryItem {
  id: string;
  meeting_id: string;
  date: string;
  start_time: string;
  title: string;
  description?: string;
  location_details?: string;
  location_map_url?: string;
  created_at?: string;
  sort_order?: number;
  type?: 'activity' | 'food' | 'travel' | 'other'; // Added type
}

export interface Registration {
  id: string;
  meeting_id: string;
  user_id?: string;
  full_name: string;
  forum_name: string;
  email: string;
  phone: string;
  car_type?: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  registered_at: string;
}

export interface Transaction {
  id: string;
  meeting_id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  role: 'admin' | 'user' | 'board';
  board_role?: string | null; // Changed to string | null to match Supabase TEXT column
  car_model?: string;
  full_name?: string;
}
