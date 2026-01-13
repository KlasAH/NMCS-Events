
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isDemoMode } from '../lib/supabase';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Car, CheckCircle, Save, Lock, AlertCircle, X, AtSign, Loader2 } from 'lucide-react';
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
    const [showSaveModal, setShowSaveModal] = useState(false);

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [pwStatus, setPwStatus] = useState('');

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
                const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                
                if (error) {
                    console.error('Error fetching profile:', error);
                    return;
                }

                if (data) {
                    setFormData({
                        full_name: data.full_name || '',
                        username: data.username || '',
                        email: data.email || session.user.email || '',
                        board_role: data.board_role || '',
                        system_role: data.role || 'user'
                    });
                    
                    // Critical: Sync ThemeContext with DB data on load
                    if (data.car_model && MODELS.some(m => m.id === data.car_model)) {
                        setModel(data.car_model as MiniModel);
                    }
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
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        
        try {
            if (isDemoMode) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                setShowSaveModal(true);
                return;
            }

            const updates = {
                full_name: formData.full_name,
                username: formData.username,
                email: formData.email, // Updating contact email in profile
                board_role: formData.board_role,
                car_model: model, // Include current selected model
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', session?.user.id);

            if (error) throw error;

            setShowSaveModal(true);
        } catch (error: any) {
            alert('Error saving profile: ' + error.message);
        } finally {
            setSaving(false);
        }
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

    if (loading || loadingData) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin text-mini-red" size={48} />
        </div>
    );
    
    if (!session) return <Navigate to="/login" replace />;

    const INPUT_STYLE = "w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mini-red transition-all";
    const LABEL_STYLE = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

    return (
        <div className="pt-24 pb-12 px-4 max-w-6xl mx-auto min-h-screen">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 1. MAIN PROFILE CARD (Consolidated) */}
                <div className="lg:col-span-2 space-y-6">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800"
                    >
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-2">
                            <User className="text-mini-red" size={32} /> {t('profile')}
                        </h1>
                        
                        <div className="space-y-6">
                            {/* Personal Info */}
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

                            <hr className="border-slate-100 dark:border-slate-800 my-6" />

                            {/* Roles */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* System Role (Read Only) */}
                                <div>
                                    <label className={LABEL_STYLE}>System Role</label>
                                    <div className="px-5 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 font-bold border border-blue-100 dark:border-blue-800 flex items-center gap-2 uppercase text-sm">
                                        <Shield size={16} /> {formData.system_role}
                                    </div>
                                </div>
                                
                                {/* Board Role Selector */}
                                <div>
                                    <label className={LABEL_STYLE}>{t('boardRole')}</label>
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
                    </motion.div>
                    
                    {/* 2. CHANGE PASSWORD CARD */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800"
                    >
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Lock className="text-mini-red" size={20} /> {t('changePassword')}
                        </h2>
                        
                        <div className="flex flex-col gap-4">
                            <label className={LABEL_STYLE}>{t('newPassword')}</label>
                            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                                <input 
                                    type="password" 
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    minLength={6}
                                    className={INPUT_STYLE}
                                />
                                <button 
                                    onClick={handleChangePassword}
                                    disabled={!newPassword} 
                                    className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold px-8 py-3 rounded-xl hover:bg-mini-red hover:text-white dark:hover:bg-mini-red transition-all disabled:opacity-50 whitespace-nowrap"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                        
                        {pwStatus && (
                            <div className={`mt-4 p-3 rounded-xl text-sm font-bold text-center ${pwStatus.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {pwStatus}
                            </div>
                        )}
                        
                        <p className="mt-4 text-xs text-slate-400 flex items-start gap-2">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            For security reasons, your current password cannot be displayed. You may only overwrite it.
                        </p>
                    </motion.div>
                </div>

                {/* 3. CAR SELECTOR SIDEBAR (Now included in Main Save) */}
                <div className="space-y-6">
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 sticky top-24"
                    >
                         <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Car className="text-mini-red" size={24} /> {t('carType')}
                        </h2>
                        
                        <div className="grid grid-cols-2 gap-3 mb-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                            {MODELS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setModel(m.id)}
                                    className={`relative p-2 rounded-xl border-2 transition-all group overflow-hidden flex flex-col items-center
                                        ${model === m.id 
                                            ? 'border-mini-red bg-red-50 dark:bg-red-900/10 shadow-md transform scale-[1.02]' 
                                            : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 opacity-70 hover:opacity-100'}
                                    `}
                                >
                                    <div className="aspect-[4/3] w-full flex items-center justify-center mb-2">
                                        <img src={m.carImageUrl} className="w-full h-full object-contain" alt={m.name} loading="lazy" />
                                    </div>
                                    <div className="text-center w-full">
                                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{m.name}</div>
                                        <div className="text-[10px] text-slate-400">{m.years}</div>
                                    </div>
                                    {model === m.id && (
                                        <div className="absolute top-2 right-2 text-mini-red bg-white rounded-full p-0.5 shadow-sm">
                                            <CheckCircle size={14} fill="currentColor" className="text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* UNIFIED SAVE BUTTON */}
                        <button 
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-mini-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-xl font-black text-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-xl shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <><Loader2 className="animate-spin" /> Saving...</>
                            ) : (
                                <><Save size={20} /> {t('save')}</>
                            )}
                        </button>
                    </motion.div>
                </div>
            </div>

            {/* SAVE CONFIRMATION MODAL */}
            <Modal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} title="">
                <div className="text-center py-8">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Profile Updated!</h3>
                    <p className="text-slate-500 mb-6">Your profile and car settings have been successfully saved.</p>
                    <button 
                        onClick={() => setShowSaveModal(false)}
                        className="bg-mini-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-transform hover:scale-105"
                    >
                        OK
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Profile;
