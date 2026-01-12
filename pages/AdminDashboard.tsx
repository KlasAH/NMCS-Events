
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Plus, DollarSign, Users, Settings, Star, Save, Search, Edit3, ArrowLeft, Lock, CheckCircle, Mail, UserCog, X, Trash2, RefreshCw, MapPin, Building2, Car, Utensils, Flag, Map, Upload, Clock, Calendar, Link as LinkIcon, Smartphone, ExternalLink, Globe, Eye, QrCode, TrendingUp, TrendingDown, Wallet, ToggleLeft, ToggleRight, UserPlus, AlertTriangle, Image, List, TestTube, Check, Share, Info, Palette, ImageIcon, Download, Circle, Square, GripVertical, ArrowUpDown, ListOrdered, Camera } from 'lucide-react';
import { Registration, Transaction, Meeting, ExtraInfoSection, HotelDetails, ParkingDetails, ItineraryItem, MapConfig, LinkItem } from '../types';
import { supabase, isDemoMode, finalUrl, finalKey, STORAGE_BUCKET } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import Modal from '../components/Modal';
import QRCode from 'react-qr-code';
import QrCodeStudio from '../components/QrCodeStudio';

const MASTER_ADMIN_EMAIL = 'klas.ahlman@gmail.com';

// Switch Component for Settings
const ToggleSwitch = ({ label, description, checked, onChange, icon: Icon }: { label: string, description: string, checked: boolean, onChange: () => void, icon: any }) => (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${checked ? 'bg-mini-red/10 text-mini-red' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                <Icon size={24} />
            </div>
            <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base">{label}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px] sm:max-w-xs">{description}</p>
            </div>
        </div>
        <button 
            onClick={onChange}
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out ${checked ? 'bg-mini-red' : 'bg-slate-300 dark:bg-slate-600'}`}
        >
            <motion.div 
                className="bg-white w-6 h-6 rounded-full shadow-md"
                layout
                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                animate={{ x: checked ? 24 : 0 }}
            />
        </button>
    </div>
);

// Dragable Itinerary Item
interface ItineraryEditorItemProps {
    item: ItineraryItem;
    updateItineraryItem: (id: string, field: keyof ItineraryItem, value: any) => void;
    removeItineraryItem: (id: string) => void;
}

const ItineraryEditorItem = ({ item, updateItineraryItem, removeItineraryItem }: ItineraryEditorItemProps) => {
    const dragControls = useDragControls();

    return (
        <Reorder.Item 
            value={item} 
            id={item.id} 
            dragListener={false} 
            dragControls={dragControls}
            className="flex gap-4 items-start border border-slate-200 dark:border-slate-700 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 mb-4 select-none relative group"
        >
             {/* Drag Handle */}
             <div 
                onPointerDown={(e) => dragControls.start(e)} 
                className="mt-8 cursor-grab text-slate-400 hover:text-slate-600 touch-none active:cursor-grabbing"
             >
                 <GripVertical size={24} />
             </div>

             {/* Type Selector (Small vertical strip/icon) */}
             <div className="flex flex-col gap-2 mt-8">
                 <button 
                    onClick={() => updateItineraryItem(item.id, 'type', 'activity')} 
                    className={`p-1 rounded ${item.type === 'activity' || !item.type ? 'text-mini-red bg-red-100' : 'text-slate-300 hover:text-slate-500'}`} title="Activity"><Clock size={16}/></button>
                 <button 
                    onClick={() => updateItineraryItem(item.id, 'type', 'food')}
                    className={`p-1 rounded ${item.type === 'food' ? 'text-orange-600 bg-orange-100' : 'text-slate-300 hover:text-slate-500'}`} title="Food"><Utensils size={16}/></button>
                 <button 
                    onClick={() => updateItineraryItem(item.id, 'type', 'travel')}
                    className={`p-1 rounded ${item.type === 'travel' ? 'text-blue-600 bg-blue-100' : 'text-slate-300 hover:text-slate-500'}`} title="Travel"><Car size={16}/></button>
                 <button 
                    onClick={() => updateItineraryItem(item.id, 'type', 'other')}
                    className={`p-1 rounded ${item.type === 'other' ? 'text-slate-600 bg-slate-200' : 'text-slate-300 hover:text-slate-500'}`} title="Other"><Info size={16}/></button>
             </div>

             <div className="flex flex-col gap-2 w-32 shrink-0">
                <label className="text-[10px] font-bold uppercase text-slate-500">Time</label>
                {/* STYLED TIME INPUT */}
                <div className="relative">
                    <input 
                        type="time" 
                        value={item.start_time} 
                        onChange={e => updateItineraryItem(item.id, 'start_time', e.target.value)} 
                        className="w-full pl-9 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium outline-none focus:ring-1 focus:ring-mini-red" 
                    />
                    <Clock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <label className="text-[10px] font-bold uppercase text-slate-500 mt-1">Date</label>
                {/* STYLED DATE INPUT */}
                <div className="relative">
                    <input 
                        type="date" 
                        value={item.date} 
                        onChange={e => updateItineraryItem(item.id, 'date', e.target.value)} 
                        className="w-full pl-9 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium outline-none focus:ring-1 focus:ring-mini-red" 
                    />
                    <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
             </div>
             <div className="flex-grow space-y-2">
                 <input value={item.title} onChange={e => updateItineraryItem(item.id, 'title', e.target.value)} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" placeholder="Title" />
                 <input value={item.description} onChange={e => updateItineraryItem(item.id, 'description', e.target.value)} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" placeholder="Short Description" />
                 <textarea value={item.location_details || ''} onChange={e => updateItineraryItem(item.id, 'location_details', e.target.value)} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" placeholder="Detailed Instructions (Optional)" rows={2} />
                 {/* Map URL for item */}
                 <div className="relative">
                    <input 
                        value={item.location_map_url || ''} 
                        onChange={e => updateItineraryItem(item.id, 'location_map_url', e.target.value)} 
                        className="w-full pl-8 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs" 
                        placeholder="Google Maps URL (Optional)" 
                    />
                    <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                 </div>
             </div>
             <button onClick={() => removeItineraryItem(item.id)} className="text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 size={20}/></button>
        </Reorder.Item>
    );
};

const AdminDashboard: React.FC = () => {
  // 1. CONTEXT HOOKS
  const { isAdmin, loading, session, signOut, updatePassword, sendPasswordReset, authStatus, checkAdmin } = useAuth();
  const { t } = useLanguage();
  
  // 2. STATE HOOKS
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'finances' | 'settings' | 'qr-tools'>('overview');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Data State
  const [events, setEvents] = useState<Meeting[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Finances State
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Partial<Transaction>>({
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      description: '',
      category: ''
  });

  // Settings State
  const [appSettings, setAppSettings] = useState({
      auto_logout_hours: '8',
      public_registration: 'true',
      maintenance_mode: 'false',
      allow_member_uploads: 'false',
      enable_waitlist: 'true',
      beta_features: 'false'
  });
  const [settingsStatus, setSettingsStatus] = useState('');

  // Editing State (Events)
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editorTab, setEditorTab] = useState<'general' | 'itinerary' | 'hotels' | 'parking' | 'maps' | 'trackday' | 'photos' | 'preview'>('general');
  const [editingEventData, setEditingEventData] = useState<Partial<Meeting>>({});
  const [editingItinerary, setEditingItinerary] = useState<ItineraryItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  
  // Parking App Custom Input State
  const [customAppName, setCustomAppName] = useState('');

  // QR Studio - Auto Load Url
  const [studioUrl, setStudioUrl] = useState('');

  // 3. MEMO HOOKS (Must be before any return)
  const financialStats = useMemo(() => {
      const income = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const expense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      return { income, expense, net: income - expense };
  }, [transactions]);
  
  // Group items by date for Drag and Drop
  const groupedItinerary = useMemo(() => {
    const groups: {[key: string]: ItineraryItem[]} = {};
    // Ensure we sort by existing sort_order first to maintain state stability
    const sorted = [...editingItinerary].sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0) || a.start_time.localeCompare(b.start_time));
    
    sorted.forEach(item => {
        if(!groups[item.date]) groups[item.date] = [];
        groups[item.date].push(item);
    });
    // Sort dates
    return Object.keys(groups).sort().map(date => ({ date, items: groups[date] }));
  }, [editingItinerary]);

  // 4. EFFECT HOOKS (Must be before any return)
  
  // Fetch Events (Overview)
  useEffect(() => {
    if (!isAdmin && !isDemoMode) return;

    const fetchEvents = async () => {
        if(isDemoMode) {
             setEvents([
                {id: '1', title: 'Alpine Grand Tour 2024 (Demo)', date: '2024-06-15', created_at: '', description: 'Description here', location_name: 'Swiss Alps', cover_image_url: '', status: 'draft'},
            ]);
            return;
        }
        const { data, error } = await supabase.from('meetings').select('*').order('date', {ascending: false});
        if(data) setEvents(data);
        if(error) console.error("Error fetching events:", error);
    };

    fetchEvents();
  }, [isAdmin]);

  // Fetch Details for Selected Event
  useEffect(() => {
      const fetchData = async () => {
          if (!selectedEventId) return;

          if (isDemoMode) return;

          if (activeTab === 'registrations') {
              const { data } = await supabase.from('registrations').select('*').eq('meeting_id', selectedEventId).order('registered_at', { ascending: false });
              if (data) setRegistrations(data);
          } 
          
          if (activeTab === 'finances') {
              const { data } = await supabase.from('transactions').select('*').eq('meeting_id', selectedEventId).order('date', { ascending: false });
              if (data) setTransactions(data);
          }
      };

      fetchData();
  }, [selectedEventId, activeTab, isAdmin]);

  // Fetch Settings (General)
  useEffect(() => {
    if (activeTab === 'settings' && !isDemoMode) {
        const fetchSettings = async () => {
            const { data } = await supabase.from('app_settings').select('*');
            if (data) {
                const newSettings = { ...appSettings };
                data.forEach(row => {
                    // @ts-ignore
                    if (newSettings[row.key] !== undefined) newSettings[row.key] = row.value;
                });
                setAppSettings(newSettings);
            }
        }
        fetchSettings();
    }
  }, [activeTab]);

  // --- STYLES (Refined to match Profile Page) ---
  const INPUT_STYLE = "w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mini-red transition-all placeholder:text-slate-400";
  const LABEL_STYLE = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";
  const BUTTON_STYLE = "px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2";

  // --- EARLY RETURNS ---
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-pulse text-slate-400">Loading...</div></div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) { return ( <div className="pt-32 text-center">Restricted Access</div> ); }

  const handleSaveTransaction = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedEventId) return;
      
      const payload = {
          ...editingTransaction,
          meeting_id: selectedEventId,
          amount: Number(editingTransaction.amount)
      };

      if (isDemoMode) {
          const newTx = { ...payload, id: `mock-${Date.now()}` } as Transaction;
          setTransactions(prev => [newTx, ...prev]);
          setShowTransactionModal(false);
          return;
      }

      if (editingTransaction.id) {
          // Update
          const { error } = await supabase.from('transactions').update(payload).eq('id', editingTransaction.id);
          if (!error) {
              setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? { ...t, ...payload } as Transaction : t));
          }
      } else {
          // Insert
          const { data, error } = await supabase.from('transactions').insert([payload]).select().single();
          if (!error && data) {
              setTransactions(prev => [data, ...prev]);
          }
      }
      setShowTransactionModal(false);
  }

  const handleDeleteTransaction = async (id: string) => {
      if(!confirm("Are you sure?")) return;
      
      if (isDemoMode) {
          setTransactions(prev => prev.filter(t => t.id !== id));
          return;
      }
      
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (!error) {
          setTransactions(prev => prev.filter(t => t.id !== id));
      }
  }

  const handleSaveSettings = async (specificKey?: string, specificValue?: string) => {
      if (isDemoMode) {
          setSettingsStatus('Saved (Demo)');
          setTimeout(() => setSettingsStatus(''), 2000);
          return;
      }
      
      const key = specificKey || 'auto_logout_hours';
      const value = specificValue || appSettings.auto_logout_hours;

      const { error } = await supabase.from('app_settings').upsert({
          key,
          value,
          updated_at: new Date().toISOString()
      });
      
      if(error) setSettingsStatus('Error: ' + error.message);
      else {
          setSettingsStatus('Saved!');
          setTimeout(() => setSettingsStatus(''), 2000);
      }
  }

  const handleToggleSetting = (key: keyof typeof appSettings) => {
      const currentVal = appSettings[key] === 'true';
      const newVal = String(!currentVal);
      
      setAppSettings(prev => ({ ...prev, [key]: newVal }));
      handleSaveSettings(key, newVal);
  };

  const startEditEvent = async (evt?: Meeting) => {
      setEditorTab('general');
      setSaveStatus('');
      setStudioUrl(''); // Reset QR Studio when opening editor
      if(evt) {
          const eventData = JSON.parse(JSON.stringify(evt));
          // Normalize arrays
          if (eventData.hotel_info && !Array.isArray(eventData.hotel_info)) eventData.hotel_info = [eventData.hotel_info];
          if (eventData.parking_info && !Array.isArray(eventData.parking_info)) eventData.parking_info = [eventData.parking_info];
          if (!eventData.extra_info) eventData.extra_info = [];
          if (!eventData.maps_config) eventData.maps_config = [];
          // Fix gallery if null
          if (!eventData.gallery_images) eventData.gallery_images = [];
          
          setEditingEventData(eventData);

          if (!isDemoMode) {
              const { data } = await supabase.from('itinerary_items').select('*').eq('meeting_id', evt.id).order('sort_order', {ascending: true}).order('start_time', {ascending: true});
              setEditingItinerary(data || []);
          } else {
              setEditingItinerary([]);
          }
      } else {
          setEditingEventData({
              title: '',
              date: new Date().toISOString().split('T')[0],
              description: '',
              location_name: '',
              cover_image_url: '',
              status: 'draft',
              maps_config: [], 
              hotel_info: [], 
              parking_info: [], 
              extra_info: [],
              gallery_images: []
          });
          setEditingItinerary([]);
      }
      setIsEditingEvent(true);
  }

  // --- IMAGE UPLOAD LOGIC ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const year = new Date().getFullYear();
    const eventSlug = editingEventData.title ? editingEventData.title.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'untitled';
    const path = `event/${year}/${eventSlug}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
    setUploadingImage(true);
    try {
        if (isDemoMode) { 
            setTimeout(() => {
                callback("https://picsum.photos/800/600"); 
                setUploadingImage(false);
            }, 1000);
            return; 
        }
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        callback(publicUrlData.publicUrl);
    } catch (err: any) { alert('Upload failed: ' + err.message); } 
    finally { setUploadingImage(false); }
  };

  // --- MULTI IMAGE UPLOAD FOR GALLERY ---
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const files = Array.from(e.target.files);
      setUploadingImage(true);
      
      const year = new Date().getFullYear();
      const eventSlug = editingEventData.title ? editingEventData.title.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'untitled';
      
      const uploadPromises = files.map(async (file) => {
          const path = `event/${year}/${eventSlug}/gallery/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
          if (isDemoMode) return "https://picsum.photos/400/300?random=" + Math.random();
          
          const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
          if (error) throw error;
          const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
          return data.publicUrl;
      });

      try {
          const urls = await Promise.all(uploadPromises);
          setEditingEventData(prev => ({
              ...prev,
              gallery_images: [...(prev.gallery_images || []), ...urls]
          }));
      } catch (err: any) {
          alert('One or more images failed to upload: ' + err.message);
      } finally {
          setUploadingImage(false);
      }
  };

  const removeGalleryImage = (index: number) => {
      setEditingEventData(prev => {
          const newGallery = [...(prev.gallery_images || [])];
          newGallery.splice(index, 1);
          return { ...prev, gallery_images: newGallery };
      });
  };

  // --- LIST MANIPULATION HELPERS ---
  const updateList = (listName: 'hotel_info' | 'parking_info' | 'extra_info' | 'maps_config', index: number, field: string, value: any) => {
      setEditingEventData(prev => {
          const list = [...(prev[listName] as any[] || [])];
          // Handle nested updates (e.g. contact.name)
          if (field.includes('.')) {
              const [parent, child] = field.split('.');
              list[index] = { ...list[index], [parent]: { ...list[index][parent], [child]: value } };
          } else {
              list[index] = { ...list[index], [field]: value };
          }
          return { ...prev, [listName]: list };
      });
  };

  const addToList = (listName: 'hotel_info' | 'parking_info' | 'extra_info' | 'maps_config', item: any) => {
      setEditingEventData(prev => ({ ...prev, [listName]: [...(prev[listName] as any[] || []), item] }));
  };

  const removeFromList = (listName: 'hotel_info' | 'parking_info' | 'extra_info' | 'maps_config', index: number) => {
      setEditingEventData(prev => {
          const list = [...(prev[listName] as any[] || [])];
          list.splice(index, 1);
          return { ...prev, [listName]: list };
      });
  };
  
  // ITINERARY HELPERS
  const updateItineraryItem = (id: string, field: keyof ItineraryItem, value: any) => {
      setEditingItinerary(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const removeItineraryItem = (id: string) => {
      setEditingItinerary(prev => prev.filter(item => item.id !== id));
  };

  const handleReorder = (date: string, newOrder: ItineraryItem[]) => {
      // 1. Assign new sort_order to the reordered items
      const updatedItems = newOrder.map((item, idx) => ({ ...item, sort_order: idx }));
      
      // 2. Merge with items from other dates
      setEditingItinerary(prev => {
          const otherItems = prev.filter(i => i.date !== date);
          return [...otherItems, ...updatedItems];
      });
  };

  // Sort per-date group (existing)
  const handleAutoSort = (date: string) => {
      setEditingItinerary(prev => {
          const dateItems = prev.filter(i => i.date === date).sort((a, b) => a.start_time.localeCompare(b.start_time));
          const otherItems = prev.filter(i => i.date !== date);
          
          // Reset sort_order based on time for this group
          const reindexedItems = dateItems.map((item, idx) => ({ ...item, sort_order: idx }));
          return [...otherItems, ...reindexedItems];
      });
  };

  // NEW: Global Auto Sort
  const handleGlobalAutoSort = () => {
      if(!confirm("This will sort ALL items by date and time, resetting the drag order. Continue?")) return;
      
      setEditingItinerary(prev => {
          // Sort by Date then Time
          const sorted = [...prev].sort((a, b) => {
              const dateCompare = a.date.localeCompare(b.date);
              if (dateCompare !== 0) return dateCompare;
              return a.start_time.localeCompare(b.start_time);
          });
          
          // Re-index globally
          return sorted.map((item, idx) => ({ ...item, sort_order: idx }));
      });
  };

  const addNewItineraryItem = (type: 'activity' | 'food' | 'travel' | 'other' = 'activity') => {
      const defaultTime = '09:00';
      const defaultDate = editingEventData.date || '';
      
      setEditingItinerary([
          ...editingItinerary, 
          { 
              id: `new-${Date.now()}`, 
              meeting_id: editingEventData.id || '', 
              date: defaultDate, 
              start_time: defaultTime, 
              title: '', 
              description: '', 
              location_details: '',
              sort_order: editingItinerary.filter(i => i.date === defaultDate).length,
              type: type
          }
      ]);
  };

  // Toggle or Add Parking App
  const toggleParkingApp = (index: number, appName: string) => {
      setEditingEventData(prev => {
          const list = [...(prev.parking_info as ParkingDetails[] || [])];
          const currentApps = list[index].apps || [];
          
          const exists = currentApps.some(a => a.label === appName);
          let newApps: LinkItem[];
          
          if (exists) {
              newApps = currentApps.filter(a => a.label !== appName);
          } else {
              newApps = [...currentApps, { label: appName, url: '#' }];
          }
          
          list[index] = { ...list[index], apps: newApps };
          return { ...prev, parking_info: list };
      });
  };

  // --- SAVE & PUBLISH LOGIC ---
  const saveEvent = async (publish: boolean = false) => {
    if (isDemoMode) { 
        setSaveStatus(publish ? 'Event successfully published!' : 'Draft Saved!');
        setTimeout(() => setSaveStatus(''), 3000);
        if (publish) setIsEditingEvent(false); 
        return; 
    }
    
    setSaveStatus('Saving...');
    const payload = { ...editingEventData, status: publish ? 'published' : (editingEventData.status || 'draft') };
    delete payload.id; delete payload.created_at;
    
    let meetingId = editingEventData.id;
    let error = null;

    if (meetingId) { 
        const { error: updateError } = await supabase.from('meetings').update(payload).eq('id', meetingId); 
        error = updateError;
    } else { 
        const { data, error: insertError } = await supabase.from('meetings').insert([payload]).select().single(); 
        if (data) meetingId = data.id; 
        error = insertError;
    }

    if (error) {
        setSaveStatus('Error: ' + error.message);
        return;
    }

    // Save Itinerary
    if (meetingId) {
         await supabase.from('itinerary_items').delete().eq('meeting_id', meetingId);
         if (editingItinerary.length > 0) {
            const newItems = editingItinerary.map(i => { const item = {...i, meeting_id: meetingId}; if(String(item.id).startsWith('new')) delete item.id; return item; });
            await supabase.from('itinerary_items').insert(newItems);
         }
    }

    const { data: refreshedData } = await supabase.from('meetings').select('*').order('date', {ascending: false});
    if(refreshedData) setEvents(refreshedData);
    
    setSaveStatus(publish ? 'Event successfully published!' : 'Draft Saved!');
    setTimeout(() => setSaveStatus(''), 3000);
    
    if (publish) setIsEditingEvent(false);
  }

  // --- COLLECT URL RESOURCES FOR EDITOR ---
  const collectEventResources = () => {
      const resources: { label: string, url: string, type: string }[] = [];
      
      // Maps Config
      (editingEventData.maps_config || []).forEach(m => {
          if(m.url) resources.push({ label: m.label || 'Map', url: m.url, type: 'Map' });
      });

      // Hotels
      (editingEventData.hotel_info as HotelDetails[] || []).forEach(h => {
          if(h.map_url) resources.push({ label: h.name + ' Map', url: h.map_url, type: 'Hotel' });
      });

      // Parking
      (editingEventData.parking_info as ParkingDetails[] || []).forEach(p => {
          if(p.map_url) resources.push({ label: p.location + ' Map', url: p.map_url, type: 'Parking' });
      });

      // Itinerary
      editingItinerary.forEach(i => {
          if(i.location_map_url) resources.push({ label: i.title + ' Location', url: i.location_map_url, type: 'Itinerary' });
      });

      return resources;
  };
  
  // Track Day Helpers
  const trackDayInfo = (editingEventData.extra_info as ExtraInfoSection[] || []).find(e => e.type === 'racing');
  const trackDayIndex = (editingEventData.extra_info as ExtraInfoSection[] || []).findIndex(e => e.type === 'racing');

  return (
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto min-h-screen">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Board Member Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage NMCS events, registrations, and finances.</p>
        </div>
        {activeTab === 'overview' && !isEditingEvent && (
            <button 
                onClick={() => startEditEvent()}
                className="flex items-center gap-2 bg-mini-red text-white px-5 py-2.5 rounded-full font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none"
            >
                <Plus size={18} /> Create Event
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        {!isEditingEvent && (
            <div className="md:col-span-1 flex flex-col gap-2">
                 {[
                    { id: 'overview', label: 'Events Overview', icon: Star },
                    { id: 'registrations', label: 'Registrations', icon: Users },
                    { id: 'finances', label: 'Financials', icon: DollarSign },
                    { id: 'qr-tools', label: 'Maps & QR', icon: QrCode },
                    { id: 'settings', label: 'Settings', icon: Settings },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id as any);
                            setSelectedEventId(null);
                        }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors font-medium
                            ${activeTab === tab.id ? 'bg-mini-black dark:bg-white text-white dark:text-black shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-mini-black dark:hover:text-white'}
                        `}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                ))}
            </div>
        )}

        {/* Main Content */}
        <div className={isEditingEvent ? "col-span-4" : "md:col-span-3"}>
            <AnimatePresence mode='wait'>
            {isEditingEvent ? (
                // --- EDITOR UI ---
                <motion.div
                    key="editor"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800"
                >
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold">{editingEventData.id ? 'Edit Event' : 'New Event'}</h2>
                            {editingEventData.status === 'published' && <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Published</span>}
                            {editingEventData.status === 'draft' && <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-bold">Draft</span>}
                        </div>
                        <button onClick={() => setIsEditingEvent(false)}><X size={24}/></button>
                    </div>
                    {/* Tab Navigation */}
                    <div className="flex flex-wrap gap-2 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto">
                        {[
                            {id: 'general', label: 'General'},
                            {id: 'hotels', label: 'Hotels'},
                            {id: 'parking', label: 'Parking'},
                            {id: 'itinerary', label: 'Itinerary & Info'},
                            {id: 'trackday', label: 'Track Day'},
                            {id: 'photos', label: 'Photos & Gallery'},
                            {id: 'preview', label: 'Preview'},
                            {id: 'maps', label: 'Maps & QR'},
                        ].map(tab => (
                             <button 
                                key={tab.id} 
                                onClick={() => setEditorTab(tab.id as any)} 
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${editorTab === tab.id ? 'bg-white dark:bg-slate-700 text-mini-red shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    {editorTab === 'general' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div>
                                <label className={LABEL_STYLE}>Event Title</label>
                                <input value={editingEventData.title} onChange={e => setEditingEventData({...editingEventData, title: e.target.value})} placeholder="Title" className={INPUT_STYLE} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_STYLE}>Start Date</label>
                                    <input type="date" value={editingEventData.date} onChange={e => setEditingEventData({...editingEventData, date: e.target.value})} className={INPUT_STYLE} />
                                </div>
                                <div>
                                    <label className={LABEL_STYLE}>End Date (Optional)</label>
                                    <input type="date" value={editingEventData.end_date || ''} onChange={e => setEditingEventData({...editingEventData, end_date: e.target.value})} className={INPUT_STYLE} />
                                </div>
                            </div>
                            <div>
                                <label className={LABEL_STYLE}>Location Name</label>
                                <input value={editingEventData.location_name} onChange={e => setEditingEventData({...editingEventData, location_name: e.target.value})} placeholder="Location" className={INPUT_STYLE} />
                            </div>
                            <div>
                                <label className={LABEL_STYLE}>Description</label>
                                <textarea value={editingEventData.description} onChange={e => setEditingEventData({...editingEventData, description: e.target.value})} placeholder="Description" className={INPUT_STYLE} rows={5} />
                            </div>
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-xl text-center bg-slate-50 dark:bg-slate-800">
                                <label className={LABEL_STYLE}>Cover Image</label>
                                <div className="mt-2 flex flex-col items-center">
                                    {editingEventData.cover_image_url && <img src={editingEventData.cover_image_url} className="h-40 object-cover rounded-lg mb-4" />}
                                    <label className="cursor-pointer bg-white dark:bg-slate-700 px-4 py-2 rounded-lg font-bold text-sm border border-slate-200 dark:border-slate-600 hover:border-mini-red">
                                        {uploadingImage ? 'Uploading...' : 'Upload Image'}
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => setEditingEventData({...editingEventData, cover_image_url: url}))} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {editorTab === 'photos' && (
                        <div className="space-y-8 animate-in fade-in">
                            {/* Google Photos Link */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <Image size={20} className="text-mini-red" /> Google Photos Album
                                </h3>
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500">
                                        Paste a link to a Google Photos album (e.g., https://photos.app.goo.gl/...). 
                                        This will show a card in the app allowing users to open the full album.
                                    </p>
                                    <input 
                                        value={editingEventData.google_photos_url || ''} 
                                        onChange={e => setEditingEventData({...editingEventData, google_photos_url: e.target.value})} 
                                        placeholder="https://photos.app.goo.gl/xxxxxx" 
                                        className={INPUT_STYLE} 
                                    />
                                </div>
                            </div>

                            {/* Internal Gallery */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <Camera size={20} className="text-mini-red" /> In-App Gallery Highlights
                                </h3>
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500">
                                        Upload specific photos here to display directly inside the app. 
                                        Good for highlighting the best shots without forcing users to leave the app.
                                    </p>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {editingEventData.gallery_images?.map((url, idx) => (
                                            <div key={idx} className="relative aspect-square group">
                                                <img src={url} className="w-full h-full object-cover rounded-xl" />
                                                <button 
                                                    onClick={() => removeGalleryImage(idx)}
                                                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        
                                        <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-mini-red transition-colors bg-white dark:bg-slate-900">
                                            {uploadingImage ? (
                                                <div className="animate-spin text-mini-red"><RefreshCw size={24}/></div>
                                            ) : (
                                                <>
                                                    <Plus size={24} className="text-slate-400 mb-2"/>
                                                    <span className="text-xs font-bold text-slate-500">Upload</span>
                                                </>
                                            )}
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleGalleryUpload} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... (Keep existing hotel, parking, itinerary tabs) ... */}
                    {editorTab === 'hotels' && (
                        <div className="space-y-8 animate-in fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-xl flex items-center gap-2"><Building2 size={20}/> Hotels</h3>
                                <button onClick={() => addToList('hotel_info', { id: `h-${Date.now()}`, name: '', address: '', map_url: '', price_single: '', price_double: '', description: '', booking_links: [], contact: {name: '', email: '', phone: ''} })} className={`${BUTTON_STYLE} bg-mini-black dark:bg-white text-white dark:text-black`}>+ Add Hotel</button>
                            </div>
                            
                            {(editingEventData.hotel_info as HotelDetails[] || []).map((hotel, idx) => (
                                <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 relative mb-6">
                                    <button onClick={() => removeFromList('hotel_info', idx)} className="absolute top-6 right-6 text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={20}/></button>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className={LABEL_STYLE}>Hotel Name</label>
                                            <input value={hotel.name} onChange={e => updateList('hotel_info', idx, 'name', e.target.value)} className={INPUT_STYLE} placeholder="Hotel Name" />
                                        </div>
                                        <div>
                                            <label className={LABEL_STYLE}>Address</label>
                                            <input value={hotel.address} onChange={e => updateList('hotel_info', idx, 'address', e.target.value)} className={INPUT_STYLE} placeholder="Address" />
                                        </div>
                                    </div>
                                    
                                    <div className="mb-4">
                                        <label className={LABEL_STYLE}>Map URL</label>
                                        <input value={hotel.map_url} onChange={e => updateList('hotel_info', idx, 'map_url', e.target.value)} className={INPUT_STYLE} placeholder="https://maps.google.com..." />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className={LABEL_STYLE}>Price Single</label>
                                            <input value={hotel.price_single} onChange={e => updateList('hotel_info', idx, 'price_single', e.target.value)} className={INPUT_STYLE} placeholder="e.g. 1500 SEK" />
                                        </div>
                                        <div>
                                            <label className={LABEL_STYLE}>Price Double</label>
                                            <input value={hotel.price_double} onChange={e => updateList('hotel_info', idx, 'price_double', e.target.value)} className={INPUT_STYLE} placeholder="e.g. 1800 SEK" />
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className={LABEL_STYLE}>Description</label>
                                        <textarea value={hotel.description} onChange={e => updateList('hotel_info', idx, 'description', e.target.value)} className={INPUT_STYLE} rows={3} placeholder="Room details, breakfast info..." />
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                                        <h4 className="font-bold text-sm mb-3">Contact Person</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <input value={hotel.contact?.name || ''} onChange={e => updateList('hotel_info', idx, 'contact.name', e.target.value)} className={`${INPUT_STYLE} text-sm`} placeholder="Name" />
                                            <input value={hotel.contact?.email || ''} onChange={e => updateList('hotel_info', idx, 'contact.email', e.target.value)} className={`${INPUT_STYLE} text-sm`} placeholder="Email" />
                                            <input value={hotel.contact?.phone || ''} onChange={e => updateList('hotel_info', idx, 'contact.phone', e.target.value)} className={`${INPUT_STYLE} text-sm`} placeholder="Phone" />
                                        </div>
                                    </div>

                                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 rounded-xl text-center bg-white dark:bg-slate-900">
                                        <label className={LABEL_STYLE}>Hotel Image</label>
                                        <div className="flex flex-col items-center">
                                            {hotel.image_url ? (
                                                <img src={hotel.image_url} className="h-32 object-cover rounded-lg mb-2" />
                                            ) : <div className="h-32 w-full bg-slate-100 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs">No Image</div>}
                                            <label className="cursor-pointer text-blue-600 font-bold hover:underline text-sm">
                                                {uploadingImage ? 'Uploading...' : 'Upload Photo'}
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => updateList('hotel_info', idx, 'image_url', url))} />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(editingEventData.hotel_info as HotelDetails[] || []).length === 0 && <p className="text-center text-slate-400 italic">No hotels added.</p>}
                        </div>
                    )}

                    {editorTab === 'parking' && (
                        <div className="space-y-8 animate-in fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-xl flex items-center gap-2"><Car size={20}/> Parking</h3>
                                <button onClick={() => addToList('parking_info', { id: `p-${Date.now()}`, location: '', cost: '', security_info: '', map_url: '', apps: [] })} className={`${BUTTON_STYLE} bg-mini-black dark:bg-white text-white dark:text-black`}>+ Add Parking</button>
                            </div>

                            {(editingEventData.parking_info as ParkingDetails[] || []).map((park, idx) => (
                                <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 relative mb-6">
                                    <button onClick={() => removeFromList('parking_info', idx)} className="absolute top-6 right-6 text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={20}/></button>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className={LABEL_STYLE}>Location Name</label>
                                            <input value={park.location} onChange={e => updateList('parking_info', idx, 'location', e.target.value)} className={INPUT_STYLE} placeholder="e.g. Garage Central" />
                                        </div>
                                        <div>
                                            <label className={LABEL_STYLE}>Cost</label>
                                            <input value={park.cost} onChange={e => updateList('parking_info', idx, 'cost', e.target.value)} className={INPUT_STYLE} placeholder="e.g. 200 SEK / day" />
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className={LABEL_STYLE}>Map URL</label>
                                        <input value={park.map_url} onChange={e => updateList('parking_info', idx, 'map_url', e.target.value)} className={INPUT_STYLE} placeholder="https://maps.google.com..." />
                                    </div>

                                    <div className="mb-4">
                                        <label className={LABEL_STYLE}>Security Info</label>
                                        <input value={park.security_info} onChange={e => updateList('parking_info', idx, 'security_info', e.target.value)} className={INPUT_STYLE} placeholder="e.g. Locked gate at night" />
                                    </div>

                                    <div className="mb-4">
                                        <label className={LABEL_STYLE}>Parking Apps</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {['EasyPark', 'Parkster', 'MobilPark'].map(app => (
                                                <button 
                                                    key={app}
                                                    onClick={() => toggleParkingApp(idx, app)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${park.apps?.some(a => a.label === app) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white border-slate-200 text-slate-500'}`}
                                                >
                                                    {app}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 rounded-xl text-center bg-white dark:bg-slate-900">
                                        <label className={LABEL_STYLE}>Parking Image</label>
                                        <div className="flex flex-col items-center">
                                            {park.image_url ? (
                                                <img src={park.image_url} className="h-32 object-cover rounded-lg mb-2" />
                                            ) : <div className="h-32 w-full bg-slate-100 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs">No Image</div>}
                                            <label className="cursor-pointer text-blue-600 font-bold hover:underline text-sm">
                                                {uploadingImage ? 'Uploading...' : 'Upload Photo'}
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => updateList('parking_info', idx, 'image_url', url))} />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(editingEventData.parking_info as ParkingDetails[] || []).length === 0 && <p className="text-center text-slate-400 italic">No parking info added.</p>}
                        </div>
                    )}
                    
                    {editorTab === 'itinerary' && (
                        <div className="space-y-8 animate-in fade-in">
                             {/* Schedule Section */}
                             <div>
                                 <div className="flex justify-between items-center mb-4">
                                     <div className="flex items-center gap-3">
                                         <h3 className="font-bold text-xl flex items-center gap-2"><Clock size={20}/> Schedule</h3>
                                         <button 
                                            onClick={handleGlobalAutoSort}
                                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-mini-red hover:text-white transition-colors flex items-center gap-2"
                                            title="Reorder ENTIRE list by Date & Time"
                                         >
                                             <ListOrdered size={14} /> Sort All
                                         </button>
                                     </div>
                                     <div className="flex gap-2">
                                         <button onClick={() => addNewItineraryItem('activity')} className={`${BUTTON_STYLE} bg-mini-black dark:bg-white text-white dark:text-black`}>+ Activity</button>
                                         <button onClick={() => addNewItineraryItem('food')} className={`${BUTTON_STYLE} bg-orange-100 text-orange-800`}>+ Food</button>
                                         <button onClick={() => addNewItineraryItem('travel')} className={`${BUTTON_STYLE} bg-blue-100 text-blue-800`}>+ Trip</button>
                                         <button onClick={() => addNewItineraryItem('other')} className={`${BUTTON_STYLE} bg-slate-200 text-slate-800`}>+ Other</button>
                                     </div>
                                 </div>
                                 <div className="space-y-4">
                                     {editingItinerary.length === 0 && <p className="text-slate-400 italic text-sm">No schedule items yet.</p>}
                                     
                                     {groupedItinerary.map(group => (
                                         <div key={group.date} className="mb-6">
                                            <div className="flex items-center gap-2 mb-3 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                                                <Calendar size={16} className="text-mini-red"/>
                                                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">{group.date}</h4>
                                                
                                                {/* NEW: Auto-Sort Button */}
                                                <button 
                                                    onClick={() => handleAutoSort(group.date)}
                                                    className="ml-auto text-xs flex items-center gap-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded transition-colors"
                                                    title="Sort items by time"
                                                >
                                                    <ArrowUpDown size={12} /> Auto-Sort Day
                                                </button>
                                                <span className="text-xs text-slate-400 ml-2">| Drag to reorder</span>
                                            </div>
                                            
                                            <Reorder.Group axis="y" values={group.items} onReorder={(newOrder) => handleReorder(group.date, newOrder)}>
                                                {group.items.map(item => (
                                                    <ItineraryEditorItem 
                                                        key={item.id} 
                                                        item={item} 
                                                        updateItineraryItem={updateItineraryItem} 
                                                        removeItineraryItem={removeItineraryItem} 
                                                    />
                                                ))}
                                            </Reorder.Group>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        </div>
                    )}
                    
                    {editorTab === 'trackday' && (
                        <div className="space-y-8 animate-in fade-in">
                            <div className="flex justify-between items-center mb-4">
                                 <h3 className="font-bold text-xl flex items-center gap-2"><Flag size={20}/> Track Day Information</h3>
                            </div>
                            
                            {trackDayInfo ? (
                                <div className="space-y-6">
                                    <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 relative">
                                        <button onClick={() => removeFromList('extra_info', trackDayIndex)} className="absolute top-6 right-6 text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={20}/></button>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className={LABEL_STYLE}>Track Name</label>
                                                <input 
                                                    value={trackDayInfo.title} 
                                                    onChange={e => updateList('extra_info', trackDayIndex, 'title', e.target.value)} 
                                                    placeholder="e.g. Mantorp Park" 
                                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-mini-red" 
                                                />
                                            </div>
                                            <div>
                                                <label className={LABEL_STYLE}>Address</label>
                                                <input 
                                                    value={trackDayInfo.address || ''} 
                                                    onChange={e => updateList('extra_info', trackDayIndex, 'address', e.target.value)} 
                                                    placeholder="Street Address" 
                                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-mini-red" 
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className={LABEL_STYLE}>Google Maps Link</label>
                                            <input 
                                                value={trackDayInfo.website_url || ''} 
                                                onChange={e => updateList('extra_info', trackDayIndex, 'website_url', e.target.value)} 
                                                placeholder="https://goo.gl/maps/..." 
                                                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-mini-red" 
                                            />
                                        </div>
                                        
                                        <div className="mt-4">
                                            <label className={LABEL_STYLE}>Description / Schedule</label>
                                            <textarea 
                                                value={trackDayInfo.content} 
                                                onChange={e => updateList('extra_info', trackDayIndex, 'content', e.target.value)} 
                                                placeholder="Details about the track day..." 
                                                rows={4}
                                                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-mini-red" 
                                            />
                                        </div>
                                        
                                        <div className="mt-4">
                                             <label className={LABEL_STYLE}>Track Rules</label>
                                             <textarea 
                                                value={trackDayInfo.rules_content || ''} 
                                                onChange={e => updateList('extra_info', trackDayIndex, 'rules_content', e.target.value)} 
                                                placeholder="Safety rules, flags, requirements..." 
                                                rows={4}
                                                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-mini-red" 
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                            {/* Main Photo Upload */}
                                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 rounded-xl text-center bg-white dark:bg-slate-900">
                                                <label className={LABEL_STYLE}>Main Photo</label>
                                                <div className="flex flex-col items-center">
                                                    {trackDayInfo.image_url ? (
                                                        <img src={trackDayInfo.image_url} className="h-32 object-cover rounded-lg mb-2" />
                                                    ) : <div className="h-32 w-full bg-slate-100 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs">No Image</div>}
                                                    
                                                    <label className="cursor-pointer text-blue-600 font-bold hover:underline text-sm">
                                                        {uploadingImage ? 'Uploading...' : 'Upload Photo'}
                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => updateList('extra_info', trackDayIndex, 'image_url', url))} />
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Track Map Upload */}
                                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 rounded-xl text-center bg-white dark:bg-slate-900">
                                                <label className={LABEL_STYLE}>Race Track Map</label>
                                                <div className="flex flex-col items-center">
                                                    {trackDayInfo.track_map_image_url ? (
                                                        <img src={trackDayInfo.track_map_image_url} className="h-32 object-contain rounded-lg mb-2 bg-slate-100" />
                                                    ) : <div className="h-32 w-full bg-slate-100 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs">No Map</div>}
                                                    
                                                    <label className="cursor-pointer text-blue-600 font-bold hover:underline text-sm">
                                                        {uploadingImage ? 'Uploading...' : 'Upload Map'}
                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => updateList('extra_info', trackDayIndex, 'track_map_image_url', url))} />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <Flag size={48} className="mx-auto text-slate-300 mb-4" />
                                    <p className="text-slate-500 mb-6">No track day information added yet.</p>
                                    <button 
                                        onClick={() => addToList('extra_info', { title: 'Track Day', type: 'racing', icon: 'flag', content: '', address: '', website_url: '' })} 
                                        className={`${BUTTON_STYLE} bg-mini-black dark:bg-white text-white dark:text-black mx-auto`}
                                    >
                                        + Add Track Day Info
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {editorTab === 'maps' && (
                         <div className="space-y-8 animate-in fade-in">
                            
                            {/* LIST EXISTING MAPS */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold">Custom Maps</h3>
                                    <button onClick={() => addToList('maps_config', { groupName: 'General', label: 'Route Map', url: '' })} className={`${BUTTON_STYLE} bg-mini-black dark:bg-white text-white dark:text-black`}>+ Add Map</button>
                                </div>
                                
                                {(editingEventData.maps_config || []).map((map, idx) => (
                                    <div key={idx} className="border border-slate-200 dark:border-slate-700 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 flex gap-6 items-center">
                                        <div className="space-y-3 flex-grow">
                                            <input value={map.groupName} onChange={e => updateList('maps_config', idx, 'groupName', e.target.value)} placeholder="Group (e.g. Day 1)" className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                            <input value={map.label} onChange={e => updateList('maps_config', idx, 'label', e.target.value)} placeholder="Label (e.g. Morning Route)" className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                            <input value={map.url} onChange={e => updateList('maps_config', idx, 'url', e.target.value)} placeholder="Google Maps URL" className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                        </div>
                                        <button onClick={() => setStudioUrl(map.url)} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-mini-red hover:text-white transition-colors">
                                            Customize QR
                                        </button>
                                        <button onClick={() => removeFromList('maps_config', idx)} className="text-red-500 self-start"><X size={20}/></button>
                                    </div>
                                ))}
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800" />

                            {/* AUTO-GENERATED RESOURCES */}
                            <div>
                                <h3 className="font-bold mb-4">Linked Resources (from other tabs)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {collectEventResources().map((res, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => setStudioUrl(res.url)}
                                            className="text-left p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-mini-red transition-all group"
                                        >
                                            <div className="text-xs font-bold text-slate-400 uppercase">{res.type}</div>
                                            <div className="font-bold text-slate-900 dark:text-white truncate">{res.label}</div>
                                            <div className="text-xs text-blue-500 mt-1 truncate">{res.url}</div>
                                            <div className="mt-2 text-xs font-bold text-mini-red opacity-0 group-hover:opacity-100 transition-opacity">
                                                Click to Customize QR →
                                            </div>
                                        </button>
                                    ))}
                                    {collectEventResources().length === 0 && <p className="text-slate-400 italic text-sm">No linked resources found (Hotels, Parking, etc).</p>}
                                </div>
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800" />

                            {/* QR CODE STUDIO */}
                            <QrCodeStudio initialUrl={studioUrl} />
                         </div>
                    )}
                    
                    {editorTab === 'preview' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-2xl text-center">
                                <h3 className="text-xl font-bold mb-2">Preview Mode</h3>
                                <p className="text-slate-500 mb-6">This shows how the event card will look on the home page.</p>
                                <div className="max-w-sm mx-auto bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-lg border-b-4 border-mini-red">
                                    <div className="h-48 relative">
                                        <img src={editingEventData.cover_image_url || "https://picsum.photos/800/600"} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                        <div className="absolute bottom-4 left-4 text-white text-left">
                                            <div className="text-xs font-bold uppercase mb-1">{editingEventData.date}</div>
                                            <div className="font-black text-xl leading-tight">{editingEventData.title || "Event Title"}</div>
                                        </div>
                                    </div>
                                    <div className="p-4 text-left">
                                        <div className="text-sm text-slate-500 mb-2 flex items-center gap-1"><MapPin size={14} className="text-mini-red"/> {editingEventData.location_name || "Location"}</div>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{editingEventData.description || "Description..."}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between sticky bottom-0 bg-white dark:bg-slate-900 z-10">
                        <button onClick={() => setIsEditingEvent(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                        
                        <div className="flex items-center gap-3">
                            {saveStatus && (
                                <span className="text-sm font-bold text-green-600 animate-pulse flex items-center gap-1">
                                    <CheckCircle size={14}/> {saveStatus}
                                </span>
                            )}
                            <button onClick={() => saveEvent(false)} className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                <Save size={18}/> Save Draft
                            </button>
                            <button onClick={() => saveEvent(true)} className="px-6 py-3 bg-mini-red text-white rounded-xl font-bold shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 flex items-center gap-2">
                                <Share size={18}/> Publish
                            </button>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 min-h-[600px] transition-colors"
                >
                    {/* Dashboard Tabs Content (Unchanged) */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-900 dark:text-white">Active Events</h2>
                            {events.map((evt) => (
                                <div key={evt.id} className="flex justify-between items-center p-4 border rounded-xl hover:border-mini-red transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-12 rounded-full ${evt.status === 'published' ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                                        <div>
                                            <h3 className="font-bold text-lg group-hover:text-mini-red transition-colors">{evt.title}</h3>
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <span>{evt.date}</span>
                                                <span>•</span>
                                                <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded ${evt.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {evt.status || 'Draft'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => startEditEvent(evt)} className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-200">Edit</button>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* ... other tabs ... */}
                    {activeTab === 'registrations' && (
                        <div className="space-y-6">
                             {!selectedEventId ? (
                                <div className="space-y-4">
                                    <h2 className="text-xl font-bold">Select Event</h2>
                                    {events.map(evt => (
                                        <button key={evt.id} onClick={() => setSelectedEventId(evt.id)} className="w-full text-left p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-bold">
                                            {evt.title}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div>
                                     <button onClick={() => setSelectedEventId(null)} className="mb-4 text-sm font-bold flex items-center gap-1"><ArrowLeft size={16}/> Back</button>
                                     <h2 className="text-xl font-bold mb-4">Registrations</h2>
                                     <table className="w-full text-left">
                                        <thead><tr className="border-b"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Car</th></tr></thead>
                                        <tbody>
                                            {registrations.map(reg => (
                                                <tr key={reg.id} className="border-b"><td className="p-2">{reg.full_name}</td><td className="p-2">{reg.email}</td><td className="p-2">{reg.car_type}</td></tr>
                                            ))}
                                        </tbody>
                                     </table>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* 3. FINANCIALS TAB */}
                    {activeTab === 'finances' && (
                        <div className="space-y-6">
                            {!selectedEventId ? (
                                <div className="space-y-4">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Select Event to Manage Finances</h2>
                                    {events.map(evt => (
                                        <button key={evt.id} onClick={() => setSelectedEventId(evt.id)} className="w-full text-left p-6 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-mini-red transition-all shadow-sm">
                                            <div className="font-bold text-lg">{evt.title}</div>
                                            <div className="text-sm text-slate-500">{evt.date}</div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="animate-in fade-in">
                                    <button onClick={() => setSelectedEventId(null)} className="mb-4 text-sm font-bold flex items-center gap-1"><ArrowLeft size={16}/> Back to Events</button>
                                    
                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900">
                                            <div className="text-xs font-bold text-green-600 uppercase">Income</div>
                                            <div className="text-xl font-black text-green-700 dark:text-green-400">{financialStats.income} SEK</div>
                                        </div>
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900">
                                            <div className="text-xs font-bold text-red-600 uppercase">Expenses</div>
                                            <div className="text-xl font-black text-red-700 dark:text-red-400">{financialStats.expense} SEK</div>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div className="text-xs font-bold text-slate-500 uppercase">Net Result</div>
                                            <div className={`text-xl font-black ${financialStats.net >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>{financialStats.net} SEK</div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-lg">Transactions</h3>
                                        <button onClick={() => { setEditingTransaction({ type: 'expense', date: new Date().toISOString().split('T')[0], amount: 0, description: '', category: '' }); setShowTransactionModal(true); }} className="bg-mini-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                                            <Plus size={16}/> Add Transaction
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {transactions.map(t => (
                                            <div key={t.id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                        {t.type === 'income' ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold">{t.description}</div>
                                                        <div className="text-xs text-slate-500">{t.date} • {t.category}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {t.type === 'income' ? '+' : '-'}{t.amount}
                                                    </span>
                                                    <button onClick={() => handleDeleteTransaction(t.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        ))}
                                        {transactions.length === 0 && <p className="text-center text-slate-400 italic py-4">No transactions recorded.</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold mb-4">App Settings</h2>
                            <div className="space-y-4">
                                <ToggleSwitch 
                                    label="Public Registration" 
                                    description="Allow non-members to see register button."
                                    checked={appSettings.public_registration === 'true'} 
                                    onChange={() => handleToggleSetting('public_registration')}
                                    icon={Globe}
                                />
                                <ToggleSwitch 
                                    label="Enable Waitlist" 
                                    description="Allow users to join waitlist when full."
                                    checked={appSettings.enable_waitlist === 'true'} 
                                    onChange={() => handleToggleSetting('enable_waitlist')}
                                    icon={List}
                                />
                                <ToggleSwitch 
                                    label="Maintenance Mode" 
                                    description="Disable all public access."
                                    checked={appSettings.maintenance_mode === 'true'} 
                                    onChange={() => handleToggleSetting('maintenance_mode')}
                                    icon={AlertTriangle}
                                />
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <label className={LABEL_STYLE}>Auto Logout Timer (Hours)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            value={appSettings.auto_logout_hours} 
                                            onChange={(e) => setAppSettings({...appSettings, auto_logout_hours: e.target.value})}
                                            className={INPUT_STYLE}
                                        />
                                        <button onClick={() => handleSaveSettings()} className="bg-mini-black dark:bg-white text-white dark:text-black px-4 rounded-xl font-bold">Save</button>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 text-right">{settingsStatus}</div>
                            </div>
                        </div>
                    )}

                    {/* 5. QR TOOLS TAB */}
                    {activeTab === 'qr-tools' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold mb-4">QR Code Studio</h2>
                            <QrCodeStudio />
                        </div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>
        </div>
      </div>

       {/* Transaction Modal */}
       <Modal isOpen={showTransactionModal} onClose={() => setShowTransactionModal(false)} title={editingTransaction.id ? "Edit Transaction" : "New Transaction"}>
            <form onSubmit={handleSaveTransaction} className="space-y-4">
                <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button type="button" onClick={() => setEditingTransaction({...editingTransaction, type: 'income'})} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${editingTransaction.type === 'income' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500'}`}>Income</button>
                    <button type="button" onClick={() => setEditingTransaction({...editingTransaction, type: 'expense'})} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${editingTransaction.type === 'expense' ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm' : 'text-slate-500'}`}>Expense</button>
                </div>
                <div>
                    <label className={LABEL_STYLE}>Description</label>
                    <input required value={editingTransaction.description} onChange={e => setEditingTransaction({...editingTransaction, description: e.target.value})} className={INPUT_STYLE} placeholder="e.g. Catering Deposit" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={LABEL_STYLE}>Amount (SEK)</label>
                        <input type="number" required value={editingTransaction.amount} onChange={e => setEditingTransaction({...editingTransaction, amount: Number(e.target.value)})} className={INPUT_STYLE} placeholder="0.00" />
                    </div>
                    <div>
                        <label className={LABEL_STYLE}>Date</label>
                        <input type="date" required value={editingTransaction.date} onChange={e => setEditingTransaction({...editingTransaction, date: e.target.value})} className={INPUT_STYLE} />
                    </div>
                </div>
                <div>
                    <label className={LABEL_STYLE}>Category</label>
                    <input value={editingTransaction.category} onChange={e => setEditingTransaction({...editingTransaction, category: e.target.value})} className={INPUT_STYLE} placeholder="e.g. Food, Venue, Merch" />
                </div>
                <button type="submit" className="w-full bg-mini-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold mt-4">Save Transaction</button>
            </form>
       </Modal>
    </div>
  );
};

export default AdminDashboard;
