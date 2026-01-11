
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, DollarSign, Users, Settings, Star, Save, Search, Edit3, ArrowLeft, Lock, CheckCircle, Mail, UserCog, X, Trash2, RefreshCw, MapPin, Building2, Car, Utensils, Flag, Map, Upload, Clock, Calendar, Link as LinkIcon, Smartphone, ExternalLink, Globe, Eye, QrCode, TrendingUp, TrendingDown, Wallet, ToggleLeft, ToggleRight, UserPlus, AlertTriangle, Image, List, TestTube, Check, Share, Info, Palette, ImageIcon, Download, Circle, Square } from 'lucide-react';
import { Registration, Transaction, Meeting, ExtraInfoSection, HotelDetails, ParkingDetails, ItineraryItem, MapConfig, LinkItem } from '../types';
import { supabase, isDemoMode, finalUrl, finalKey, STORAGE_BUCKET } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import Modal from '../components/Modal';
import QRCode from 'react-qr-code';

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

const AdminDashboard: React.FC = () => {
  // 1. CONTEXT HOOKS
  const { isAdmin, loading, session, signOut, updatePassword, sendPasswordReset, authStatus, checkAdmin } = useAuth();
  const { t } = useLanguage();
  
  // 2. STATE HOOKS
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'finances' | 'settings'>('overview');
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
  // Removed 'extra' from the tab type definition as it's merged into itinerary
  const [editorTab, setEditorTab] = useState<'general' | 'itinerary' | 'hotels' | 'parking' | 'maps' | 'preview'>('general');
  const [editingEventData, setEditingEventData] = useState<Partial<Meeting>>({});
  const [editingItinerary, setEditingItinerary] = useState<ItineraryItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  
  // Parking App Custom Input State
  const [customAppName, setCustomAppName] = useState('');

  // QR Studio State
  const [qrStudio, setQrStudio] = useState({
      url: 'https://nmcs.se',
      fgColor: '#000000',
      bgColor: '#ffffff',
      logoUrl: '',
      bgImageUrl: '',
      shape: 'square' as 'square' | 'rounded' | 'circle'
  });

  // 3. MEMO HOOKS (Must be before any return)
  const financialStats = useMemo(() => {
      const income = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const expense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      return { income, expense, net: income - expense };
  }, [transactions]);

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
      if(evt) {
          const eventData = JSON.parse(JSON.stringify(evt));
          // Normalize arrays
          if (eventData.hotel_info && !Array.isArray(eventData.hotel_info)) eventData.hotel_info = [eventData.hotel_info];
          if (eventData.parking_info && !Array.isArray(eventData.parking_info)) eventData.parking_info = [eventData.parking_info];
          if (!eventData.extra_info) eventData.extra_info = [];
          if (!eventData.maps_config) eventData.maps_config = [];
          
          setEditingEventData(eventData);

          if (!isDemoMode) {
              const { data } = await supabase.from('itinerary_items').select('*').eq('meeting_id', evt.id).order('date', {ascending: true}).order('start_time', {ascending: true});
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
              extra_info: []
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

  // --- QR DOWNLOAD ---
  const downloadQr = () => {
      const svg = document.getElementById("qr-code-studio");
      if(svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const img = new window.Image();
          img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              if (ctx) {
                  // Fill white background first if transparency issues
                  ctx.fillStyle = "white";
                  ctx.fillRect(0,0, canvas.width, canvas.height);
                  if (qrStudio.bgImageUrl) {
                      // Draw background image logic complex here without CORS...
                      // Skipping bg image draw on canvas for simplicity in this constraints
                  }
                  ctx.drawImage(img, 0, 0);
              }
              const a = document.createElement("a");
              a.download = "nmcs-qr.png";
              a.href = canvas.toDataURL("image/png");
              a.click();
          };
          img.src = "data:image/svg+xml;base64," + btoa(svgData);
      }
  }

  // Determine container style based on shape
  const getQrContainerStyle = () => {
      switch(qrStudio.shape) {
          case 'circle': return 'rounded-full overflow-hidden border-4 border-white';
          case 'rounded': return 'rounded-3xl overflow-hidden border-4 border-white';
          case 'square': default: return 'rounded-none border-4 border-white';
      }
  }

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
                    
                    {editorTab === 'itinerary' && (
                        <div className="space-y-8 animate-in fade-in">
                             {/* Schedule Section */}
                             <div>
                                 <div className="flex justify-between items-center mb-4">
                                     <h3 className="font-bold text-xl flex items-center gap-2"><Clock size={20}/> Schedule</h3>
                                     <button onClick={() => setEditingItinerary([...editingItinerary, { id: `new-${Date.now()}`, meeting_id: editingEventData.id || '', date: editingEventData.date || '', start_time: '09:00', title: '', description: '', location_details: '' }])} className={`${BUTTON_STYLE} bg-mini-black dark:bg-white text-white dark:text-black`}>+ Add Item</button>
                                 </div>
                                 <div className="space-y-4">
                                     {editingItinerary.length === 0 && <p className="text-slate-400 italic text-sm">No schedule items yet.</p>}
                                     {editingItinerary.map((item, idx) => (
                                         <div key={idx} className="flex gap-4 items-start border border-slate-200 dark:border-slate-700 p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                                             <div className="flex flex-col gap-2 w-32 shrink-0">
                                                <label className="text-[10px] font-bold uppercase text-slate-500">Time</label>
                                                {/* STYLED TIME INPUT */}
                                                <div className="relative">
                                                    <input 
                                                        type="time" 
                                                        value={item.start_time} 
                                                        onChange={e => {const arr=[...editingItinerary]; arr[idx].start_time=e.target.value; setEditingItinerary(arr)}} 
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
                                                        onChange={e => {const arr=[...editingItinerary]; arr[idx].date=e.target.value; setEditingItinerary(arr)}} 
                                                        className="w-full pl-9 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium outline-none focus:ring-1 focus:ring-mini-red" 
                                                    />
                                                    <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                             </div>
                                             <div className="flex-grow space-y-2">
                                                 <input value={item.title} onChange={e => {const arr=[...editingItinerary]; arr[idx].title=e.target.value; setEditingItinerary(arr)}} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" placeholder="Title" />
                                                 <input value={item.description} onChange={e => {const arr=[...editingItinerary]; arr[idx].description=e.target.value; setEditingItinerary(arr)}} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" placeholder="Short Description" />
                                                 <textarea value={item.location_details || ''} onChange={e => {const arr=[...editingItinerary]; arr[idx].location_details=e.target.value; setEditingItinerary(arr)}} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" placeholder="Detailed Instructions (Optional)" rows={2} />
                                             </div>
                                             <button onClick={() => {const arr=[...editingItinerary]; arr.splice(idx,1); setEditingItinerary(arr)}} className="text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 size={20}/></button>
                                         </div>
                                     ))}
                                 </div>
                             </div>

                             <hr className="border-slate-100 dark:border-slate-800" />

                             {/* Extra Info Section (Merged) */}
                             <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-xl flex items-center gap-2"><Info size={20}/> Additional Info</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => addToList('extra_info', { title: 'Dinner', type: 'food', icon: 'utensils', content: '' })} className={`${BUTTON_STYLE} bg-orange-100 text-orange-800`}>+ Food</button>
                                        <button onClick={() => addToList('extra_info', { title: 'Route Info', type: 'roadtrip', icon: 'map', content: '' })} className={`${BUTTON_STYLE} bg-blue-100 text-blue-800`}>+ Trip</button>
                                        <button onClick={() => addToList('extra_info', { title: 'Track Rules', type: 'racing', icon: 'flag', content: '' })} className={`${BUTTON_STYLE} bg-red-100 text-red-800`}>+ Racing</button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {((editingEventData.extra_info as ExtraInfoSection[]) || []).length === 0 && <p className="text-slate-400 italic text-sm">No extra info sections yet.</p>}
                                    {((editingEventData.extra_info as ExtraInfoSection[]) || []).map((info, idx) => (
                                        <div key={idx} className="border border-slate-200 dark:border-slate-700 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 relative">
                                            <button onClick={() => removeFromList('extra_info', idx)} className="absolute top-4 right-4 text-red-500 hover:bg-red-50 rounded p-1"><Trash2 size={20}/></button>
                                            <div className="flex gap-4 mb-4">
                                                <div className="p-3 bg-white dark:bg-slate-700 rounded-lg border dark:border-slate-600 shadow-sm h-fit">
                                                    {info.icon === 'utensils' && <Utensils />}
                                                    {info.icon === 'map' && <Map />}
                                                    {info.icon === 'flag' && <Flag />}
                                                    {info.icon === 'info' && <AlertTriangle />}
                                                </div>
                                                <div className="flex-grow space-y-2">
                                                    <input value={info.title} onChange={e => updateList('extra_info', idx, 'title', e.target.value)} placeholder="Title" className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
                                                    <textarea value={info.content} onChange={e => updateList('extra_info', idx, 'content', e.target.value)} placeholder="Content..." className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" rows={4} />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {info.image_url && <img src={info.image_url} className="h-16 w-16 object-cover rounded bg-white dark:bg-slate-900 border" />}
                                                <label className="cursor-pointer text-sm text-blue-600 hover:underline">
                                                    Upload Photo
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => updateList('extra_info', idx, 'image_url', url))} />
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    )}

                    {editorTab === 'maps' && (
                         <div className="space-y-8 animate-in fade-in">
                            
                            {/* LIST EXISTING MAPS */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold">Map Links & QR Codes</h3>
                                    <button onClick={() => addToList('maps_config', { groupName: 'General', label: 'Route Map', url: '' })} className={`${BUTTON_STYLE} bg-mini-black dark:bg-white text-white dark:text-black`}>+ Add Map</button>
                                </div>
                                
                                {(editingEventData.maps_config || []).map((map, idx) => (
                                    <div key={idx} className="border border-slate-200 dark:border-slate-700 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 flex gap-6">
                                        <div className="space-y-3 flex-grow">
                                            <input value={map.groupName} onChange={e => updateList('maps_config', idx, 'groupName', e.target.value)} placeholder="Group (e.g. Day 1)" className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                            <input value={map.label} onChange={e => updateList('maps_config', idx, 'label', e.target.value)} placeholder="Label (e.g. Morning Route)" className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                            <input value={map.url} onChange={e => updateList('maps_config', idx, 'url', e.target.value)} placeholder="Google Maps URL" className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                        </div>
                                        <div className="shrink-0 flex flex-col items-center justify-center bg-white dark:bg-slate-900 p-2 rounded-lg shadow-sm border dark:border-slate-700 w-32">
                                            {map.url ? <QRCode value={map.url} size={80} className="dark:bg-white dark:p-1 dark:rounded" /> : <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400">No URL</div>}
                                            <span className="text-[10px] mt-1 text-slate-400">Preview</span>
                                        </div>
                                        <button onClick={() => removeFromList('maps_config', idx)} className="text-red-500 self-start"><X size={20}/></button>
                                    </div>
                                ))}
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800" />

                            {/* QR CODE STUDIO */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><QrCode size={20} /> QR Code Studio</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div>
                                            <label className={LABEL_STYLE}>Content (URL)</label>
                                            <input 
                                                value={qrStudio.url} 
                                                onChange={e => setQrStudio({...qrStudio, url: e.target.value})} 
                                                className={INPUT_STYLE} 
                                                placeholder="https://..."
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className={LABEL_STYLE}>Shape Style</label>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setQrStudio(p => ({...p, shape: 'square'}))}
                                                    className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${qrStudio.shape === 'square' ? 'bg-mini-black text-white border-mini-black' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                                                >
                                                    <Square size={20} /> <span className="text-xs font-bold">Square</span>
                                                </button>
                                                <button 
                                                    onClick={() => setQrStudio(p => ({...p, shape: 'rounded'}))}
                                                    className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${qrStudio.shape === 'rounded' ? 'bg-mini-black text-white border-mini-black' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                                                >
                                                    <div className="w-5 h-5 rounded border-2 border-current"></div> <span className="text-xs font-bold">Rounded</span>
                                                </button>
                                                <button 
                                                    onClick={() => setQrStudio(p => ({...p, shape: 'circle'}))}
                                                    className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${qrStudio.shape === 'circle' ? 'bg-mini-black text-white border-mini-black' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                                                >
                                                    <Circle size={20} /> <span className="text-xs font-bold">Circle</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={LABEL_STYLE}>Foreground</label>
                                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <input 
                                                        type="color" 
                                                        value={qrStudio.fgColor} 
                                                        onChange={e => setQrStudio({...qrStudio, fgColor: e.target.value})}
                                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                                    />
                                                    <span className="text-xs font-mono">{qrStudio.fgColor}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={LABEL_STYLE}>Background</label>
                                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <input 
                                                        type="color" 
                                                        value={qrStudio.bgColor} 
                                                        onChange={e => setQrStudio({...qrStudio, bgColor: e.target.value})}
                                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                                    />
                                                    <span className="text-xs font-mono">{qrStudio.bgColor}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className={LABEL_STYLE}>Center Logo</label>
                                            <div className="flex items-center gap-2">
                                                <label className="flex-grow cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-slate-50">
                                                    <ImageIcon size={16} /> Upload Logo
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => setQrStudio({...qrStudio, logoUrl: url}))} />
                                                </label>
                                                {qrStudio.logoUrl && (
                                                    <div className="w-12 h-12 relative group">
                                                        <img src={qrStudio.logoUrl} className="w-full h-full object-contain rounded border bg-white" />
                                                        <button onClick={() => setQrStudio({...qrStudio, logoUrl: ''})} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10}/></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className={LABEL_STYLE}>Background Image (Behind QR)</label>
                                            <div className="flex items-center gap-2">
                                                <label className="flex-grow cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-slate-50">
                                                    <Image size={16} /> Upload Background
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => setQrStudio({...qrStudio, bgImageUrl: url}))} />
                                                </label>
                                                {qrStudio.bgImageUrl && (
                                                    <div className="w-12 h-12 relative group">
                                                        <img src={qrStudio.bgImageUrl} className="w-full h-full object-cover rounded border" />
                                                        <button onClick={() => setQrStudio({...qrStudio, bgImageUrl: ''})} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10}/></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* PREVIEW */}
                                    <div className="flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-900 p-8 rounded-xl border border-slate-300 dark:border-slate-600 relative overflow-hidden">
                                        <div 
                                            id="qr-preview-container"
                                            className={`relative p-4 shadow-lg ${getQrContainerStyle()}`}
                                            style={{
                                                backgroundImage: qrStudio.bgImageUrl ? `url(${qrStudio.bgImageUrl})` : 'none',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                backgroundColor: qrStudio.bgImageUrl ? 'transparent' : qrStudio.bgColor
                                            }}
                                        >
                                            <div style={{ position: 'relative', width: 200, height: 200 }}>
                                                <QRCode 
                                                    id="qr-code-studio"
                                                    value={qrStudio.url} 
                                                    size={200}
                                                    fgColor={qrStudio.fgColor}
                                                    bgColor={qrStudio.bgImageUrl ? 'transparent' : qrStudio.bgColor}
                                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                />
                                                {qrStudio.logoUrl && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="bg-white p-1 rounded-full shadow-md w-[50px] h-[50px] flex items-center justify-center overflow-hidden">
                                                            <img src={qrStudio.logoUrl} className="w-full h-full object-contain" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Download not fully implemented due to complexities with SVG to Canvas + CORS images in this sandbox, but button is there for UX completeness */}
                                        <button className="mt-6 text-sm font-bold text-slate-500 flex items-center gap-2 hover:text-mini-black" title="Right click image to save">
                                            <Download size={16} /> Right click to Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                         </div>
                    )}

                    {editorTab === 'hotels' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="flex justify-end">
                                <button onClick={() => addToList('hotel_info', { name: '', address: '', price_single: '', price_double: '', description: '', map_url: '' })} className={`${BUTTON_STYLE} bg-mini-black dark:bg-white text-white dark:text-black`}>+ Add Hotel</button>
                            </div>
                            {((editingEventData.hotel_info as HotelDetails[]) || []).map((hotel, idx) => (
                                <div key={idx} className="border border-slate-200 dark:border-slate-700 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 relative">
                                    <button onClick={() => removeFromList('hotel_info', idx)} className="absolute top-4 right-4 text-red-500"><Trash2 size={20}/></button>
                                    <div className="grid grid-cols-2 gap-4 mb-4 pr-8">
                                        <input value={hotel.name} onChange={e => updateList('hotel_info', idx, 'name', e.target.value)} placeholder="Hotel Name" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
                                        <input value={hotel.address} onChange={e => updateList('hotel_info', idx, 'address', e.target.value)} placeholder="Address" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                        <input value={hotel.price_single} onChange={e => updateList('hotel_info', idx, 'price_single', e.target.value)} placeholder="Price Single (e.g. 1500 SEK)" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                        <input value={hotel.price_double} onChange={e => updateList('hotel_info', idx, 'price_double', e.target.value)} placeholder="Price Double" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                        <input value={hotel.map_url} onChange={e => updateList('hotel_info', idx, 'map_url', e.target.value)} placeholder="Map URL" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 col-span-2" />
                                    </div>
                                    <textarea value={hotel.description} onChange={e => updateList('hotel_info', idx, 'description', e.target.value)} placeholder="Description..." className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 mb-4" rows={3}/>
                                    
                                    <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-900 p-2 rounded-lg mb-4">
                                        <input value={hotel.contact?.name || ''} onChange={e => updateList('hotel_info', idx, 'contact.name', e.target.value)} placeholder="Contact Name" className="text-sm bg-transparent border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200" />
                                        <input value={hotel.contact?.email || ''} onChange={e => updateList('hotel_info', idx, 'contact.email', e.target.value)} placeholder="Contact Email" className="text-sm bg-transparent border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200" />
                                        <input value={hotel.contact?.phone || ''} onChange={e => updateList('hotel_info', idx, 'contact.phone', e.target.value)} placeholder="Contact Phone" className="text-sm bg-transparent border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200" />
                                    </div>

                                    <div className="flex items-center gap-4">
                                         {hotel.image_url && <img src={hotel.image_url} className="h-16 w-16 object-cover rounded bg-white dark:bg-slate-900 border" />}
                                         <label className="cursor-pointer text-sm text-blue-600 hover:underline">
                                             Upload Photo
                                             <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => updateList('hotel_info', idx, 'image_url', url))} />
                                         </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {editorTab === 'parking' && (
                         <div className="space-y-6 animate-in fade-in">
                            <div className="flex justify-end">
                                <button onClick={() => addToList('parking_info', { location: '', cost: '', security_info: '' })} className={`${BUTTON_STYLE} bg-mini-black dark:bg-white text-white dark:text-black`}>+ Add Parking</button>
                            </div>
                             {((editingEventData.parking_info as ParkingDetails[]) || []).map((park, idx) => (
                                <div key={idx} className="border border-slate-200 dark:border-slate-700 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 relative">
                                    <button onClick={() => removeFromList('parking_info', idx)} className="absolute top-4 right-4 text-red-500"><Trash2 size={20}/></button>
                                    <div className="grid grid-cols-2 gap-4 mb-4 pr-8">
                                        <input value={park.location} onChange={e => updateList('parking_info', idx, 'location', e.target.value)} placeholder="Location Name" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
                                        <input value={park.cost} onChange={e => updateList('parking_info', idx, 'cost', e.target.value)} placeholder="Cost" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                        <input value={park.security_info} onChange={e => updateList('parking_info', idx, 'security_info', e.target.value)} placeholder="Security Info" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 col-span-2" />
                                        <input value={park.map_url || ''} onChange={e => updateList('parking_info', idx, 'map_url', e.target.value)} placeholder="Map URL" className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 col-span-2" />
                                    </div>
                                    
                                    {/* App Providers */}
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">Available Apps</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {['EasyPark', 'Parkster', 'Mobill'].map(app => {
                                                const isActive = park.apps?.some(a => a.label === app);
                                                return (
                                                    <button 
                                                        key={app}
                                                        onClick={() => toggleParkingApp(idx, app)}
                                                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                                                            isActive 
                                                            ? 'bg-mini-red text-white border-mini-red' 
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        {app}
                                                    </button>
                                                )
                                            })}
                                            {/* Custom Apps Display */}
                                            {park.apps?.filter(a => !['EasyPark', 'Parkster', 'Mobill'].includes(a.label)).map(app => (
                                                <div key={app.label} className="px-3 py-1 rounded-full text-xs font-bold border border-blue-500 bg-blue-50 text-blue-700 flex items-center gap-1">
                                                    {app.label}
                                                    <button onClick={() => toggleParkingApp(idx, app.label)} className="hover:text-red-500"><X size={10}/></button>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Add Custom App Input */}
                                        <div className="flex gap-2">
                                            <input 
                                                placeholder="Custom App Name..." 
                                                className="flex-grow p-1 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                                value={customAppName}
                                                onChange={e => setCustomAppName(e.target.value)}
                                                onKeyDown={e => {
                                                    if(e.key === 'Enter' && customAppName) {
                                                        toggleParkingApp(idx, customAppName);
                                                        setCustomAppName('');
                                                    }
                                                }}
                                            />
                                            <button 
                                                onClick={() => {
                                                    if(customAppName) {
                                                        toggleParkingApp(idx, customAppName);
                                                        setCustomAppName('');
                                                    }
                                                }}
                                                className="bg-slate-200 dark:bg-slate-700 px-2 rounded text-xs font-bold"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                             ))}
                         </div>
                    )}

                    {editorTab === 'preview' && (
                        <div className="border-4 border-slate-900 rounded-[2rem] overflow-hidden bg-white max-w-sm mx-auto shadow-2xl scale-90 origin-top">
                             <div className="bg-slate-900 text-white p-4 text-center text-xs font-bold">PREVIEW MODE</div>
                             <div className="h-[600px] overflow-y-auto">
                                 <img src={editingEventData.cover_image_url || 'https://picsum.photos/400/300'} className="w-full h-40 object-cover" />
                                 <div className="p-4">
                                     <h1 className="text-xl font-bold mb-1">{editingEventData.title || 'Untitled Event'}</h1>
                                     <p className="text-xs text-slate-500 mb-4">{editingEventData.date} • {editingEventData.location_name}</p>
                                     <p className="text-sm text-slate-700 whitespace-pre-line">{editingEventData.description}</p>
                                     
                                     <div className="mt-4 space-y-2">
                                         {/* Mock Buttons for preview */}
                                         {(editingEventData.hotel_info as any[])?.length > 0 && <div className="p-3 bg-slate-100 rounded-lg text-sm font-bold flex items-center gap-2"><Building2 size={16}/> Hotels</div>}
                                         {(editingEventData.parking_info as any[])?.length > 0 && <div className="p-3 bg-slate-100 rounded-lg text-sm font-bold flex items-center gap-2"><Car size={16}/> Parking</div>}
                                         {(editingEventData.extra_info as any[])?.length > 0 && <div className="p-3 bg-slate-100 rounded-lg text-sm font-bold flex items-center gap-2"><Star size={16}/> Extras</div>}
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
                   {/* 1. OVERVIEW TAB */}
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
                    
                    {/* 2. REGISTRATIONS TAB */}
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
                                <div className="animate-in fade-in slide-in-from-right-4">
                                    <button onClick={() => setSelectedEventId(null)} className="mb-6 text-sm font-bold flex items-center gap-2 text-slate-500 hover:text-mini-black"><ArrowLeft size={16}/> Back to Events</button>
                                    
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                        <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-800">
                                            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-sm uppercase tracking-wider mb-2">
                                                <TrendingUp size={16} /> Total Income
                                            </div>
                                            <div className="text-3xl font-black text-green-800 dark:text-green-300">{financialStats.income.toLocaleString()} SEK</div>
                                        </div>
                                        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800">
                                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm uppercase tracking-wider mb-2">
                                                <TrendingDown size={16} /> Total Expenses
                                            </div>
                                            <div className="text-3xl font-black text-red-800 dark:text-red-300">{financialStats.expense.toLocaleString()} SEK</div>
                                        </div>
                                        <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-sm uppercase tracking-wider mb-2">
                                                <Wallet size={16} /> Net Result
                                            </div>
                                            <div className={`text-3xl font-black ${financialStats.net >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                                                {financialStats.net.toLocaleString()} SEK
                                            </div>
                                        </div>
                                    </div>

                                    {/* Toolbar */}
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-xl">Transactions</h3>
                                        <button 
                                            onClick={() => {
                                                setEditingTransaction({ type: 'expense', date: new Date().toISOString().split('T')[0], amount: 0, description: '', category: '' });
                                                setShowTransactionModal(true);
                                            }}
                                            className="bg-mini-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"
                                        >
                                            <Plus size={16} /> Add Transaction
                                        </button>
                                    </div>

                                    {/* Table */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="p-4 font-bold text-slate-500">Date</th>
                                                    <th className="p-4 font-bold text-slate-500">Description</th>
                                                    <th className="p-4 font-bold text-slate-500">Category</th>
                                                    <th className="p-4 font-bold text-slate-500 text-right">Amount</th>
                                                    <th className="p-4 font-bold text-slate-500 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {transactions.map(tx => (
                                                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                        <td className="p-4 whitespace-nowrap">{tx.date}</td>
                                                        <td className="p-4 font-medium">{tx.description}</td>
                                                        <td className="p-4">
                                                            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-xs font-bold uppercase">{tx.category || 'General'}</span>
                                                        </td>
                                                        <td className={`p-4 text-right font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {tx.type === 'income' ? '+' : '-'} {Number(tx.amount).toLocaleString()}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => { setEditingTransaction(tx); setShowTransactionModal(true); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><Edit3 size={16}/></button>
                                                                <button onClick={() => handleDeleteTransaction(tx.id)} className="p-2 hover:bg-red-100 hover:text-red-600 rounded"><Trash2 size={16}/></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {transactions.length === 0 && (
                                                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No transactions added yet.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* 4. SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <div className="space-y-8">
                            <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Settings & Users</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* SYSTEM SECTION */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Lock size={14} /> Access Control</h3>
                                    
                                    <ToggleSwitch 
                                        label="Public Registration" 
                                        description="Allow new users to sign up freely."
                                        checked={appSettings.public_registration === 'true'}
                                        onChange={() => handleToggleSetting('public_registration')}
                                        icon={UserPlus}
                                    />

                                    <ToggleSwitch 
                                        label="Maintenance Mode" 
                                        description="Display 'Under Construction' to non-admins."
                                        checked={appSettings.maintenance_mode === 'true'}
                                        onChange={() => handleToggleSetting('maintenance_mode')}
                                        icon={AlertTriangle}
                                    />
                                    
                                     {session?.user.email === MASTER_ADMIN_EMAIL && (
                                        <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <label className={LABEL_STYLE}>Admin Auto-Logout (Hours)</label>
                                            <div className="flex gap-4">
                                                <input 
                                                    type="number" 
                                                    value={appSettings.auto_logout_hours}
                                                    onChange={(e) => setAppSettings(prev => ({...prev, auto_logout_hours: e.target.value}))}
                                                    className={INPUT_STYLE}
                                                />
                                                <button 
                                                    onClick={() => handleSaveSettings('auto_logout_hours', appSettings.auto_logout_hours)}
                                                    className="bg-mini-black dark:bg-white text-white dark:text-black px-6 rounded-xl font-bold whitespace-nowrap"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* FEATURES SECTION */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Star size={14} /> Features</h3>
                                    
                                    <ToggleSwitch 
                                        label="Member Gallery Uploads" 
                                        description="Allow members to upload photos to event galleries."
                                        checked={appSettings.allow_member_uploads === 'true'}
                                        onChange={() => handleToggleSetting('allow_member_uploads')}
                                        icon={Image}
                                    />

                                    <ToggleSwitch 
                                        label="Automatic Waitlists" 
                                        description="Enable waitlists for full events automatically."
                                        checked={appSettings.enable_waitlist === 'true'}
                                        onChange={() => handleToggleSetting('enable_waitlist')}
                                        icon={List}
                                    />

                                    <ToggleSwitch 
                                        label="Beta Features" 
                                        description="Enable experimental UI components for testing."
                                        checked={appSettings.beta_features === 'true'}
                                        onChange={() => handleToggleSetting('beta_features')}
                                        icon={TestTube}
                                    />
                                </div>
                            </div>
                            
                            {settingsStatus && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg font-bold flex items-center gap-2"
                                >
                                    <CheckCircle size={20} /> {settingsStatus}
                                </motion.div>
                            )}
                        </div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>
        </div>
      </div>

      {/* TRANSACTION MODAL */}
      <Modal isOpen={showTransactionModal} onClose={() => setShowTransactionModal(false)} title={editingTransaction.id ? 'Edit Transaction' : 'New Transaction'}>
          <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className={LABEL_STYLE}>Type</label>
                      <div className="flex gap-2">
                          <button type="button" onClick={() => setEditingTransaction({...editingTransaction, type: 'income'})} className={`flex-1 py-3 rounded-xl font-bold border-2 ${editingTransaction.type === 'income' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200'}`}>Income</button>
                          <button type="button" onClick={() => setEditingTransaction({...editingTransaction, type: 'expense'})} className={`flex-1 py-3 rounded-xl font-bold border-2 ${editingTransaction.type === 'expense' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200'}`}>Expense</button>
                      </div>
                  </div>
                  <div>
                      <label className={LABEL_STYLE}>Amount</label>
                      <input type="number" step="0.01" required value={editingTransaction.amount} onChange={e => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value)})} className={INPUT_STYLE} />
                  </div>
              </div>
              <div>
                  <label className={LABEL_STYLE}>Date</label>
                  <input type="date" required value={editingTransaction.date} onChange={e => setEditingTransaction({...editingTransaction, date: e.target.value})} className={INPUT_STYLE} />
              </div>
              <div>
                  <label className={LABEL_STYLE}>Description</label>
                  <input type="text" required value={editingTransaction.description} onChange={e => setEditingTransaction({...editingTransaction, description: e.target.value})} className={INPUT_STYLE} placeholder="e.g. Catering Deposit" />
              </div>
              <div>
                  <label className={LABEL_STYLE}>Category</label>
                  <input type="text" value={editingTransaction.category} onChange={e => setEditingTransaction({...editingTransaction, category: e.target.value})} className={INPUT_STYLE} placeholder="e.g. Food, Venue, Merch" />
              </div>
              <button type="submit" className="w-full py-4 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-lg mt-4">Save Transaction</button>
          </form>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
