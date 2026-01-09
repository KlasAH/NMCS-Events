
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Session, Provider } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signInWithOAuth: (provider: Provider) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<{ error: any; data: any }>;
  sendPasswordReset: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    // Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdmin(session);
      } else {
        setLoading(false);
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
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async (currentSession: Session) => {
    try {
      console.log(`[Auth] Checking admin status for ${currentSession.user.email}...`);
      
      // Create a timeout promise to prevent hanging forever
      const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Admin check timed out')), 10000)
      );

      const checkLogic = async () => {
          let adminStatus = false;

          // 1. PRIMARY CHECK: Check the 'profiles' table directly.
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentSession.user.id)
            .single();

          if (profile) {
              console.log(`[Auth] Profile role found: ${profile.role}`);
              if (profile.role === 'admin' || profile.role === 'board') {
                  adminStatus = true;
              }
          } else if (profileError) {
              console.warn("[Auth] Profile fetch error:", profileError.message);
          }

          // 2. FALLBACK: Try RPC if profile check was inconclusive or failed
          if (!adminStatus) {
            const { data: rpcIsAdmin, error: rpcError } = await supabase.rpc('is_admin');
            if (!rpcError && rpcIsAdmin === true) {
                console.log("[Auth] RPC 'is_admin' returned true");
                adminStatus = true;
            }
          }

          // 3. LEGACY FALLBACK: Check 'user_roles' table
          if (!adminStatus) {
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', currentSession.user.id)
                .single();
            
            if (roleData?.role === 'admin' || roleData?.role === 'board') {
                console.log("[Auth] Legacy 'user_roles' found admin");
                adminStatus = true;
            }
          }
          return adminStatus;
      };

      // Race the check against the timeout
      const result = await Promise.race([checkLogic(), timeoutPromise]);
      
      console.log(`[Auth] Final Admin Status: ${result}`);
      setIsAdmin(result as boolean);

    } catch (e) {
      console.error("Error checking admin status (or timeout):", e);
      // Default to false on error/timeout so user can at least see the UI
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // Optimistic UI update: Clear state immediately
    setSession(null);
    setIsAdmin(false);
    setLoading(false);

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
    signIn,
    signInWithOAuth,
    signUp,
    sendPasswordReset,
    updatePassword,
    signOut,
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
