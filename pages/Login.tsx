
import React, { useState, useEffect } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Apple, Mail, User, ArrowRight, KeyRound, CheckCircle, AtSign } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, signInWithOAuth, signUp, sendPasswordReset, updatePassword } = useAuth();
  
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

  // Check if user arrived via a password reset email link (hash params)
  useEffect(() => {
    // Supabase appends #access_token=...&type=recovery
    const hash = window.location.hash;
    const query = new URLSearchParams(window.location.search);
    if (query.get('recovery') === 'true' || (hash && hash.includes('type=recovery'))) {
        setViewState('reset-confirm');
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isDemoMode) {
        await signOut(); // Mock toggle
        navigate('/admin');
        setLoading(false);
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
            setError("Username not found. Please check your spelling or use your email.");
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
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/admin');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      // Enforce username uniqueness before trying to auth (optional but good UX)
      if (!isDemoMode) {
          const { data } = await supabase.from('profiles').select('id').eq('username', username).single();
          if (data) {
              setError("Username is already taken. Please choose another.");
              setLoading(false);
              return;
          }
      }

      const { data, error } = await signUp(email, password, fullName, username);
      
      if (error) {
          setError(error.message);
      } else if (data && data.session) {
          // If a session is returned immediately, Email Confirmation is DISABLED in Supabase.
          // We can log the user in directly.
          setSuccessMsg("Registration successful! Logging you in...");
          setTimeout(() => {
              navigate('/admin');
          }, 1500);
      } else {
          // No session returned, meaning Email Confirmation is ENABLED.
          setSuccessMsg("Registration successful! Please check your email to verify your account.");
          setTimeout(() => setViewState('login'), 5000);
      }
      setLoading(false);
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      const { error } = await sendPasswordReset(identifier);
      if (error) {
          setError(error.message);
      } else {
          setSuccessMsg("If an account exists, a password reset link has been sent to your email.");
      }
      setLoading(false);
  }

  const handleResetConfirm = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      const { error } = await updatePassword(password);
      if (error) {
          setError(error.message);
      } else {
          setSuccessMsg("Password updated successfully! Logging you in...");
          setTimeout(() => navigate('/admin'), 2000);
      }
      setLoading(false);
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
                {viewState === 'login' && 'Member Login'}
                {viewState === 'signup' && 'Join the Club'}
                {viewState === 'forgot' && 'Reset Password'}
                {viewState === 'reset-confirm' && 'New Password'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-sm">
                {viewState === 'login' && 'Access events and administration'}
                {viewState === 'signup' && 'Create your account to get started'}
                {viewState === 'forgot' && 'Enter your email to receive a secure link'}
                {viewState === 'reset-confirm' && 'Enter your new secure password'}
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
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                        <div className="relative">
                            <input
                            type="text"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-mini-red focus:border-transparent outline-none transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="John Cooper"
                            />
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Username</label>
                        <div className="relative">
                            <input
                            type="text"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-mini-red focus:border-transparent outline-none transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                            placeholder="minicooper_fan"
                            />
                            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                        <div className="relative">
                            <input
                            type="email"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-mini-red focus:border-transparent outline-none transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@nmcs.com"
                            />
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </div>
                    </div>
                    </>
                )}

                {(viewState === 'login' || viewState === 'forgot') && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email or Username</label>
                        <div className="relative">
                            <input
                            type="text"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-mini-red focus:border-transparent outline-none transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="username or email@address.com"
                            />
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </div>
                    </div>
                )}

                {(viewState === 'login' || viewState === 'signup' || viewState === 'reset-confirm') && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                            {viewState === 'login' && (
                                <button type="button" onClick={() => setViewState('forgot')} className="text-xs font-bold text-mini-red hover:underline">
                                    Forgot?
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
                    <div className="text-mini-red text-sm text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-xl font-medium border border-red-100 dark:border-red-900/50">
                    {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-mini-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 shadow-lg shadow-black/20 flex items-center justify-center gap-2"
                >
                    {loading ? 'Processing...' : (
                        viewState === 'login' ? <>Sign In <ArrowRight size={18}/></> :
                        viewState === 'signup' ? 'Create Account' :
                        viewState === 'forgot' ? 'Send Reset Link' : 'Update Password'
                    )}
                </button>
                </form>
            )}
        </AnimatePresence>

        {viewState === 'login' && (
             <div className="mt-6 text-center">
                 <p className="text-sm text-slate-500">Don't have an account?</p>
                 <button 
                    onClick={() => { setViewState('signup'); setIdentifier(''); setPassword(''); }}
                    className="text-mini-red font-bold hover:underline mt-1"
                 >
                     Register Now
                 </button>
             </div>
        )}

        {(viewState === 'signup' || viewState === 'forgot') && (
            <div className="mt-6 text-center">
                 <button 
                    onClick={() => { setViewState('login'); setSuccessMsg(null); setError(null); }}
                    className="text-slate-500 font-bold hover:text-slate-800 dark:hover:text-white text-sm"
                 >
                     Back to Login
                 </button>
             </div>
        )}

        {/* Social Login only on Login view */}
        {viewState === 'login' && !successMsg && (
            <>
                <div className="my-6 flex items-center gap-4">
                    <div className="h-px bg-slate-100 dark:bg-slate-800 flex-grow" />
                    <span className="text-xs font-bold text-slate-400 uppercase">Or</span>
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
