

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  
  const lastCheckedToken = useRef<string | null>(null);

  // SAFETY TIMEOUT: Ensure loading never stays true forever
  useEffect(() => {
      const safetyTimer = setTimeout(() => {
          if (loading) {
              console.warn("[Auth] Safety timeout triggered. Forcing app load.");
              setLoading(false);
              setAuthStatus('Timeout - Loaded anyway');
          }
      }, 8000); // 8 seconds max load time
      return () => clearTimeout(safetyTimer);
  }, [loading]);

  // SETTINGS LISTENER
  useEffect(() => {
    if (isDemoMode) return;

    const parseAndSetTimer = (val: string) => {
        const hours = parseFloat(val);
        if (!isNaN(hours) && hours > 0) {
            setAutoLogoutTime(hours * 60 * 60 * 1000);
        }
    };

    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'auto_logout_hours').maybeSingle();
        if (data?.value) parseAndSetTimer(data.value);
      } catch (e) { console.warn("Settings fetch error", e); }
    };
    fetchSettings();

    const channel = supabase.channel('app_settings_watcher')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.auto_logout_hours' },
            (payload) => {
                const newData = payload.new as { key: string, value: string } | null;
                if (newData?.value) parseAndSetTimer(newData.value);
            }
        ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // AUTH INITIALIZATION
  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      setAuthStatus('Demo Mode');
      return;
    }

    // 1. Check Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdmin(session);
      } else {
        setLoading(false);
        setAuthStatus('No Session');
      }
    }).catch(err => {
        console.error("[Auth] Get session error:", err);
        setLoading(false);
    });

    // 2. Listen for Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      if (session) {
          if (session.access_token !== lastCheckedToken.current) {
              if (!isAdmin) setLoading(true); 
              checkAdmin(session);
          } else {
              setLoading(false);
          }
      } else {
          lastCheckedToken.current = null;
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
          timeoutId = setTimeout(() => {
              console.log("[Auth] Auto-logging out");
              signOut();
          }, autoLogoutTime);
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
    setAuthStatus('Checking Permissions...');
    lastCheckedToken.current = currentSession.access_token;
    
    // Safety: If checking takes too long, stop loading
    const timer = setTimeout(() => setLoading(false), 5000);

    try {
      // Use global client - it should be synced by now or will be shortly.
      // We rely on RLS anyway.
      
      let adminStatus = false;
      let debugMsg = '';

      // 1. Check Profiles Table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentSession.user.id)
        .maybeSingle();

      if (profile) {
          const role = (profile.role || '').toLowerCase().trim();
          if (role === 'admin' || role === 'board') adminStatus = true;
          debugMsg = `Role: ${role}`;
      } else if (profileError) {
          console.warn("[Auth] Profile fetch error:", profileError);
          debugMsg = `Error: ${profileError.message}`;
      }

      // 2. Fallback: RPC
      if (!adminStatus) {
        const { data: rpcIsAdmin } = await supabase.rpc('is_admin');
        if (rpcIsAdmin === true) {
            adminStatus = true;
            debugMsg += " (RPC: Yes)";
        }
      }

      setIsAdmin(adminStatus);
      setAuthStatus(adminStatus ? 'Access Granted' : `User Access (${debugMsg})`);

    } catch (e: any) {
      console.error("[Auth] Check admin failed:", e);
      setIsAdmin(false);
      setAuthStatus('Permission Check Failed');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const signOut = async () => {
    setSession(null);
    setIsAdmin(false);
    setLoading(false);
    lastCheckedToken.current = null;
    if (!isDemoMode) await supabase.auth.signOut();
  };

  const signIn = async (email: string) => {
      if (isDemoMode) {
          setIsAdmin(true);
          setSession({ access_token: 'mock', token_type: 'bearer', expires_in: 3600, refresh_token: 'mock', user: { id: 'mock', aud: 'authenticated', role: 'authenticated', email: email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
      }
  };

  const signUp = async (email: string, password: string, fullName: string, username: string) => {
    if (isDemoMode) return { error: null, data: { session: null } }; 
    return await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, username: username } }
    });
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

  const value = { session, isAdmin, loading, authStatus, signIn, signInWithOAuth, signUp, sendPasswordReset, updatePassword, signOut, checkAdmin };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
