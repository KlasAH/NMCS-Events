
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, DollarSign, Users, Settings, Star, ToggleLeft, ToggleRight, Save, Search, Edit3, ArrowLeft, Lock, CheckCircle, AlertCircle, Mail, UserCog, HelpCircle, X, Trash2, Image, LogOut } from 'lucide-react';
import { Registration, Transaction, Meeting, ExtraInfoSection, LinkItem } from '../types';
import { supabase, isDemoMode } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

const AdminDashboard: React.FC = () => {
  const { isAdmin, loading, session, signOut, updatePassword, sendPasswordReset } = useAuth();
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

  // Global Settings Mock
  const [globalSettings, setGlobalSettings] = useState({
      maintenanceMode: false,
      publicRegistration: true,
      defaultContactEmail: 'contact@nmcs.club',
      yearlyTheme: 'JCW Racing Spirit'
  });

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
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl text-left text-sm text-slate-600 dark:text-slate-400 mb-8 border border-slate-100 dark:border-slate-700">
                    <p className="font-bold mb-3 flex items-center gap-2 text-slate-900 dark:text-white text-base">
                        <UserCog size={18}/> Board Member Setup:
                    </p>
                    <p className="mb-2">To grant access, you must update the user's role in the database:</p>
                    <ol className="list-decimal ml-5 space-y-2 marker:text-mini-red marker:font-bold">
                        <li>Go to <strong>Supabase Dashboard</strong> &gt; <strong>Table Editor</strong></li>
                        <li>Open the <code>profiles</code> table</li>
                        <li>Find the user row (check email or username)</li>
                        <li>Change the <code>role</code> column to <code>board</code> or <code>admin</code></li>
                        <li>Click <strong>Save</strong></li>
                    </ol>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                        onClick={() => window.location.reload()}
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

  const startEditEvent = (evt?: Meeting) => {
      if(evt) {
          setEditingEventData(evt);
      } else {
          setEditingEventData({
              title: '',
              date: new Date().toISOString().split('T')[0],
              description: '',
              location_name: '',
              cover_image_url: '',
              extra_info: []
          });
      }
      setIsEditingEvent(true);
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

  const updateExtraInfo = (index: number, field: keyof ExtraInfoSection, value: any) => {
      const newExtra = [...(editingEventData.extra_info || [])];
      newExtra[index] = { ...newExtra[index], [field]: value };
      setEditingEventData({...editingEventData, extra_info: newExtra});
  }

  const addExtraInfo = () => {
      const newExtra: ExtraInfoSection = {
          id: `new-${Date.now()}`,
          type: 'general',
          title: 'New Section',
          icon: 'info',
          content: '',
      };
      setEditingEventData({...editingEventData, extra_info: [...(editingEventData.extra_info || []), newExtra]});
  }

  const removeExtraInfo = (index: number) => {
      const newExtra = [...(editingEventData.extra_info || [])];
      newExtra.splice(index, 1);
      setEditingEventData({...editingEventData, extra_info: newExtra});
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Event Title</label>
                                <input 
                                    type="text" 
                                    value={editingEventData.title || ''}
                                    onChange={(e) => setEditingEventData({...editingEventData, title: e.target.value})}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                                    <input 
                                        type="date" 
                                        value={editingEventData.date || ''}
                                        onChange={(e) => setEditingEventData({...editingEventData, date: e.target.value})}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">End Date (Optional)</label>
                                    <input 
                                        type="date" 
                                        value={editingEventData.end_date || ''}
                                        onChange={(e) => setEditingEventData({...editingEventData, end_date: e.target.value})}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Location</label>
                                <input 
                                    type="text" 
                                    value={editingEventData.location_name || ''}
                                    onChange={(e) => setEditingEventData({...editingEventData, location_name: e.target.value})}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                                <textarea 
                                    rows={4}
                                    value={editingEventData.description || ''}
                                    onChange={(e) => setEditingEventData({...editingEventData, description: e.target.value})}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Cover Image URL</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={editingEventData.cover_image_url || ''}
                                        onChange={(e) => setEditingEventData({...editingEventData, cover_image_url: e.target.value})}
                                        className="flex-grow px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                    <div className="text-xs text-slate-500 self-center whitespace-nowrap px-2 bg-slate-100 dark:bg-slate-800 rounded">
                                        Optimal: 1920x1080px
                                    </div>
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
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white text-lg">{evt.title}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{evt.date} | {evt.location_name}</p>
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
