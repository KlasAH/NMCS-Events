
import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const checkAdmin = async (currentSession: Session) => {
    setAuthStatus('Checking Admin Role...');
    try {
      console.log(`[Auth] Checking admin status for ${currentSession.user.email}...`);
      
      // Create a timeout promise to prevent hanging forever
      const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Admin check timed out')), 10000)
      );

      const checkLogic = async () => {
          let adminStatus = false;
          let debugMsg = '';

          // CRITICAL: Create a scoped client with the specific access token.
          const scopedClient = createClient(finalUrl, finalKey, {
              global: {
                  headers: {
                      Authorization: `Bearer ${currentSession.access_token}`
                  }
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
