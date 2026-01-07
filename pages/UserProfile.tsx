
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isDemoMode } from '../lib/supabase';
import { useTheme, MODELS } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { motion } from 'framer-motion';
import { User, Lock, Save, Car, CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UserProfile: React.FC = () => {
    const { session, updatePassword, loading: authLoading } = useAuth();
    const { model, setModel } = useTheme();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [carModel, setCarModel] = useState(model);
    
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    useEffect(() => {
        if (!session && !authLoading) {
            navigate('/login');
            return;
        }

        const fetchProfile = async () => {
            if (session) {
                 setEmail(session.user.email || '');

                 if (isDemoMode) {
                     setFullName("Demo User");
                     setUsername("demouser");
                     setLoading(false);
                     return;
                 }

                 // Try to fetch profile data. 
                 const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, username, car_model')
                    .eq('id', session.user.id)
                    .maybeSingle();
                 
                 if (data) {
                     setFullName(data.full_name || '');
                     setUsername(data.username || '');
                     if (data.car_model) setCarModel(data.car_model as any);
                 }
                 setLoading(false);
            }
        };
        
        fetchProfile();
    }, [session, authLoading, navigate]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            // 1. Update Password if provided
            if (newPassword) {
                if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
                if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
                
                const { error: pwdError } = await updatePassword(newPassword);
                if (pwdError) throw pwdError;
            }

            // 2. Update Profile Data
            if (!isDemoMode && session) {
                const updates = {
                    id: session.user.id, // Required for upsert
                    email: session.user.email, // Ensure email is synced
                    full_name: fullName,
                    username: username,
                    car_model: carModel,
                    updated_at: new Date().toISOString(),
                };

                // Use upsert to create profile if it doesn't exist
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert(updates);
                    
                if (profileError) throw profileError;
            }
            
            // 3. Update Theme Context locally
            setModel(carModel);

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) return <div className="min-h-screen pt-24 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 max-w-2xl mx-auto">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors"
            >
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{t('profile')}</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-8">Manage your account settings and preferences.</p>

                {message && (
                    <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {message.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                        <span className="font-bold">{message.text}</span>
                    </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-8">
                    {/* Personal Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <User size={20} className="text-mini-red" /> Personal Information
                        </h3>
                        
                        {/* Read Only Email */}
                        <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('email')}</label>
                             <div className="relative">
                                <input 
                                    type="text" 
                                    value={email}
                                    disabled
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                />
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('fullName')}</label>
                                <input 
                                    type="text" 
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-mini-red outline-none dark:text-white transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('username')}</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                                    <input 
                                        type="text" 
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g,''))}
                                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-mini-red outline-none dark:text-white transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preferences */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Car size={20} className="text-mini-red" /> Preferences
                        </h3>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">My Mini Model</label>
                             <select 
                                value={carModel}
                                onChange={(e) => setCarModel(e.target.value as any)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-mini-red outline-none dark:text-white appearance-none transition-colors cursor-pointer"
                             >
                                {MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.name} ({m.years})</option>
                                ))}
                             </select>
                        </div>
                    </div>

                    {/* Security */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Lock size={20} className="text-mini-red" /> Security
                        </h3>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 space-y-4 transition-colors">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Password</label>
                                <input 
                                    type="password" 
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Leave blank to keep current"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-mini-red outline-none dark:text-white transition-colors"
                                />
                            </div>
                            {newPassword && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Confirm Password</label>
                                    <input 
                                        type="password" 
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-mini-red outline-none dark:text-white transition-colors"
                                    />
                                </motion.div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button 
                            type="submit" 
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-3 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-black/20 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default UserProfile;
