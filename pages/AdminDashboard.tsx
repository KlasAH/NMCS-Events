import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, DollarSign, Users, Settings, Star, ToggleLeft, ToggleRight, Save } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'finances' | 'settings'>('overview');
  
  // Mock State for Settings and Pinned Events
  const [globalSettings, setGlobalSettings] = useState({
      maintenanceMode: false,
      publicRegistration: true,
      defaultContactEmail: 'contact@nmcs.club',
      yearlyTheme: 'JCW Racing Spirit'
  });

  const [mockPinnedStatus, setMockPinnedStatus] = useState<Record<string, boolean>>({
      '1': true, // Alpine event mocked ID
      '2': false
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/login" replace />;

  const togglePin = (id: string) => {
      setMockPinnedStatus(prev => ({
          ...prev,
          [id]: !prev[id]
      }));
      // Here you would await supabase.from('meetings').update({ is_pinned: !current }).eq('id', id)
  };

  const handleSettingChange = (key: string, value: any) => {
      setGlobalSettings(prev => ({...prev, [key]: value}));
  };

  return (
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto min-h-screen">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage NMCS events, finances, and configuration.</p>
        </div>
        <button className="flex items-center gap-2 bg-mini-red text-white px-5 py-2.5 rounded-full font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none">
            <Plus size={18} /> Add New Meeting
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        <div className="md:col-span-1 flex flex-col gap-2">
            {[
                { id: 'overview', label: 'Overview', icon: Users },
                { id: 'finances', label: 'Finances', icon: DollarSign },
                { id: 'settings', label: 'Global Settings', icon: Settings },
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors font-medium
                        ${activeTab === tab.id ? 'bg-mini-black dark:bg-white text-white dark:text-black shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-mini-black dark:hover:text-white'}
                    `}
                >
                    <tab.icon size={18} /> {tab.label}
                </button>
            ))}
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 min-h-[500px] transition-colors"
            >
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-900 dark:text-white">Upcoming Events</h2>
                        {/* Mock List */}
                        {[
                            {id: '1', title: 'Alpine Grand Tour 2024', date: 'June 15, 2024'},
                            {id: '2', title: 'Sunday Coffee Run', date: 'April 20, 2024'},
                            {id: '3', title: 'Track Day: Silverstone', date: 'May 10, 2024'},
                        ].map((evt) => {
                            const isPinned = mockPinnedStatus[evt.id];
                            return (
                                <div key={evt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors gap-4">
                                    <div className="flex items-center gap-4">
                                        <button 
                                            onClick={() => togglePin(evt.id)}
                                            className={`p-2 rounded-full transition-colors ${isPinned ? 'text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : 'text-slate-300 dark:text-slate-600 hover:text-yellow-400'}`}
                                            title={isPinned ? "Unpin Main Event" : "Pin as Main Event"}
                                        >
                                            <Star fill={isPinned ? "currentColor" : "none"} size={20} />
                                        </button>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{evt.title}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{evt.date}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-10 sm:ml-0">
                                        <button className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-mini-black dark:hover:border-white hover:bg-mini-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors text-slate-600 dark:text-slate-300 font-medium">Itinerary</button>
                                        <button className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-mini-black dark:hover:border-white hover:bg-mini-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors text-slate-600 dark:text-slate-300 font-medium">Details</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'finances' && (
                    <div>
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-mini-green dark:text-green-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                             Financial Overview
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                             <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-800 relative overflow-hidden">
                                 <div className="absolute top-0 right-0 w-20 h-20 bg-green-200 dark:bg-green-600 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                                 <p className="text-xs text-green-700 dark:text-green-400 font-bold uppercase tracking-wider">Total Revenue (YTD)</p>
                                 <p className="text-4xl font-black text-green-900 dark:text-green-100 mt-2 tracking-tight">$24,500.00</p>
                             </div>
                             <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800 relative overflow-hidden">
                                 <div className="absolute top-0 right-0 w-20 h-20 bg-red-200 dark:bg-red-600 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                                 <p className="text-xs text-red-700 dark:text-red-400 font-bold uppercase tracking-wider">Outstanding Expenses</p>
                                 <p className="text-4xl font-black text-red-900 dark:text-red-100 mt-2 tracking-tight">$3,240.50</p>
                             </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                             <h3 className="font-bold text-slate-800 dark:text-white mb-4">Recent Transactions</h3>
                             <p className="text-slate-400 italic text-sm">Connect Supabase 'transactions' table to view live data.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="space-y-8">
                        <div>
                             <h2 className="text-xl font-bold mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                                <Settings size={20} /> Application Configuration
                             </h2>
                             <p className="text-slate-500 dark:text-slate-400 mb-6">These settings affect the public facing application immediately.</p>
                        </div>

                        {/* Setting Items */}
                        <div className="grid grid-cols-1 gap-6">
                            {/* Toggle: Maintenance Mode */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white">Maintenance Mode</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Disable public access to event details.</p>
                                </div>
                                <button 
                                    onClick={() => handleSettingChange('maintenanceMode', !globalSettings.maintenanceMode)}
                                    className={`transition-colors ${globalSettings.maintenanceMode ? 'text-mini-red' : 'text-slate-300 dark:text-slate-600'}`}
                                >
                                    {globalSettings.maintenanceMode ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                                </button>
                            </div>

                             {/* Toggle: Public Registration */}
                             <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white">Public Registration</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Allow non-members to sign up for open events.</p>
                                </div>
                                <button 
                                    onClick={() => handleSettingChange('publicRegistration', !globalSettings.publicRegistration)}
                                    className={`transition-colors ${globalSettings.publicRegistration ? 'text-mini-green dark:text-green-400' : 'text-slate-300 dark:text-slate-600'}`}
                                >
                                    {globalSettings.publicRegistration ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                                </button>
                            </div>

                            {/* Input: Theme String */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Yearly Theme / Slogan</label>
                                <input 
                                    type="text" 
                                    value={globalSettings.yearlyTheme}
                                    onChange={(e) => handleSettingChange('yearlyTheme', e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-mini-black dark:focus:ring-white outline-none"
                                />
                            </div>

                             {/* Input: Contact Email */}
                             <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Default Contact Email</label>
                                <input 
                                    type="email" 
                                    value={globalSettings.defaultContactEmail}
                                    onChange={(e) => handleSettingChange('defaultContactEmail', e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-mini-black dark:focus:ring-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button className="flex items-center gap-2 bg-mini-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-full font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all">
                                <Save size={18} /> Save Settings
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;