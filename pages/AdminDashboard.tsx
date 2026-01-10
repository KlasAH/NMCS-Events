
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, DollarSign, Users, Settings, Star, ToggleLeft, ToggleRight, Save, Search, Edit3, ArrowLeft, Lock, CheckCircle, AlertCircle, Mail, UserCog, HelpCircle, X, Trash2, Image, LogOut, Bug, RefreshCw, MapPin, Building2, Car, Link as LinkIcon, Utensils, Flag, Map } from 'lucide-react';
import { Registration, Transaction, Meeting, ExtraInfoSection, LinkItem, HotelDetails, ParkingDetails } from '../types';
import { supabase, isDemoMode, finalUrl, finalKey } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { createClient } from '@supabase/supabase-js';

const AdminDashboard: React.FC = () => {
  const { isAdmin, loading, session, signOut, updatePassword, sendPasswordReset, authStatus, checkAdmin } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'finances' | 'settings'>('overview');
  
  // Selection State
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Data State
  const [events, setEvents] = useState<Meeting[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<any[]>([]); 
  const [regFilter, setRegFilter] = useState('');

  // Password Update State
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [adminResetEmail, setAdminResetEmail] = useState('');

  // Editing State
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editingEventData, setEditingEventData] = useState<Partial<Meeting>>({});

  // Debug State
  const [diagLog, setDiagLog] = useState<string>('');

  // --- DATA LOADING ---
  useEffect(() => {
    if (!isAdmin && !isDemoMode) return;

    // 1. Fetch Events (Overview)
    const fetchEvents = async () => {
        if(isDemoMode) {
             setEvents([
                {id: '1', title: 'Alpine Grand Tour 2024 (Demo)', date: '2024-06-15', created_at: '', description: 'Description here', location_name: 'Swiss Alps', cover_image_url: ''},
                {id: '2', title: 'Sunday Coffee Run', date: '2024-04-20', created_at: '', description: '', location_name: '', cover_image_url: ''},
            ]);
            return;
        }
        const { data, error } = await supabase.from('meetings').select('*').order('date', {ascending: false});
        if(data) setEvents(data);
        if(error) console.error("Error fetching events:", error);
    };

    fetchEvents();
  }, [isAdmin]);

  // 2. Fetch Details for Selected Event (Registrations/Finances)
  useEffect(() => {
      const fetchData = async () => {
          if (!selectedEventId) return;

          if (isDemoMode) {
              // Mock Data
              setRegistrations([
                  { id: '1', meeting_id: selectedEventId, full_name: 'Demo Driver', forum_name: 'FastLane', email: 'demo@test.com', phone: '123', car_type: 'R53', status: 'confirmed', registered_at: new Date().toISOString() }
              ]);
              return;
          }

          if (activeTab === 'registrations') {
              const { data, error } = await supabase
                .from('registrations')
                .select('*')
                .eq('meeting_id', selectedEventId)
                .order('registered_at', { ascending: false });
              
              if (data) setRegistrations(data);
              if (error) console.error("Error fetching registrations:", error);
          } 
          
          if (activeTab === 'finances') {
              const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('meeting_id', selectedEventId)
                .order('date', { ascending: false });

              if (data) setTransactions(data);
              if (error) console.error("Error fetching transactions:", error);
          }
      };

      fetchData();
  }, [selectedEventId, activeTab, isAdmin]);

  // 3. Fetch Users (Settings Tab)
  useEffect(() => {
      if (activeTab === 'settings' && !isDemoMode && isAdmin) {
        const fetchUsers = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (data) setUsers(data);
            if (error) console.error("Error fetching users:", error);
        }
        fetchUsers();
    }
  }, [activeTab, isAdmin]);

  // DIAGNOSTICS HANDLER
  const runDiagnostics = async () => {
      setDiagLog('Starting Diagnostics...\n');
      
      try {
          // 1. Check Global Client
          setDiagLog(p => p + '1. Checking Global Client (Public Table)...\n');
          const { data: globalData, error: globalError } = await supabase.from('connection_tests').select('id').limit(1);
          if (globalError) setDiagLog(p => p + `❌ Global Client Error: ${globalError.message}\n`);
          else setDiagLog(p => p + `✅ Global Client Connected. Rows: ${globalData?.length}\n`);

          // 2. Check Scoped Client (Profile)
          setDiagLog(p => p + '2. Checking Profile (Scoped Client)...\n');
          if (session) {
              // FIX: Disable persistence for diagnostic client to prevent conflicts
              const scopedClient = createClient(finalUrl, finalKey, {
                  global: { headers: { Authorization: `Bearer ${session.access_token}` } },
                  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
              });
              
              const { data: profileData, error: profileError } = await scopedClient
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();

              if (profileError) {
                  setDiagLog(p => p + `❌ Profile Fetch Error: ${profileError.message}\n`);
              } else {
                  setDiagLog(p => p + `✅ Profile Found!\nRole: "${profileData.role}"\nEmail: ${profileData.email}\n`);
                  if (profileData.role === 'admin' || profileData.role === 'board') {
                       setDiagLog(p => p + `✅ Role is valid for Admin Access.\n`);
                  } else {
                       setDiagLog(p => p + `❌ Role '${profileData.role}' is NOT 'admin' or 'board'. Access denied.\n`);
                  }
              }
          } else {
              setDiagLog(p => p + '❌ No Session found.\n');
          }

      } catch (err: any) {
          setDiagLog(p => p + `💥 CRITICAL ERROR: ${err.message}\n`);
      }
  };


  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-pulse text-slate-400">Loading...</div></div>;
  
  // 1. Not Logged In
  if (!session) return <Navigate to="/login" replace />;

  // 2. Logged In, but Not Admin/Board
  if (!isAdmin) {
      return (
        <div className="min-h-screen pt-32 px-4 bg-slate-50 dark:bg-slate-950 flex flex-col items-center text-center transition-colors">
             <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-xl w-full bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-red-100 dark:border-red-900/30"
             >
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 text-mini-red">
                    <Lock size={32} />
                </div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Restricted Access</h1>
                <p className="text-slate-600 dark:text-slate-300 mb-6 text-lg">
                    This dashboard is reserved for <span className="font-bold text-mini-black dark:text-white">NMCS Board Members</span>.
                </p>

                {/* DEBUG INFO FOR USER */}
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl mb-6 text-left border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Bug size={14} /> Debug Information
                    </h4>
                    <div className="space-y-1 font-mono text-xs text-slate-700 dark:text-slate-300 break-all">
                        <p><strong>Status:</strong> <span className={authStatus.includes('Granted') ? "text-green-600 font-bold" : "text-red-500 font-bold"}>{authStatus}</span></p>
                        <p><strong>User ID:</strong> {session.user.id}</p>
                        <p><strong>Email:</strong> {session.user.email}</p>
                        
                        <div className="pt-3 pb-3">
                            <button 
                                onClick={runDiagnostics}
                                className="flex items-center gap-2 text-white bg-slate-500 hover:bg-slate-600 px-3 py-1 rounded text-xs font-bold transition-colors"
                            >
                                <RefreshCw size={10} /> Run Diagnostics Check
                            </button>
                        </div>
                        
                        {diagLog && (
                            <div className="p-3 bg-black text-green-400 rounded-lg text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto border border-slate-700">
                                {diagLog}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                        onClick={() => checkAdmin(session)}
                        className="px-6 py-3 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg"
                    >
                        Check Access Again
                    </button>
                    <button 
                        onClick={signOut}
                        className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut size={18} /> Log Out
                    </button>
                </div>
             </motion.div>
        </div>
      );
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < 6) {
          alert("Password must be at least 6 characters");
          return;
      }
      const { error } = await updatePassword(newPassword);
      if (error) {
          setPasswordStatus('error');
      } else {
          setPasswordStatus('success');
          setNewPassword('');
          setTimeout(() => setPasswordStatus('idle'), 3000);
      }
  }

  const handleAdminResetForUser = async (userEmail: string) => {
      const confirm = window.confirm(`Send password reset link to ${userEmail}?`);
      if (!confirm) return;

      const { error } = await sendPasswordReset(userEmail);
      if (error) {
          alert("Error sending email: " + error.message);
      } else {
          alert("Reset link sent successfully to " + userEmail);
      }
  }

  // --- EDITOR LOGIC ---

  const startEditEvent = (evt?: Meeting) => {
      if(evt) {
          setEditingEventData(evt);
      } else {
          // Initialize with empty structures for nested objects to avoid undefined errors
          setEditingEventData({
              title: '',
              date: new Date().toISOString().split('T')[0],
              description: '',
              location_name: '',
              cover_image_url: '',
              maps_config: [], // Initialize array
              hotel_info: { 
                  name: '', address: '', map_url: '', price_single: '', price_double: '', description: '', booking_links: [] 
              },
              parking_info: { 
                  location: '', cost: '', security_info: '', apps: [], map_url: '' 
              },
              extra_info: []
          });
      }
      setIsEditingEvent(true);
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStart = e.target.value;
      
      // Auto-calculate end date (start + 2 days)
      let newEnd = '';
      if (newStart) {
          const d = new Date(newStart);
          d.setDate(d.getDate() + 2);
          newEnd = d.toISOString().split('T')[0];
      }

      setEditingEventData({
          ...editingEventData,
          date: newStart,
          end_date: newEnd
      });
  };

  // Helper to handle nested object updates safely
  const updateHotelField = (field: keyof HotelDetails, value: any) => {
      setEditingEventData(prev => ({
          ...prev,
          hotel_info: {
              ...(prev.hotel_info || { name: '', address: '', map_url: '', price_single: '', price_double: '', description: '' }),
              [field]: value
          }
      }));
  };

  const updateParkingField = (field: keyof ParkingDetails, value: any) => {
      setEditingEventData(prev => ({
          ...prev,
          parking_info: {
              ...(prev.parking_info || { location: '', cost: '', security_info: '' }),
              [field]: value
          }
      }));
  };

  const updateMapLink = (url: string) => {
      // Maps config is an array. We treat the first item as the "Main Location Link"
      const currentMaps = [...(editingEventData.maps_config || [])];
      if (currentMaps.length === 0) {
          currentMaps.push({ label: 'Main Location', url: url, groupName: 'General' });
      } else {
          currentMaps[0] = { ...currentMaps[0], url: url };
      }
      setEditingEventData({ ...editingEventData, maps_config: currentMaps });
  };
  
  const getMainMapLink = () => {
      return editingEventData.maps_config?.[0]?.url || '';
  };

  const updateBookingLink = (url: string) => {
    // Hotel booking links is an array. We update/create the first item.
    const currentInfo = editingEventData.hotel_info || { name: '', address: '', map_url: '', price_single: '', price_double: '', description: '' };
    const currentLinks = [...(currentInfo.booking_links || [])];
    
    if (currentLinks.length === 0) {
        currentLinks.push({ label: 'Book Now', url: url });
    } else {
        currentLinks[0] = { ...currentLinks[0], url: url };
    }
    
    setEditingEventData(prev => ({
        ...prev,
        hotel_info: { ...currentInfo, booking_links: currentLinks }
    }));
  };

  const getBookingLink = () => {
      return editingEventData.hotel_info?.booking_links?.[0]?.url || '';
  };

  const updateExtraInfo = (index: number, field: keyof ExtraInfoSection, value: any) => {
      const newExtra = [...(editingEventData.extra_info || [])];
      newExtra[index] = { ...newExtra[index], [field]: value };
      setEditingEventData({...editingEventData, extra_info: newExtra});
  }

  const addExtraInfo = (type: 'food' | 'racing' | 'roadtrip' | 'general') => {
      const newExtra: ExtraInfoSection = {
          id: `new-${Date.now()}`,
          type: type,
          title: type === 'food' ? 'Food & Dining' : type === 'racing' ? 'Racing Track Info' : 'New Section',
          icon: type === 'food' ? 'utensils' : type === 'racing' ? 'flag' : type === 'roadtrip' ? 'map' : 'info',
          content: '',
      };
      setEditingEventData({...editingEventData, extra_info: [...(editingEventData.extra_info || []), newExtra]});
  }

  const removeExtraInfo = (index: number) => {
      const newExtra = [...(editingEventData.extra_info || [])];
      newExtra.splice(index, 1);
      setEditingEventData({...editingEventData, extra_info: newExtra});
  }

  const saveEvent = async () => {
      if (isDemoMode) {
          alert("Mock Event Saved!");
          setIsEditingEvent(false);
          return;
      }

      // Prepare payload
      const payload = { ...editingEventData };
      delete payload.id; // Allow supabase to generate or handle ID
      delete payload.created_at;

      let error;
      if (editingEventData.id) {
          // Update
          const { error: err } = await supabase.from('meetings').update(payload).eq('id', editingEventData.id);
          error = err;
      } else {
          // Insert
          const { error: err } = await supabase.from('meetings').insert([payload]);
          error = err;
      }

      if (error) {
          alert("Error saving event: " + error.message);
      } else {
          // Refresh list
          const { data } = await supabase.from('meetings').select('*').order('date', {ascending: false});
          if(data) setEvents(data);
          setIsEditingEvent(false);
      }
  }

  const filteredRegistrations = registrations.filter(r => 
    r.full_name.toLowerCase().includes(regFilter.toLowerCase()) || 
    r.forum_name.toLowerCase().includes(regFilter.toLowerCase()) ||
    r.email.toLowerCase().includes(regFilter.toLowerCase()) ||
    (r.car_type && r.car_type.toLowerCase().includes(regFilter.toLowerCase()))
  );

  const calculateFinancials = () => {
      const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return { income, expense, net: income - expense };
  };

  const financials = calculateFinancials();

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
                    { id: 'settings', label: 'Settings & Users', icon: Settings },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id as any);
                            setSelectedEventId(null); // Reset selection on tab change
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

        {/* Main Content Area */}
        <div className={isEditingEvent ? "col-span-4" : "md:col-span-3"}>
            <AnimatePresence mode='wait'>
            {isEditingEvent ? (
                <motion.div
                    key="editor"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {editingEventData.id ? 'Edit Event' : 'New Event'}
                        </h2>
                        <button onClick={() => setIsEditingEvent(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                            <X size={24} className="text-slate-500" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                        {/* LEFT COLUMN: BASIC INFO & MAPS */}
                        <div className="space-y-6">
                            <h3 className="font-bold text-mini-red flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <Star size={18} /> Basic Info
                            </h3>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Event Title</label>
                                <input 
                                    type="text" 
                                    value={editingEventData.title || ''}
                                    onChange={(e) => setEditingEventData({...editingEventData, title: e.target.value})}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                                    <input 
                                        type="date" 
                                        value={editingEventData.date || ''}
                                        onChange={handleStartDateChange}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                                    <input 
                                        type="date" 
                                        value={editingEventData.end_date || ''}
                                        onChange={(e) => setEditingEventData({...editingEventData, end_date: e.target.value})}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Location Name</label>
                                    <input 
                                        type="text" 
                                        value={editingEventData.location_name || ''}
                                        onChange={(e) => setEditingEventData({...editingEventData, location_name: e.target.value})}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Google Maps Link</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={getMainMapLink()}
                                            onChange={(e) => updateMapLink(e.target.value)}
                                            placeholder="https://maps.google.com/..."
                                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                        />
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                                <textarea 
                                    rows={4}
                                    value={editingEventData.description || ''}
                                    onChange={(e) => setEditingEventData({...editingEventData, description: e.target.value})}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Cover Image URL</label>
                                <div className="flex gap-2 items-start">
                                    <input 
                                        type="text" 
                                        value={editingEventData.cover_image_url || ''}
                                        onChange={(e) => setEditingEventData({...editingEventData, cover_image_url: e.target.value})}
                                        className="flex-grow px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                </div>
                                {editingEventData.cover_image_url && (
                                    <div className="mt-2 h-32 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                        <img src={editingEventData.cover_image_url} alt="Cover Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>

                            {/* HOTEL SECTION */}
                            <h3 className="font-bold text-mini-red flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mt-8">
                                <Building2 size={18} /> Hotel Details
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Hotel Name</label>
                                    <input 
                                        type="text" 
                                        value={editingEventData.hotel_info?.name || ''}
                                        onChange={(e) => updateHotelField('name', e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Single Price</label>
                                        <input 
                                            type="text" 
                                            value={editingEventData.hotel_info?.price_single || ''}
                                            onChange={(e) => updateHotelField('price_single', e.target.value)}
                                            placeholder="1500 SEK"
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Double Price</label>
                                        <input 
                                            type="text" 
                                            value={editingEventData.hotel_info?.price_double || ''}
                                            onChange={(e) => updateHotelField('price_double', e.target.value)}
                                            placeholder="2000 SEK"
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Address</label>
                                    <input 
                                        type="text" 
                                        value={editingEventData.hotel_info?.address || ''}
                                        onChange={(e) => updateHotelField('address', e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                                    <textarea 
                                        rows={3}
                                        value={editingEventData.hotel_info?.description || ''}
                                        onChange={(e) => updateHotelField('description', e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Booking Link</label>
                                        <input 
                                            type="text" 
                                            value={getBookingLink()}
                                            onChange={(e) => updateBookingLink(e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                        />
                                    </div>
                                     <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Map Link</label>
                                        <input 
                                            type="text" 
                                            value={editingEventData.hotel_info?.map_url || ''}
                                            onChange={(e) => updateHotelField('map_url', e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Hotel Image URL</label>
                                    <input 
                                        type="text" 
                                        value={editingEventData.hotel_info?.image_url || ''}
                                        onChange={(e) => updateHotelField('image_url', e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                    {editingEventData.hotel_info?.image_url && (
                                        <div className="mt-2 h-24 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                            <img src={editingEventData.hotel_info.image_url} alt="Hotel Preview" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: PARKING & EXTRAS */}
                        <div className="space-y-6">
                            {/* PARKING */}
                            <h3 className="font-bold text-mini-red flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <Car size={18} /> Parking Details
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Parking Location / Name</label>
                                    <input 
                                        type="text" 
                                        value={editingEventData.parking_info?.location || ''}
                                        onChange={(e) => updateParkingField('location', e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Cost</label>
                                        <input 
                                            type="text" 
                                            value={editingEventData.parking_info?.cost || ''}
                                            onChange={(e) => updateParkingField('cost', e.target.value)}
                                            placeholder="Included / 200 SEK"
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Map Link</label>
                                        <input 
                                            type="text" 
                                            value={editingEventData.parking_info?.map_url || ''}
                                            onChange={(e) => updateParkingField('map_url', e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Security / Access Info</label>
                                    <textarea
                                        rows={2} 
                                        value={editingEventData.parking_info?.security_info || ''}
                                        onChange={(e) => updateParkingField('security_info', e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Parking Image URL</label>
                                    <input 
                                        type="text" 
                                        value={editingEventData.parking_info?.image_url || ''}
                                        onChange={(e) => updateParkingField('image_url', e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-mini-red"
                                    />
                                    {editingEventData.parking_info?.image_url && (
                                        <div className="mt-2 h-24 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                            <img src={editingEventData.parking_info.image_url} alt="Parking Preview" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* EXTRA INFO */}
                            <h3 className="font-bold text-mini-red flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mt-8">
                                <Plus size={18} /> Extra Info Sections
                            </h3>
                            <div className="space-y-4">
                                {editingEventData.extra_info?.map((extra, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 relative group">
                                        <button 
                                            onClick={() => removeExtraInfo(idx)}
                                            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        
                                        <div className="flex items-center gap-2 mb-3">
                                            {extra.type === 'food' && <Utensils className="text-orange-500" size={20} />}
                                            {extra.type === 'racing' && <Flag className="text-red-500" size={20} />}
                                            {extra.type === 'roadtrip' && <Map className="text-blue-500" size={20} />}
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{extra.type}</span>
                                        </div>

                                        <div className="space-y-3">
                                            <input 
                                                type="text" 
                                                value={extra.title}
                                                onChange={(e) => updateExtraInfo(idx, 'title', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold"
                                                placeholder="Section Title"
                                            />
                                            <textarea 
                                                rows={2}
                                                value={extra.content}
                                                onChange={(e) => updateExtraInfo(idx, 'content', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                                                placeholder="Content description..."
                                            />
                                            <input 
                                                type="text" 
                                                value={extra.image_url || ''}
                                                onChange={(e) => updateExtraInfo(idx, 'image_url', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                                                placeholder="Image URL"
                                            />
                                            {extra.image_url && (
                                                <div className="h-16 w-full rounded-lg overflow-hidden">
                                                    <img src={extra.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <div className="flex gap-2 justify-center pt-2">
                                    <button onClick={() => addExtraInfo('food')} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold hover:bg-orange-200">+ Food</button>
                                    <button onClick={() => addExtraInfo('racing')} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold hover:bg-red-200">+ Racing</button>
                                    <button onClick={() => addExtraInfo('roadtrip')} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold hover:bg-blue-200">+ Road Trip</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
                        <button 
                            onClick={() => setIsEditingEvent(false)}
                            className="px-6 py-2 rounded-lg font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={saveEvent}
                            className="px-8 py-2 bg-mini-red text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 dark:shadow-none"
                        >
                            Save Event
                        </button>
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
                            {events.length === 0 ? <p className="text-slate-400">No events found.</p> : events.map((evt) => (
                                <div key={evt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors gap-4">
                                    <div className="flex items-center gap-4">
                                        {evt.cover_image_url && (
                                            <img src={evt.cover_image_url} alt="thumb" className="w-16 h-12 rounded-lg object-cover hidden sm:block" />
                                        )}
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white text-lg">{evt.title}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{evt.date} | {evt.location_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => startEditEvent(evt)}
                                            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-mini-black dark:bg-white text-white dark:text-black font-medium hover:opacity-90"
                                        >
                                            <Edit3 size={16} /> Edit
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 2. REGISTRATIONS TAB */}
                    {activeTab === 'registrations' && (
                        <div className="space-y-6">
                            {!selectedEventId ? (
                                <>
                                    <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Select an Event to View Registrations</h2>
                                    <div className="grid grid-cols-1 gap-4">
                                        {events.map(evt => (
                                            <button 
                                                key={evt.id} 
                                                onClick={() => setSelectedEventId(evt.id)}
                                                className="text-left p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-mini-red hover:shadow-lg transition-all"
                                            >
                                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{evt.title}</h3>
                                                <span className="text-sm text-slate-500">{evt.date}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-4 mb-6">
                                        <button onClick={() => setSelectedEventId(null)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300"/>
                                        </button>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registrations</h2>
                                            <p className="text-xs text-slate-500">Managing list for {events.find(e => e.id === selectedEventId)?.title}</p>
                                        </div>
                                    </div>

                                    {/* Filter Bar */}
                                    <div className="relative mb-6">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="text" 
                                            placeholder="Search by name, car type, or email..." 
                                            value={regFilter}
                                            onChange={(e) => setRegFilter(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-mini-red"
                                        />
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                                    <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Full Name</th>
                                                    <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Forum Name</th>
                                                    <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Car</th>
                                                    <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Email</th>
                                                    <th className="p-3 text-sm font-bold text-slate-500 dark:text-slate-400">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredRegistrations.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-slate-500">No registrations found.</td></tr> :
                                                filteredRegistrations.map((reg) => (
                                                    <tr key={reg.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="p-3 font-medium text-slate-900 dark:text-white">{reg.full_name}</td>
                                                        <td className="p-3 text-slate-600 dark:text-slate-300">{reg.forum_name}</td>
                                                        <td className="p-3 text-slate-600 dark:text-slate-300">
                                                            {reg.car_type && <span className="inline-block bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-bold">{reg.car_type}</span>}
                                                        </td>
                                                        <td className="p-3 text-slate-600 dark:text-slate-300">{reg.email}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                                reg.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                                                                reg.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                                {reg.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* 3. FINANCES TAB */}
                    {activeTab === 'finances' && (
                        <div className="space-y-6">
                             {!selectedEventId ? (
                                <>
                                    <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Select an Event to View Finances</h2>
                                    <div className="grid grid-cols-1 gap-4">
                                        {events.map(evt => (
                                            <button 
                                                key={evt.id} 
                                                onClick={() => setSelectedEventId(evt.id)}
                                                className="text-left p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-mini-red hover:shadow-lg transition-all"
                                            >
                                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{evt.title}</h3>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-4 mb-6">
                                        <button onClick={() => setSelectedEventId(null)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300"/>
                                        </button>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Finances</h2>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                                            <p className="text-xs text-green-700 dark:text-green-400 font-bold uppercase">Income</p>
                                            <p className="text-2xl font-black text-green-900 dark:text-green-100">${financials.income.toFixed(2)}</p>
                                        </div>
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                                            <p className="text-xs text-red-700 dark:text-red-400 font-bold uppercase">Expenses</p>
                                            <p className="text-2xl font-black text-red-900 dark:text-red-100">${financials.expense.toFixed(2)}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-500 font-bold uppercase">Net Result</p>
                                            <p className={`text-2xl font-black ${financials.net >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600'}`}>${financials.net.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    {/* Transactions List */}
                                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Recent Transactions</h4>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                        {transactions.map(t => (
                                            <div key={t.id} className="p-3 border-b border-slate-200 dark:border-slate-700 last:border-0 flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{t.description}</p>
                                                    <p className="text-xs text-slate-500">{t.date} | {t.category}</p>
                                                </div>
                                                <span className={`font-mono font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {t.type === 'income' ? '+' : '-'}${t.amount}
                                                </span>
                                            </div>
                                        ))}
                                        {transactions.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">No transactions recorded.</div>}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* 4. SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-xl font-bold mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                                    <Settings size={20} /> Application Configuration
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 mb-6">Manage security and global settings.</p>
                            </div>

                            {/* Security Section */}
                            <div className="mb-8 p-6 bg-red-50 dark:bg-slate-800/50 rounded-2xl border border-red-100 dark:border-slate-700">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                                    <Lock size={18} className="text-mini-red"/> Security & My Account
                                </h3>
                                <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Update My Password</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="New secure password"
                                                className="flex-grow px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-mini-red outline-none"
                                            />
                                            <button 
                                                type="submit"
                                                disabled={!newPassword}
                                                className="bg-mini-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg font-bold hover:opacity-80 transition-opacity disabled:opacity-50"
                                            >
                                                Update
                                            </button>
                                        </div>
                                        {passwordStatus === 'success' && (
                                            <p className="text-green-600 text-sm mt-2 flex items-center gap-1 font-bold"><CheckCircle size={14}/> Password updated successfully</p>
                                        )}
                                    </div>
                                </form>
                            </div>

                            {/* User Management Section */}
                            <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                                    <UserCog size={18} className="text-slate-600 dark:text-slate-300"/> User Management (Profiles)
                                </h3>
                                
                                <div className="flex gap-2 mb-4">
                                    <input 
                                        type="email"
                                        placeholder="Enter member email to reset password"
                                        value={adminResetEmail}
                                        onChange={(e) => setAdminResetEmail(e.target.value)}
                                        className="flex-grow px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                    <button 
                                        onClick={() => handleAdminResetForUser(adminResetEmail)}
                                        disabled={!adminResetEmail}
                                        className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white px-4 py-2 rounded-lg font-bold hover:bg-mini-red hover:text-white transition-colors"
                                    >
                                        <Mail size={18} /> Send Reset Link
                                    </button>
                                </div>

                                <div className="mt-6">
                                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-2">Registered Users ({users.length})</h4>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                                <tr>
                                                    <th className="p-3">Username</th>
                                                    <th className="p-3">Email</th>
                                                    <th className="p-3">Role</th>
                                                    <th className="p-3">Car</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {users.map((u) => (
                                                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="p-3 font-medium">{u.username || 'N/A'}</td>
                                                        <td className="p-3 text-slate-500">{u.email}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                                u.role === 'admin' ? 'bg-red-100 text-red-700' :
                                                                u.role === 'board' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                {u.role}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-slate-500">{u.car_model || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
