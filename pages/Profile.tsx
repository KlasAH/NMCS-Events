
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isDemoMode } from '../lib/supabase';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Car, CheckCircle, Save, Lock, AlertCircle, X } from 'lucide-react';
import { useTheme, MODELS, MiniModel } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import Modal from '../components/Modal';

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

    const [profile, setProfile] = useState<any>(null);
    const [boardRole, setBoardRole] = useState('');
    const [saving, setSaving] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [pwStatus, setPwStatus] = useState('');

    useEffect(() => {
        if (!session || isDemoMode) return;

        const fetchProfile = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            if (data) {
                setProfile(data);
                setBoardRole(data.board_role || '');
            }
        };
        fetchProfile();
    }, [session]);

    const handleSaveProfile = async () => {
        setSaving(true);
        
        if (isDemoMode) {
            setTimeout(() => {
                setSaving(false);
                setShowSaveModal(true);
            }, 1000);
            return;
        }

        const { error } = await supabase
            .from('profiles')
            .update({ 
                board_role: boardRole,
                car_model: model // Ensure local model state is synced
            })
            .eq('id', session?.user.id);

        if (!error) {
            setShowSaveModal(true);
        } else {
            alert('Error saving: ' + error.message);
        }
        setSaving(false);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwStatus('Processing...');
        const { error } = await updatePassword(newPassword);
        if (error) {
            setPwStatus('Error: ' + error.message);
        } else {
            setPwStatus('Password Updated!');
            setNewPassword('');
        }
    };

    if (loading) return <div className="pt-32 text-center">Loading...</div>;
    if (!session) return <Navigate to="/login" replace />;

    const INPUT_STYLE = "w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mini-red transition-all";
    const LABEL_STYLE = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

    return (
        <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto min-h-screen">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
                {/* 1. MAIN PROFILE CARD */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <User className="text-mini-red" /> {t('profile')}
                        </h1>
                        
                        <div className="space-y-6">
                             {/* Read Only Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_STYLE}>{t('fullName')}</label>
                                    <div className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                                        {profile?.full_name || session.user.user_metadata.full_name || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <label className={LABEL_STYLE}>{t('username')}</label>
                                    <div className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                                        @{profile?.username || 'user'}
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className={LABEL_STYLE}>{t('email')}</label>
                                <div className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium flex items-center gap-2">
                                    <Mail size={16} /> {session.user.email}
                                </div>
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800" />

                            {/* Editable Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* System Role (Read Only) */}
                                <div>
                                    <label className={LABEL_STYLE}>System Role</label>
                                    <div className="px-5 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 font-bold border border-blue-100 dark:border-blue-800 flex items-center gap-2 uppercase text-sm">
                                        <Shield size={16} /> {profile?.role || 'User'}
                                    </div>
                                </div>
                                
                                {/* Board Role Selector */}
                                <div>
                                    <label className={LABEL_STYLE}>{t('boardRole')}</label>
                                    <div className="relative">
                                        <select 
                                            value={boardRole}
                                            onChange={(e) => setBoardRole(e.target.value)}
                                            className={`${INPUT_STYLE} appearance-none`}
                                        >
                                            <option value="">(None)</option>
                                            {BOARD_ROLES.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button 
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-mini-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : <><Save size={18} /> {t('save')}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* 2. PASSWORD CHANGE */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Lock className="text-mini-red" size={20} /> {t('changePassword')}
                        </h2>
                        <form onSubmit={handleChangePassword} className="flex flex-col sm:flex-row gap-4 items-end">
                             <div className="flex-grow w-full">
                                <label className={LABEL_STYLE}>{t('newPassword')}</label>
                                <input 
                                    type="password" 
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    minLength={6}
                                    className={INPUT_STYLE}
                                />
                             </div>
                             <button type="submit" disabled={!newPassword} className="bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold px-6 py-3 rounded-xl hover:bg-mini-red hover:text-white transition-colors disabled:opacity-50 w-full sm:w-auto">
                                 Update
                             </button>
                        </form>
                        {pwStatus && (
                            <p className={`mt-4 text-sm font-bold ${pwStatus.includes('Error') ? 'text-mini-red' : 'text-green-600'}`}>
                                {pwStatus}
                            </p>
                        )}
                        <p className="mt-4 text-xs text-slate-400 flex items-start gap-2">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            For security reasons, your current password cannot be displayed. You may only overwrite it.
                        </p>
                    </div>
                </div>

                {/* 3. CAR SELECTOR SIDEBAR */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                         <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Car className="text-mini-red" size={20} /> {t('carType')}
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            {MODELS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setModel(m.id)}
                                    className={`relative p-2 rounded-xl border-2 transition-all group overflow-hidden ${model === m.id ? 'border-mini-red bg-red-50 dark:bg-red-900/10' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
                                >
                                    <div className="aspect-[4/3] w-full flex items-center justify-center mb-2">
                                        <img src={m.carImageUrl} className="w-full object-contain" alt={m.name} />
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold text-xs text-slate-900 dark:text-white">{m.name}</div>
                                        <div className="text-[10px] text-slate-400">{m.years}</div>
                                    </div>
                                    {model === m.id && (
                                        <div className="absolute top-2 right-2 text-mini-red">
                                            <CheckCircle size={16} fill="currentColor" className="text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* SAVE CONFIRMATION MODAL */}
            <Modal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} title="">
                <div className="text-center py-8">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <CheckCircle size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Profile Updated!</h3>
                    <p className="text-slate-500 mb-6">Your changes have been successfully saved.</p>
                    <button 
                        onClick={() => setShowSaveModal(false)}
                        className="bg-mini-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold hover:opacity-90"
                    >
                        OK
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Profile;
