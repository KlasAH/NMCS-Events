import React, { useState, useEffect } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Eye, EyeOff, Apple, Mail, User, ArrowRight, CheckCircle, AtSign, AlertTriangle } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signIn, signInWithOAuth, signUp, sendPasswordReset, updatePassword } = useAuth();
  const { t } = useLanguage();
  
  // 'login' | 'signup' | 'forgot' | 'reset-confirm'
  const [viewState, setViewState] = useState<'login' | 'signup' | 'forgot' | 'reset-confirm'>('login');
  
  const [identifier, setIdentifier] = useState(''); // Email or Username
  const [username, setUsername] = useState(''); // For Signup only
  const [email, setEmail] = useState(''); // For Signup only
  
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if user arrived via a password reset email link
  // This must run before session check to ensure viewState is set correctly
  useEffect(() => {
    const hash = window.location.hash;
    const query = new URLSearchParams(window.location.search);
    // Check for recovery params in query OR hash (Supabase puts them in hash usually)
    const isRecovery = query.get('recovery') === 'true' || 
                       (hash && hash.includes('type=recovery')) ||
                       (hash && hash.includes('recovery=true'));
                       
    if (isRecovery) {
        setViewState('reset-confirm');
    }
  }, [location]);

  // Redirect if session becomes active (Login successful)
  useEffect(() => {
    // CRITICAL: Do not redirect if we are in the middle of a password reset flow (reset-confirm).
    // The link logs the user in, but we need them to stay here to type the new password.
    const isRecoveryFlow = viewState === 'reset-confirm' || 
                           window.location.hash.includes('type=recovery') ||
                           window.location.href.includes('recovery=true');

    if (session && !isRecoveryFlow) {
        // Use replace to prevent going back to login page
        navigate('/admin', { replace: true });
    }
  }, [session, navigate, viewState]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isDemoMode) {
        // Trigger session update in context. 
        // The useEffect above will handle navigation once session is set.
        await signIn(identifier);
        // Do NOT navigate manually here to avoid race conditions.
        return; 
    }

    let signInEmail = identifier;

    // Logic: Check if identifier is an email (contains @). If not, assume it's a username and lookup email.
    if (!identifier.includes('@')) {
        const { data, error: lookupError } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', identifier)
            .single();
        
        if (lookupError || !data) {
            setError(t('userNotFound'));
            setLoading(false);
            return;
        }
        signInEmail = data.email;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password,
    });

    if (error) {
      setError(error.message === "Invalid login credentials" ? t('invalidCreds') : error.message);
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
        if (!isDemoMode) {
            const { data } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
            if (data) {
                setError(t('usernameTaken'));
                setLoading(false);
                return;
            }
        }

        const { data, error } = await signUp(email, password, fullName, username);
        
        if (error) {
            console.error("SignUp Error:", error);
            if (error.message?.includes('Database error saving new user')) {
                 setError('Technical Issue: The database could not save your profile. Please ask an admin to run the database repair script.');
            } else if (error.message?.includes('violates unique constraint')) {
                 setError('This email or username is already registered.');
            } else {
                 setError(error.message);
            }
        } else if (data && data.session) {
            setSuccessMsg(t('successReg') + " " + t('processing'));
            // Session update will trigger redirect
        } else {
            setSuccessMsg(t('successReg') + " " + t('checkEmail'));
            setTimeout(() => setViewState('login'), 5000);
        }
      } catch (err: any) {
         console.error(err);
         setError(err.message || t('unexpectedError'));
      } finally {
        setLoading(false);
      }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      let resetEmail = identifier;

      try {
        // If identifier is NOT an email, look it up first
        if (!identifier.includes('@') && !isDemoMode) {
            const { data, error: lookupError } = await supabase
                .from('profiles')
                .select('email')
                .eq('username', identifier)
                .single();
            
            if (lookupError || !data) {
                setError(t('userNotFound'));
                setLoading(false);
                return;
            }
            resetEmail = data.email;
        }

        const { error } = await sendPasswordReset(resetEmail);
        if (error) {
            setError(error.message);
        } else {
            setSuccessMsg(t('checkEmail'));
        }
      } catch (err: any) {
        setError(err.message || "Error processing request");
      } finally {
        setLoading(false);
      }
  }

  const handleResetConfirm = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      const { error } = await updatePassword(password);
      if (error) {
          setError(error.message);
          setLoading(false);
      } else {
          setSuccessMsg("Password updated successfully! Logging you in...");
          // Force redirect after a short delay
          setTimeout(() => {
              navigate('/admin', { replace: true });
          }, 2000);
      }
  }

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
      try {
          await signInWithOAuth(provider);
      } catch (err) {
          setError('Failed to initiate social login');
      }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 transition-colors">
      <motion.div 
        layout
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800 transition-colors"
      >
        <div className="text-center mb-6">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {viewState === 'login' && t('loginHeader')}
                {viewState === 'signup' && t('signupHeader')}
                {viewState === 'forgot' && t('forgotHeader')}
                {viewState === 'reset-confirm' && t('resetConfirmHeader')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-sm">
                {viewState === 'login' && t('loginSub')}
                {viewState === 'signup' && t('signupSub')}
                {viewState === 'forgot' && t('forgotSub')}
                {viewState === 'reset-confirm' && t('resetConfirmSub')}
            </p>
        </div>

        <AnimatePresence mode='wait'>
            {successMsg ? (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 p-6 rounded-xl text-center mb-6"
                >
                    <CheckCircle className="mx-auto mb-2 text-green-600" size={32} />
                    <p className="font-bold">{successMsg}</p>
                </motion.div>
            ) : (
                <form 
                    onSubmit={
                        viewState === 'login' ? handleLogin : 
                        viewState === 'signup' ? handleSignUp : 
                        viewState === 'forgot' ? handleForgotPassword :
                        handleResetConfirm
                    } 
                    className="space-y-4"
                >
                
                {viewState === 'signup' && (
                    <>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('fullName')}</label>
                        <div className="relative">
                            <input
                            type="text"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-mini-red focus:border-transparent outline-none transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Klas Ahlman"
                            />
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('username')}</label>
                        <div className="relative">
                            <input
                            type="text"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-mini-red focus:border-transparent outline-none transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                            placeholder="@ klasa"
                            />
                            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('email')}</label>
                        <div className="relative">
                            <input
                            type="email"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-mini-red focus:border-transparent outline-none transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="klas.ahlman@gmail.com"
                            />
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </div>
                    </div>
                    </>
                )}

                {(viewState === 'login' || viewState === 'forgot') && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('emailOrUsername')}</label>
                        <div className="relative">
                            <input
                            type="text"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-mini-red focus:border-transparent outline-none transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder={t('emailOrUsernamePlaceholder')}
                            />
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </div>
                    </div>
                )}

                {(viewState === 'login' || viewState === 'signup' || viewState === 'reset-confirm') && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t('password')}</label>
                            {viewState === 'login' && (
                                <button type="button" onClick={() => setViewState('forgot')} className="text-xs font-bold text-mini-red hover:underline">
                                    {t('forgotBtn')}
                                </button>
                            )}
                        </div>
                        <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-mini-red focus:border-transparent outline-none transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white pr-12"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-mini-black dark:hover:text-white transition-colors focus:outline-none p-1"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-mini-red text-sm text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-xl font-medium border border-red-100 dark:border-red-900/50 flex flex-col items-center gap-1">
                        <AlertTriangle size={18} className="mb-1" />
                        <span>{error}</span>
                    </div>
                )}

                {viewState === 'signup' ? (
                     <div className="space-y-3 pt-2">
                         <button
                            type="button"
                            onClick={() => { setViewState('login'); setError(null); }}
                            className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition-all"
                         >
                            {t('hasAccount')}
                         </button>
                         <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                         >
                            {loading ? t('creatingAccount') : t('createAccount')}
                         </button>
                     </div>
                ) : (
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 shadow-lg shadow-black/20 flex items-center justify-center gap-2"
                    >
                        {loading ? t('processing') : (
                            viewState === 'login' ? <>{t('signIn')} <ArrowRight size={18}/></> :
                            viewState === 'forgot' ? t('sendResetLink') : t('updatePassword')
                        )}
                    </button>
                )}
                </form>
            )}
        </AnimatePresence>

        {viewState === 'login' && (
             <div className="mt-6 text-center">
                 <p className="text-sm text-slate-500">{t('noAccount')}</p>
                 <button 
                    onClick={() => { setViewState('signup'); setIdentifier(''); setPassword(''); }}
                    className="text-mini-red font-bold hover:underline mt-1"
                 >
                     {t('registerNow')}
                 </button>
             </div>
        )}

        {(viewState === 'signup' || viewState === 'forgot') && (
            <div className="mt-6 text-center">
                 <button 
                    onClick={() => { setViewState('login'); setSuccessMsg(null); setError(null); }}
                    className="text-slate-500 font-bold hover:text-slate-800 dark:hover:text-white text-sm"
                 >
                     {t('backToLogin')}
                 </button>
             </div>
        )}

        {/* Social Login only on Login view */}
        {viewState === 'login' && !successMsg && (
            <>
                <div className="my-6 flex items-center gap-4">
                    <div className="h-px bg-slate-100 dark:bg-slate-800 flex-grow" />
                    <span className="text-xs font-bold text-slate-400 uppercase">{t('or')}</span>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 flex-grow" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => handleSocialLogin('google')}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 font-bold text-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Google
                    </button>
                    <button 
                        onClick={() => handleSocialLogin('apple')}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 font-bold text-sm"
                    >
                        <Apple size={20} className="text-black dark:text-white" />
                        Apple
                    </button>
                </div>
            </>
        )}
      </motion.div>
    </div>
  );
};

export default Login;