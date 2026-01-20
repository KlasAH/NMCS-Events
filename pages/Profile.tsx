
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isDemoMode, finalUrl, finalKey } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Shield, CheckCircle, Save, Lock, AlertCircle, Wrench, HelpCircle, Loader2, AtSign, RefreshCw, Database } from 'lucide-react';
import { useTheme, MODELS, MiniModel } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import SupabaseTester from '../components/SupabaseTester';

const BOARD_ROLES = [
    'Ordförande',
    'Kassör',
    'Teknikansvarig/Ledamot',
    'Ledamot',
    'Suppleant'
];

const Profile: React.FC = () => {
    const { session, loading, updatePassword } = useAuth();
    const { model, setModel } = useTheme();
    const { t } = useLanguage();
    
    const userId = session?.user?.id;

    // Form State
    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        email: '',
        board_role: '',
        system_role: 'user'
    });

    const [loadingData, setLoadingData] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'warning' | 'error', text: string, detail?: string } | null>(null);
    const [showFixer, setShowFixer] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [debugInfo, setDebugInfo] = useState<string>('');
    
    // SAFETY: If loading takes too long (>6s), force it to stop. 
    // This prevents the "stuck in loading" UI if the promise hangs or logic fails.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loadingData) {
                console.warn("[Profile] Safety timeout triggered");
                setLoadingData(false);
                setDebugInfo(prev => (prev ? prev + " | " : "") + "Forced Load (Timeout)");
            }
        }, 6000);
        return () => clearTimeout(timer);
    }, [loadingData]);

    const fetchProfileData = useCallback(async (isRetry = false) => {
        if (!userId) {
            setLoadingData(false);
            return;
        }

        if (isDemoMode) {
            setLoadingData(false);
            setFormData({
                full_name: 'Demo User',
                username: '@demo',
                email: 'demo@example.com',
                board_role: 'Ordförande',
                system_role: 'admin'
            });
            return;
        }

        setLoadingData(true);
        if(!isRetry) setDebugInfo('');

        // Use AbortController for this specific request
        const abortController = new AbortController();
        const signal = abortController.signal;

        try {
            // 1. Fetch Profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .abortSignal(signal)
                .maybeSingle();

            if (signal.aborted) return; // Stop if unmounted

            // AUTO-RETRY LOGIC (One attempt)
            if ((profileError || !profile) && !isRetry) {
                console.log("[Profile] Data missing or error. Refreshing session and retrying...");
                setDebugInfo("Refreshing Session...");
                
                const { error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) console.warn("Session refresh failed", refreshError);
                
                // Recursive retry
                return fetchProfileData(true);
            }

            if (profileError) {
                setDebugInfo(`Fetch Error: ${profileError.message} (${profileError.code})`);
                console.error("Profile fetch error:", profileError);
            } else if (!profile) {
                setDebugInfo(`Profile: No row found (ID: ${userId?.substring(0,6)}...)`);
            } else {
                setDebugInfo(`Profile Loaded. Role: ${profile.role}`);
            }

            // 2. Fetch User Role (Legacy check)
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId)
                .maybeSingle();

            // Determine System Role
            let finalRole = 'user';
            if (roleData?.role && ['board', 'admin'].includes(roleData.role)) {
                finalRole = roleData.role;
            } else if (profile?.role && ['board', 'admin'].includes(profile.role)) {
                finalRole = profile.role;
            } else {
                 const metaRole = session?.user?.user_metadata?.role;
                 if (metaRole) finalRole = metaRole;
            }

            if (profile) {
                setFormData({
                    full_name: profile.full_name || session?.user?.user_metadata?.full_name || '',
                    username: profile.username || session?.user?.user_metadata?.username || '',
                    email: profile.email || session?.user?.email || '',
                    board_role: profile.board_role || '', 
                    system_role: finalRole
                });
                
                // Only update model if different and valid
                if (profile.car_model && MODELS.some(m => m.id === profile.car_model)) {
                    if (model !== profile.car_model) {
                        setModel(profile.car_model as MiniModel);
                    }
                }
            } else {
                // Fallback
                setFormData({
                    full_name: session?.user?.user_metadata?.full_name || '',
                    username: session?.user?.user_metadata?.username || '',
                    email: session?.user?.email || '',
                    board_role: '',
                    system_role: finalRole
                });
                setStatusMsg({ 
                    type: 'warning', 
                    text: 'Profile not found.', 
                    detail: 'Loaded basic info from login. Database row might be missing.' 
                });
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('Fetch aborted');
                return;
            }
            console.error("Critical Profile Error:", err);
            setDebugInfo(`Critical: ${err.message}`);
        } finally {
            if (!signal.aborted) {
                setLoadingData(false);
            }
        }
        
        return () => abortController.abort();
    }, [userId, model, session]); // Dependencies

    // Trigger Fetch on Mount / User Change
    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

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

            // Use temporary non-persisted client for clean update to avoid session conflicts
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
                // If column missing, try minimal update
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
                setDebugInfo(`Saved at ${new Date().toLocaleTimeString()}`);
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

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin text-mini-red" size={48} />
        </div>
    );
    
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
                        {debugInfo && <span className="ml-2 text-yellow-600 dark:text-yellow-500 border-l border-slate-300 pl-2"> {debugInfo}</span>}
                    </div>
                    <button onClick={() => fetchProfileData(false)} className="flex items-center gap-1 hover:text-mini-red transition-colors">
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
                    {loadingData && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
                            <Loader2 className="animate-spin text-mini-red" size={32} />
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
