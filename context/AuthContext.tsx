
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Session, Provider } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  authStatus: string;
  signIn: (email: string) => Promise<void>;
  signInWithOAuth: (provider: Provider) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<{ error: any; data: any }>;
  sendPasswordReset: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkAdmin: (currentSession: Session) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<string>('Initializing...');
  const [autoLogoutTime, setAutoLogoutTime] = useState<number>(8 * 60 * 60 * 1000); // Default 8 hours

  // SETTINGS LISTENER
  useEffect(() => {
    if (isDemoMode) return;

    const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'auto_logout_hours').maybeSingle();
      if (data?.value) {
        const hours = parseFloat(data.value);
        if (!isNaN(hours) && hours > 0) setAutoLogoutTime(hours * 60 * 60 * 1000);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      setAuthStatus('Demo Mode');
      return;
    }

    // 1. Initialize Session
    const initSession = async () => {
        try {
            const { data: { session: initSession }, error } = await supabase.auth.getSession();
            
            if (error) throw error;
            
            setSession(initSession);
            if (initSession) {
                await checkAdmin(initSession);
            } else {
                setLoading(false);
                setAuthStatus('No Session');
            }
        } catch (error) {
            console.warn("[Auth] Init failed:", error);
            setSession(null);
            setLoading(false);
            setAuthStatus('Error Initializing');
        }
    };

    initSession();

    // 2. Listen for Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // Ignore initial session event as we handle it manually above to prevent race conditions
      if (event === 'INITIAL_SESSION') return;

      console.log(`[Auth] Event: ${event}`);
      setSession(newSession);

      if (newSession) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
             await checkAdmin(newSession);
          }
      } else if (event === 'SIGNED_OUT') {
          setIsAdmin(false);
          setLoading(false);
          setAuthStatus('Signed Out');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // INACTIVITY TRACKER
  useEffect(() => {
      if (!session) return;
      let timeoutId: ReturnType<typeof setTimeout>;
      const resetTimer = () => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => signOut(), autoLogoutTime);
      };
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach(event => document.addEventListener(event, resetTimer));
      resetTimer();
      return () => {
          if (timeoutId) clearTimeout(timeoutId);
          events.forEach(event => document.removeEventListener(event, resetTimer));
      };
  }, [session, autoLogoutTime]);

  const checkAdmin = async (currentSession: Session) => {
    setAuthStatus('Checking permissions...');
    
    // 1. Fast path: Check metadata
    if (currentSession.user.app_metadata?.role === 'admin' || currentSession.user.user_metadata?.role === 'admin') {
        setIsAdmin(true);
        setLoading(false);
        setAuthStatus('Access Granted (Meta)');
        return;
    }

    try {
      // 2. Check Profiles Table
      const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentSession.user.id)
          .single();

      if (!error && (profile?.role === 'admin' || profile?.role === 'board')) {
          setIsAdmin(true);
          setAuthStatus('Access Granted (DB)');
      } else {
          // 3. Fallback: Check RPC if profile fails (redundancy)
          const { data: isRpcAdmin } = await supabase.rpc('is_admin');
          if (isRpcAdmin) {
              setIsAdmin(true);
              setAuthStatus('Access Granted (RPC)');
          } else {
              setIsAdmin(false);
              setAuthStatus('Access Restricted');
          }
      }
    } catch (e) {
      console.error("Admin check failed", e);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setSession(null);
    setIsAdmin(false);
    setLoading(false);
    setAuthStatus('Signed Out');
    if (!isDemoMode) await supabase.auth.signOut();
  };

  const signIn = async (email: string) => {
      if (isDemoMode) {
          setIsAdmin(true);
          setSession({ access_token: 'mock', token_type: 'bearer', expires_in: 3600, refresh_token: 'mock', user: { id: 'mock', aud: 'auth', role: 'auth', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
      }
  };

  const signUp = async (email: string, password: string, fullName: string, username: string) => {
    if (isDemoMode) return { error: null, data: { session: null } }; 
    return await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, username } } });
  }

  const signInWithOAuth = async (provider: Provider) => {
    if (isDemoMode) { alert("Demo Mode"); return; }
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + '/admin' } });
  }

  const sendPasswordReset = async (email: string) => {
      if (isDemoMode) return { error: null };
      return await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/login?recovery=true' });
  }

  const updatePassword = async (newPassword: string) => {
      if (isDemoMode) return { error: null };
      return await supabase.auth.updateUser({ password: newPassword });
  }

  return (
    <AuthContext.Provider value={{ session, isAdmin, loading, authStatus, signIn, signInWithOAuth, signUp, sendPasswordReset, updatePassword, signOut, checkAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
