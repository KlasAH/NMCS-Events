
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isDemoMode, finalUrl, finalKey } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Shield, CheckCircle, Save, Lock, AlertCircle, Wrench, Loader2, AtSign, RefreshCw, Database } from 'lucide-react';
import { useTheme, MODELS, MiniModel } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import SupabaseTester from '../components/SupabaseTester';
import { useDataSync } from '../hooks/useDataSync';

const BOARD_ROLES = [
    'Ordförande',
    'Kassör',
    'Teknikansvarig/Ledamot',
    'Ledamot',
    'Suppleant'
];

interface ProfileData {
    full_name: string;
    username: string;
    email: string;
    board_role: string;
    system_role: string;
    car_model?: string;
}

const Profile: React.FC = () => {
    const { session, updatePassword } = useAuth();
    const { model, setModel } = useTheme();
    const { t } = useLanguage();
    
    const userId = session?.user?.id;

    // Form State
    const [formData, setFormData] = useState<ProfileData>({
        full_name: '',
        username: '',
        email: '',
        board_role: '',
        system_role: 'user'
    });

    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'warning' | 'error', text: string, detail?: string } | null>(null);
    const [showFixer, setShowFixer] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    
    // --- STABLE FETCHER CALLBACK ---
    const fetchProfile = useCallback(async () => {
        if (!userId) return null;
        
        if (isDemoMode) {
             return {
                full_name: 'Demo User',
                username: '@demo',
                email: 'demo@example.com',
                board_role: 'Ordförande',
                system_role: 'admin',
                car_model: 'r53'
            };
        }

        // 1. Fetch Profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        
        if (error) throw error;

        // 2. Determine Role
        let finalRole = 'user';
        if (profile?.role && ['board', 'admin'].includes(profile.role)) {
            finalRole = profile.role;
        } else {
             // Priority 2: Session Metadata
             const metaRole = session?.user?.user_metadata?.role;
             if (metaRole) finalRole = metaRole;
             
             // Priority 3: User Roles Table
             try {
                 const { data: roleData } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', userId)
                    .maybeSingle();
                 if (roleData?.role) finalRole = roleData.role;
             } catch (e) { /* ignore */ }
        }

        const meta = session?.user?.user_metadata || {};
        const sessEmail = session?.user?.email;

        return {
            full_name: profile?.full_name || meta.full_name || '',
            username: profile?.username || meta.username || '',
            email: profile?.email || sessEmail || '',
            board_role: profile?.board_role || '',
            system_role: finalRole,
            car_model: profile?.car_model
        };
    }, [userId, session]); // Dependencies for fetcher

    // --- USE DATA SYNC ---
    const { data: syncedProfile, isLoading, isValidating, refresh } = useDataSync<ProfileData>(
        `profile_${userId}`, 
        'profiles',
        fetchProfile,
        [userId] // Hook dependency to recreate sync function
    );

    // Update form when synced data arrives (or loads from cache)
    useEffect(() => {
        if (syncedProfile) {
            setFormData(prev => ({
                ...prev,
                full_name: syncedProfile.full_name,
                username: syncedProfile.username,
                email: syncedProfile.email,
                board_role: syncedProfile.board_role,
                system_role: syncedProfile.system_role
            }));

            // Sync Theme Model if it differs
            if (syncedProfile.car_model && MODELS.some(m => m.id === syncedProfile.car_model)) {
                if (model !== syncedProfile.car_model) {
                    setModel(syncedProfile.car_model as MiniModel);
                }
            }
        }
    }, [syncedProfile, model, setModel]);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (statusMsg?.type !== 'warning') setStatusMsg(null);
    };

    const handleSaveAll = async () => {
        if (!userId) return;

        setSaving(true);
        setStatusMsg(null);
        
        try {
            if (isDemoMode) {
                await new Promise(resolve => setTimeout(resolve, 800));
                setStatusMsg({ type: 'success', text: 'Data stored locally (Demo Mode)' });
                setSaving(false);
                return;
            }

            // Always use Isolated Client for writing to be safe if global is bad
            const tempClient = createClient(finalUrl, finalKey, {
                global: { headers: { Authorization: `Bearer ${session?.access_token}` } },
                auth: { persistSession: false }
            });

            const updates: any = {
                id: userId,
                full_name: formData.full_name,
                username: formData.username,
                email: formData.email, 
                car_model: model,
                updated_at: new Date().toISOString(),
                ...(formData.board_role ? { board_role: formData.board_role } : {})
            };

            const { error } = await tempClient.from('profiles').upsert(updates);
            
            if (error) {
                if (error.code === '42703') { 
                    const minimalUpdates = {
                        id: userId,
                        full_name: formData.full_name,
                        username: formData.username,
                        email: formData.email,
                        car_model: model
                    };
                    const { error: retryError } = await tempClient.from('profiles').upsert(minimalUpdates);
                    if (retryError) throw retryError;
                    setStatusMsg({ type: 'warning', text: "Saved partially.", detail: "Database schema outdated. Please run Fixer." });
                } else {
                    throw error;
                }
            } else {
                setStatusMsg({ type: 'success', text: 'Profile saved successfully!' });
                refresh(); // Manually trigger a re-sync to update cache
            }

            if (newPassword) {
                if (newPassword.length < 6) throw new Error('Password too short.');
                const { error: pwError } = await updatePassword(newPassword);
                if (pwError) throw new Error('Password update failed: ' + pwError.message);
                setNewPassword('');
            }

        } catch (error: any) {
            console.error("Save Error:", error);
            setStatusMsg({ type: 'error', text: error.message || 'Save failed.' });
        } finally {
            setSaving(false);
        }
    };
    
    if (!session) return <Navigate to="/login" replace />;

    return (
        <div className="pt-24 pb-12 px-4 max-w-5xl mx-auto min-h-screen">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border-4 border-slate-100 dark:border-slate-800 overflow-hidden relative"
            >
                {/* Debug Bar for Owner */}
                <div className="bg-slate-100 dark:bg-slate-950 px-6 py-2 text-[10px] font-mono text-slate-400 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                    <div className="flex gap-2 items-center">
                        <span className="font-bold">ID:</span> {userId?.substring(0, 8)}...
                        {/* Only show "Syncing" if we already have data but are checking for updates */}
                        {isValidating && syncedProfile && (
                            <span className="ml-2 flex items-center gap-1 text-blue-500">
                                <RefreshCw className="animate-spin" size={10} /> Syncing...
                            </span>
                        )}
                    </div>
                    <button onClick={() => refresh()} className="flex items-center gap-1 hover:text-mini-red transition-colors">
                        <RefreshCw size={10} /> Force Refresh
                    </button>
                </div>

                <AnimatePresence>
                    {statusMsg && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className={`w-full px-6 py-4 flex flex-col items-center text-center gap-1 font-bold text-sm 
                                ${statusMsg.type === 'success' ? 'bg-green-100 text-green-800' : 
                                  statusMsg.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border-b border-yellow-100' : 
                                  'bg-red-50 text-red-800 border-b border-red-100'}`}
                        >
                            <div className="flex items-center gap-2 justify-center">
                                {statusMsg.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
                                {statusMsg.text}
                            </div>
                            {statusMsg.detail && <p className="text-xs font-normal opacity-80">{statusMsg.detail}</p>}
                            {(statusMsg.type === 'error' || statusMsg.type === 'warning') && (
                                <button onClick={() => setShowFixer(true)} className="mt-2 flex items-center gap-2 bg-mini-black dark:bg-white text-white dark:text-black px-4 py-1 rounded-full text-xs">
                                    <Wrench size={12} /> Fix Database
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="p-8 md:p-12 relative">
                    {/* Only show blocking loader if we have NO data at all (first load, no cache) */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-white dark:bg-slate-900 z-10 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="animate-spin text-mini-red" size={48} />
                                <p className="text-slate-500 font-medium animate-pulse">Loading Profile...</p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-8 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                <User className="text-mini-red" size={40} /> {t('profile')}
                            </h1>
                            <p className="text-slate-500 mt-2 font-medium">Manage your personal information.</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setShowFixer(true)}
                                className="flex items-center gap-2 px-4 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                title="Run Diagnostics"
                            >
                                <Database size={20} />
                            </button>
                            <button 
                                type="button"
                                onClick={handleSaveAll}
                                disabled={saving}
                                className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all transform hover:scale-105 active:scale-95 ${saving ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-mini-black dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200'}`}
                            >
                                {saving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20} />} {t('save')}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        <div className="lg:col-span-7 space-y-10">
                            <section>
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">1</span> Personal Details</h3>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('fullName')}</label>
                                            <div className="relative"><input value={formData.full_name} onChange={(e) => handleInputChange('full_name', e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-mini-red" /><User className="absolute right-4 top-3 text-slate-400" size={18} /></div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('username')}</label>
                                            <div className="relative"><input value={formData.username} onChange={(e) => handleInputChange('username', e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-mini-red" /><AtSign className="absolute right-4 top-3 text-slate-400" size={18} /></div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('email')}</label>
                                        <div className="relative"><input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-mini-red" /><Mail className="absolute right-4 top-3 text-slate-400" size={18} /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">System Permission</label>
                                            <div className={`px-5 py-3 rounded-xl font-bold border flex items-center gap-2 uppercase text-sm ${formData.system_role === 'board' || formData.system_role === 'admin' ? 'bg-mini-red/10 text-mini-red border-mini-red/20' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}><Shield size={16} /> {formData.system_role}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Board Title</label>
                                            <select value={formData.board_role} onChange={(e) => handleInputChange('board_role', e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-mini-red appearance-none"><option value="">(None)</option>{BOARD_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
                                        </div>
                                    </div>
                                </div>
                            </section>
                            <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                            <section>
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">2</span> {t('changePassword')}</h3>
                                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('newPassword')}</label>
                                    <div className="relative"><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-mini-red" /><Lock className="absolute right-4 top-3 text-slate-400" size={18} /></div>
                                </div>
                            </section>
                        </div>
                        <div className="lg:col-span-5">
                            <section className="h-full">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">3</span> {t('carType')}</h3>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 max-h-[600px] overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-3">
                                        {MODELS.map(m => (
                                            <button key={m.id} onClick={() => setModel(m.id)} className={`relative p-2 rounded-xl border-2 transition-all flex flex-col items-center bg-white dark:bg-slate-900 ${model === m.id ? 'border-mini-red ring-2 ring-mini-red/20 scale-[1.02] shadow-lg z-10' : 'border-slate-100 dark:border-slate-800 opacity-80 hover:opacity-100'}`}>
                                                <div className="aspect-[4/3] w-full flex items-center justify-center mb-2 p-2"><img src={m.carImageUrl} className="w-full h-full object-contain" alt={m.name} loading="lazy" /></div>
                                                <div className="text-center w-full pb-1"><div className="font-bold text-xs truncate">{m.name}</div><div className="text-[10px] text-slate-400">{m.years}</div></div>
                                                {model === m.id && <div className="absolute top-2 right-2 text-mini-red bg-white rounded-full p-0.5 shadow-sm"><CheckCircle size={16} fill="currentColor" className="text-white" /></div>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </motion.div>
            <SupabaseTester isOpen={showFixer} onClose={() => setShowFixer(false)} />
        </div>
    );
};

export default Profile;
