
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isDemoMode, finalUrl, finalKey } from '../lib/supabase';
import { Session, Provider } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  authStatus: string; // New: Expose status for UI debugging
  signIn: (email: string) => Promise<void>;
  signInWithOAuth: (provider: Provider) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<{ error: any; data: any }>;
  sendPasswordReset: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkAdmin: (currentSession: Session) => Promise<void>; // Exposed for manual retry
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<string>('Initializing...');
  const [autoLogoutTime, setAutoLogoutTime] = useState<number>(8 * 60 * 60 * 1000); // Default 8 hours

  // SETTINGS LISTENER (Realtime)
  useEffect(() => {
    if (isDemoMode) return;

    const parseAndSetTimer = (val: string) => {
        const hours = parseFloat(val);
        if (!isNaN(hours) && hours > 0) {
            console.log(`[Auth] Updating Auto-Logout to ${hours} hours`);
            setAutoLogoutTime(hours * 60 * 60 * 1000);
        }
    };

    // 1. Initial Fetch
    const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'auto_logout_hours').maybeSingle();
      if (data?.value) {
          parseAndSetTimer(data.value);
      }
    };
    fetchSettings();

    // 2. Realtime Subscription
    const channel = supabase.channel('app_settings_watcher')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'app_settings',
                filter: 'key=eq.auto_logout_hours'
            },
            (payload) => {
                // Handle UPDATE and INSERT
                const newData = payload.new as { key: string, value: string } | null;
                if (newData?.value) {
                    parseAndSetTimer(newData.value);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      setAuthStatus('Demo Mode');
      return;
    }

    // Initial Session Check with Timeout Safeguard
    // If local storage is corrupted, getSession() can hang indefinitely.
    const initSession = async () => {
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Auth Init Timeout')), 5000)
            );

            const { data } = await Promise.race([
                supabase.auth.getSession(),
                timeoutPromise
            ]) as any;

            setSession(data.session);
            if (data.session) {
                checkAdmin(data.session);
            } else {
                setLoading(false);
                setAuthStatus('No Session');
            }
        } catch (error) {
            console.warn("[Auth] Session check failed or timed out. Clearing session state to unblock UI.", error);
            // Fallback: Assume public user if auth fails to initialize
            setSession(null);
            setLoading(false);
            setAuthStatus('Auth Timeout (Public Fallback)');
        }
    };

    initSession();

    // Listen for Auth Changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
          // Reset loading to true to prevent premature 'Restricted' access during role check
          // Only set loading if we aren't already admin, to avoid UI flickering
          if (!isAdmin) setLoading(true);
          checkAdmin(session);
      } else {
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
              console.log("[Auth] Auto-logging out due to inactivity");
              signOut();
          }, autoLogoutTime);
      };

      const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach(event => document.addEventListener(event, resetTimer));
      
      resetTimer(); // Start immediately

      return () => {
          if (timeoutId) clearTimeout(timeoutId);
          events.forEach(event => document.removeEventListener(event, resetTimer));
      };
  }, [session, autoLogoutTime]);

  const checkAdmin = async (currentSession: Session) => {
    setAuthStatus('Checking Admin Role...');
    try {
      console.log(`[Auth] Checking admin status for ${currentSession.user.email}...`);
      
      const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Admin check timed out')), 20000)
      );

      const checkLogic = async () => {
          let adminStatus = false;
          let debugMsg = '';

          // USE RAW FETCH to avoid creating a secondary SupabaseClient (which can trigger broadcast logout bugs)
          const headers = {
              'apikey': finalKey,
              'Authorization': `Bearer ${currentSession.access_token}`,
              'Content-Type': 'application/json'
          };

          // 1. PRIMARY CHECK: Fetch Profile via REST
          // Equivalent to: .from('profiles').select('role').eq('id', uid).single()
          try {
              const profileRes = await fetch(`${finalUrl}/rest/v1/profiles?id=eq.${currentSession.user.id}&select=role`, {
                  method: 'GET',
                  headers
              });

              if (profileRes.ok) {
                  const rows = await profileRes.json();
                  if (rows.length > 0) {
                      const role = (rows[0].role || '').toLowerCase().trim();
                      debugMsg += `Profile Role: ${role}. `;
                      if (role === 'admin' || role === 'board') {
                          adminStatus = true;
                      }
                  } else {
                      debugMsg += `Profile not found. `;
                  }
              } else {
                  debugMsg += `Profile Fetch Error ${profileRes.status}. `;
              }
          } catch (err: any) {
               debugMsg += `Profile Fetch Failed: ${err.message}. `;
          }

          // 2. FALLBACK: RPC 'is_admin' via REST
          if (!adminStatus) {
            try {
                const rpcRes = await fetch(`${finalUrl}/rest/v1/rpc/is_admin`, {
                    method: 'POST',
                    headers,
                    body: '{}'
                });
                
                if (rpcRes.ok) {
                    const isAdminRpc = await rpcRes.json();
                    if (isAdminRpc === true) {
                        adminStatus = true;
                        debugMsg += `RPC: True. `;
                    } else {
                        debugMsg += `RPC: False. `;
                    }
                } else {
                    debugMsg += `RPC Error ${rpcRes.status}. `;
                }
            } catch (err: any) {
                debugMsg += `RPC Failed: ${err.message}. `;
            }
          }

          return { adminStatus, debugMsg };
      };

      const result: any = await Promise.race([checkLogic(), timeoutPromise]);
      
      console.log(`[Auth] Final Admin Status: ${result.adminStatus}`);
      setIsAdmin(result.adminStatus as boolean);
      setAuthStatus(result.adminStatus ? 'Access Granted' : `Access Denied. ${result.debugMsg}`);

    } catch (e: any) {
      console.error("Error checking admin status (or timeout):", e);
      setIsAdmin(false);
      setAuthStatus(`Error: ${e.message || 'Unknown Check Error'}`);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // Optimistic UI update: Clear state immediately
    setSession(null);
    setIsAdmin(false);
    setLoading(false);
    setAuthStatus('Signed Out');

    if (isDemoMode) return;

    try {
        await supabase.auth.signOut();
    } catch (err) {
        console.error("Sign out error:", err);
    }
  };

  const signIn = async (email: string) => {
      if (isDemoMode) {
          // Mock successful login
          setIsAdmin(true);
          setSession({ 
              access_token: 'mock', 
              token_type: 'bearer', 
              expires_in: 3600, 
              refresh_token: 'mock', 
              user: { 
                  id: 'mock-user-id', 
                  aud: 'authenticated', 
                  role: 'authenticated', 
                  email: email || 'admin@nmcs.com',
                  app_metadata: {},
                  user_metadata: {},
                  created_at: new Date().toISOString()
              } 
          });
      }
  };

  const signUp = async (email: string, password: string, fullName: string, username: string) => {
    if (isDemoMode) {
        return { error: null, data: { session: null } }; 
    }
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                username: username,
            }
        }
    });
    return { data, error };
  }

  const signInWithOAuth = async (provider: Provider) => {
    if (isDemoMode) {
        alert("OAuth not available in Demo Mode");
        return;
    }
    await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
            redirectTo: window.location.origin + '/admin'
        }
    });
  }

  const sendPasswordReset = async (email: string) => {
      if (isDemoMode) {
          console.log(`Mock reset email sent to ${email}`);
          return { error: null };
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/login?recovery=true',
      });
      return { error };
  }

  const updatePassword = async (newPassword: string) => {
      if (isDemoMode) {
          return { error: null };
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error };
  }

  const value = {
    session,
    isAdmin,
    loading,
    authStatus,
    signIn,
    signInWithOAuth,
    signUp,
    sendPasswordReset,
    updatePassword,
    signOut,
    checkAdmin
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
