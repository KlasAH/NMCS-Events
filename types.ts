
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

export interface HotelDetails {
  name: string;
  address: string;
  map_url: string;
  price_single: string;
  price_double: string;
  description: string;
  booking_links?: LinkItem[];
  image_url?: string; // New: Small card image
}

export interface ParkingDetails {
  location: string;
  cost: string;
  security_info: string;
  map_url?: string;
  apps?: LinkItem[];
  image_url?: string; // New: Small card image
}

export interface MapConfig {
  groupName?: string;
  label: string;
  url: string;
}

export interface ExtraInfoSection {
  id: string;
  type: 'food' | 'racing' | 'roadtrip' | 'general'; // New: To distinguish types
  title: string;
  icon: 'utensils' | 'flag' | 'info' | 'map' | 'car'; 
  content: string;
  links?: LinkItem[];
  image_url?: string; // New
  address?: string;   // New (specifically for Racing/Venues)
  website_url?: string; // New (specifically for Racing homepage)
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
  maps_config?: MapConfig[]; 
  is_pinned?: boolean;
  hotel_info?: HotelDetails;
  parking_info?: ParkingDetails;
  extra_info?: ExtraInfoSection[];
  custom_data?: Record<string, string | number | boolean>;
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
  role: 'admin' | 'user' | 'board';
  car_model?: string; // New: Selected model preference
}
