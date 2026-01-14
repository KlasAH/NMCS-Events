

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isDemoMode, finalUrl, finalKey } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Shield, Car, CheckCircle, Save, Lock, AlertCircle, X, AtSign, Loader2, Key, Wrench, HelpCircle } from 'lucide-react';
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

    // Password State
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        if (!session || isDemoMode) {
            setLoadingData(false);
            if(isDemoMode) {
                setFormData({
                    full_name: 'Demo User',
                    username: '@demo',
                    email: 'demo@example.com',
                    board_role: 'Ordförande',
                    system_role: 'admin'
                });
            }
            return;
        }

        const fetchProfile = async () => {
            try {
                // Fetch profile data
                const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                
                if (error) {
                    console.error('Error fetching profile:', error);
                }

                if (data) {
                    setFormData({
                        full_name: data.full_name || session.user.user_metadata?.full_name || '',
                        username: data.username || session.user.user_metadata?.username || '',
                        email: data.email || session.user.email || '',
                        // Map board_role safely. If DB has NULL, we default to ''.
                        board_role: data.board_role || '', 
                        system_role: data.role || 'user'
                    });
                    
                    if (data.car_model && MODELS.some(m => m.id === data.car_model)) {
                        setModel(data.car_model as MiniModel);
                    }
                } else {
                    setFormData({
                        full_name: session.user.user_metadata?.full_name || '',
                        username: session.user.user_metadata?.username || '',
                        email: session.user.email || '',
                        board_role: '',
                        system_role: 'user'
                    });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingData(false);
            }
        };

        fetchProfile();
    }, [session]);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (statusMsg) setStatusMsg(null);
    };

    const handleSaveAll = async () => {
        if (!session?.user?.id) {
            setStatusMsg({ type: 'error', text: 'No active session. Please log in again.' });
            return;
        }

        setSaving(true);
        setStatusMsg(null);
        let partialSuccess = false;
        
        try {
            if (isDemoMode) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                setStatusMsg({ type: 'success', text: 'Data stored locally (Demo Mode)' });
                setSaving(false);
                return;
            }

            const scopedClient = createClient(finalUrl, finalKey, {
                global: {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                },
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            // Prepare Data
            const profileData = {
                id: session.user.id,
                full_name: formData.full_name,
                username: formData.username,
                email: formData.email, 
                board_role: formData.board_role || null, // Send explicit null if empty
                car_model: model,
                updated_at: new Date().toISOString(),
            };

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timed out. Database might be waking up.')), 30000)
            );

            // 1. ATTEMPT FULL SAVE
            // We use 'let' to allow error handling flow
            let saveResult = await Promise.race([
                scopedClient.from('profiles').upsert(profileData),
                timeoutPromise
            ]) as any;

            let finalError = saveResult.error;

            // 2. AGGRESSIVE FALLBACK
            // If ANY error occurred (Schema mismatch, RLS, Cache issues), try saving without 'board_role'
            if (finalError) {
                 console.warn("[Profile] Full save failed. Attempting partial save.", finalError.message);
                 
                 // Remove board_role from payload
                 const { board_role, ...safeData } = profileData;
                 
                 const safeResult = await Promise.race([
                    scopedClient.from('profiles').upsert(safeData),
                    timeoutPromise
                 ]) as any;

                 if (!safeResult.error) {
                     finalError = null; // Success! We recovered.
                     partialSuccess = true;
                 } else {
                     // If safe save ALSO failed, we keep the original error or the new one
                     console.error("[Profile] Partial save also failed.", safeResult.error);
                     finalError = safeResult.error;
                 }
            }

            if (finalError) throw new Error(finalError.message || 'Profile save failed');

            // 3. Update Password if provided
            if (newPassword) {
                if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
                const { error: pwError } = await Promise.race([
                    updatePassword(newPassword),
                    timeoutPromise
                ]) as any;
                if (pwError) throw new Error('Password update failed: ' + pwError.message);
                setNewPassword('');
            }

            if (partialSuccess) {
                setStatusMsg({ 
                    type: 'warning', 
                    text: 'Profile saved! (Board Title pending DB sync)',
                    detail: 'Your main details are saved. The "Board Role" field failed to sync likely due to a database cache delay. It will work automatically later.'
                });
            } else {
                setStatusMsg({ type: 'success', text: 'Profile saved successfully!' });
            }

        } catch (error: any) {
            console.error("Save Error:", error);
            let errorMessage = error.message || 'An unexpected error occurred.';
            let detail = '';

            if (errorMessage.includes('board_role') || errorMessage.includes('schema cache')) {
                errorMessage = "Database Sync Error.";
                detail = "The database schema is out of sync with the application. Please click 'Fix Database' below to force a schema reload.";
            }

            setStatusMsg({ type: 'error', text: errorMessage, detail });
        } finally {
            setSaving(false);
        }
    };

    if (loading || loadingData) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin text-mini-red" size={48} />
        </div>
    );
    
    if (!session) return <Navigate to="/login" replace />;

    const INPUT_STYLE = "w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mini-red transition-all";
    const LABEL_STYLE = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

    return (
        <div className="pt-24 pb-12 px-4 max-w-5xl mx-auto min-h-screen">
            
            {/* MAIN CONTAINER FRAME */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border-4 border-slate-100 dark:border-slate-800 overflow-hidden relative"
            >
                {/* STATUS BAR (Notification) */}
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
                                {statusMsg.type === 'success' ? <CheckCircle size={18}/> : statusMsg.type === 'warning' ? <AlertCircle size={18}/> : <AlertCircle size={18}/>}
                                {statusMsg.text}
                            </div>
                            
                            {/* Detail Message */}
                            {statusMsg.detail && (
                                <p className="text-xs font-normal opacity-80 max-w-lg mt-1">{statusMsg.detail}</p>
                            )}

                            {/* FIX BUTTON for Database Errors or Warnings */}
                            {(statusMsg.type === 'error' || statusMsg.type === 'warning') && (
                                <button 
                                    onClick={() => setShowFixer(true)}
                                    className="mt-3 flex items-center gap-1 bg-white text-slate-700 px-4 py-1.5 rounded-full text-xs hover:bg-slate-100 shadow-sm border border-slate-200 transition-colors font-bold"
                                >
                                    <Wrench size={12} /> Open Database Fixer
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="p-8 md:p-12">
                    {/* HEADER SECTION */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-8 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                <User className="text-mini-red" size={40} /> {t('profile')}
                            </h1>
                            <p className="text-slate-500 mt-2 font-medium">Manage your personal information and preferences.</p>
                        </div>

                        {/* SAVE BUTTON - Top Right */}
                        <button 
                            type="button"
                            onClick={handleSaveAll}
                            disabled={saving}
                            className={`
                                flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all transform hover:scale-105 active:scale-95
                                ${saving 
                                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                                    : 'bg-mini-black dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 shadow-black/20'}
                            `}
                        >
                            {saving ? (
                                <><Loader2 className="animate-spin" size={20}/> Saving...</>
                            ) : (
                                <><Save size={20} /> {t('save')}</>
                            )}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        
                        {/* LEFT COLUMN: Inputs */}
                        <div className="lg:col-span-7 space-y-10">
                            
                            {/* Personal Info */}
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">1</span>
                                    Personal Details
                                </h3>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className={LABEL_STYLE}>{t('fullName')}</label>
                                            <div className="relative">
                                                <input 
                                                    value={formData.full_name}
                                                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                                                    className={INPUT_STYLE}
                                                    placeholder="Klas Ahlman"
                                                />
                                                <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={LABEL_STYLE}>{t('username')}</label>
                                            <div className="relative">
                                                <input 
                                                    value={formData.username}
                                                    onChange={(e) => handleInputChange('username', e.target.value)}
                                                    className={INPUT_STYLE}
                                                    placeholder="@klas"
                                                />
                                                <AtSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className={LABEL_STYLE}>{t('email')}</label>
                                        <div className="relative">
                                            <input 
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => handleInputChange('email', e.target.value)}
                                                className={INPUT_STYLE}
                                                placeholder="email@example.com"
                                            />
                                            <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* System Role - Read Only */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">System Permission</label>
                                                <div className="group relative">
                                                    <HelpCircle size={14} className="text-slate-400 cursor-help" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        Controls what you can access (Admin, User, etc). Stored in 'role' column.
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-2 uppercase text-sm cursor-not-allowed">
                                                <Shield size={16} /> {formData.system_role}
                                            </div>
                                        </div>

                                        {/* Board Title - Editable */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Board Title (Display)</label>
                                            </div>
                                            <div className="relative">
                                                <select 
                                                    value={formData.board_role}
                                                    onChange={(e) => handleInputChange('board_role', e.target.value)}
                                                    className={`${INPUT_STYLE} appearance-none cursor-pointer`}
                                                >
                                                    <option value="">(None)</option>
                                                    {BOARD_ROLES.map(role => (
                                                        <option key={role} value={role}>{role}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="w-full h-px bg-slate-100 dark:bg-slate-800"></div>

                            {/* Password Section */}
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">2</span>
                                    {t('changePassword')}
                                </h3>
                                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <label className={LABEL_STYLE}>{t('newPassword')}</label>
                                    <div className="relative">
                                        <input 
                                            type="password" 
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter new password to update"
                                            minLength={6}
                                            className={`${INPUT_STYLE} bg-white dark:bg-slate-900 pr-12`}
                                        />
                                        <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    </div>
                                    <p className="mt-3 text-xs text-slate-400 flex items-start gap-2">
                                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                        Leave blank if you don't want to change your password. 
                                        Changes are applied when you click "Save".
                                    </p>
                                </div>
                            </section>
                        </div>

                        {/* RIGHT COLUMN: Car Selector */}
                        <div className="lg:col-span-5">
                            <section className="h-full">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">3</span>
                                    {t('carType')}
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 max-h-[600px] overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-3">
                                        {MODELS.map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => setModel(m.id)}
                                                className={`relative p-2 rounded-xl border-2 transition-all group overflow-hidden flex flex-col items-center bg-white dark:bg-slate-900
                                                    ${model === m.id 
                                                        ? 'border-mini-red ring-2 ring-mini-red/20 scale-[1.02] shadow-lg z-10' 
                                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 opacity-80 hover:opacity-100'}
                                                `}
                                            >
                                                <div className="aspect-[4/3] w-full flex items-center justify-center mb-2 p-2">
                                                    <img src={m.carImageUrl} className="w-full h-full object-contain" alt={m.name} loading="lazy" />
                                                </div>
                                                <div className="text-center w-full pb-1">
                                                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{m.name}</div>
                                                    <div className="text-[10px] text-slate-400">{m.years}</div>
                                                </div>
                                                {model === m.id && (
                                                    <div className="absolute top-2 right-2 text-mini-red bg-white rounded-full p-0.5 shadow-sm">
                                                        <CheckCircle size={16} fill="currentColor" className="text-white" />
                                                    </div>
                                                )}
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