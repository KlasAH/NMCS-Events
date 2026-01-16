

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase, isDemoMode, finalUrl, finalKey } from '../lib/supabase';
import { Session, Provider, createClient } from '@supabase/supabase-js';

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
  
  // Track last checked access token to prevent redundant checks
  const lastCheckedToken = useRef<string | null>(null);

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

    // Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        // Always check on first load
        checkAdmin(session);
      } else {
        setLoading(false);
        setAuthStatus('No Session');
      }
    });

    // Listen for Auth Changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      if (session) {
          // Optimization: Only check admin if token changed significantly or we haven't checked yet
          if (session.access_token !== lastCheckedToken.current) {
              if (!isAdmin) setLoading(true); // Only set loading if we aren't already admin to avoid flicker
              checkAdmin(session);
          } else {
              // Same session, assume admin state is stable. Ensure loading is false.
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
              console.log("[Auth] Auto-logging out due to inactivity");
              signOut();
              // Optional: Show alert before redirect
              // alert("You have been logged out due to inactivity.");
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
    lastCheckedToken.current = currentSession.access_token;
    
    try {
      console.log(`[Auth] Checking admin status for ${currentSession.user.email}...`);
      
      // Create a timeout promise (Increased to 20s for cold starts)
      const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Admin check timed out (20s)')), 20000)
      );

      const checkLogic = async () => {
          let adminStatus = false;
          let debugMsg = '';

          // CRITICAL: Create a scoped client with the specific access token.
          // FIX: Disable auth persistence to avoid "Multiple GoTrueClient" warnings and storage conflicts.
          const scopedClient = createClient(finalUrl, finalKey, {
              global: {
                  headers: {
                      Authorization: `Bearer ${currentSession.access_token}`
                  }
              },
              auth: {
                  persistSession: false, 
                  autoRefreshToken: false,
                  detectSessionInUrl: false,
                  storageKey: 'memory' 
              }
          });

          // 1. PRIMARY CHECK: Check the 'profiles' table directly using the scoped client.
          const { data: profile, error: profileError } = await scopedClient
            .from('profiles')
            .select('role')
            .eq('id', currentSession.user.id)
            .single();

          if (profile) {
              console.log(`[Auth] Profile role found: ${profile.role}`);
              debugMsg += `Profile Role: ${profile.role}. `;
              const role = (profile.role || '').toLowerCase().trim();
              if (role === 'admin' || role === 'board') {
                  adminStatus = true;
              }
          } else if (profileError) {
              console.warn("[Auth] Profile fetch error:", profileError.message);
              debugMsg += `Profile Error: ${profileError.message}. `;
          } else {
              debugMsg += `Profile not found. `;
          }

          // 2. FALLBACK: Try RPC if profile check was inconclusive or failed
          if (!adminStatus) {
            const { data: rpcIsAdmin, error: rpcError } = await scopedClient.rpc('is_admin');
            if (!rpcError && rpcIsAdmin === true) {
                console.log("[Auth] RPC 'is_admin' returned true");
                adminStatus = true;
                debugMsg += `RPC: True. `;
            } else if (rpcError) {
                debugMsg += `RPC Error: ${rpcError.message}. `;
            } else {
                debugMsg += `RPC: False. `;
            }
          }

          return { adminStatus, debugMsg };
      };

      // Race the check against the timeout
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
    lastCheckedToken.current = null;

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
