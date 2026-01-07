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
    let mounted = true;

    if (isDemoMode) {
      setLoading(false);
      return;
    }

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(session);
          await checkAdmin(session);
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        checkAdmin(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkAdmin = async (currentSession: Session | null) => {
    if (!currentSession) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
        // Enforce a hard timeout using Promise.race
        // If the DB check hangs, this ensures the app loads (as non-admin) after 5 seconds
        const isAdminResult = await Promise.race([
            performAdminCheck(currentSession),
            new Promise<boolean>((_, reject) => 
                setTimeout(() => reject(new Error('Admin check timed out')), 5000)
            )
        ]);
        
        setIsAdmin(isAdminResult);
    } catch (e) {
        console.warn('Admin check timed out or failed:', e);
        // Default to false on error so the app loads the "Restricted" screen instead of spinning forever
        setIsAdmin(false);
    } finally {
        setLoading(false);
    }
  };

  const performAdminCheck = async (session: Session): Promise<boolean> => {
      try {
        // 1. Try RPC (preferred)
        const { data: rpcData, error: rpcError } = await supabase.rpc('is_admin');
        if (!rpcError && typeof rpcData === 'boolean') {
            return rpcData;
        }

        // 2. Fallback: Direct Query
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
            
        if (profile) {
            return profile.role === 'admin' || profile.role === 'board';
        }
        
        // 3. Legacy Fallback
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();

        return roleData?.role === 'admin' || roleData?.role === 'board';
        
      } catch (err) {
          console.error("Error during admin check execution:", err);
          return false;
      }
  };

  const signOut = async () => {
    if (isDemoMode) {
        setSession(null);
        setIsAdmin(false);
        return;
    }
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };

  const signIn = async (email: string) => {
      if (isDemoMode) {
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
          redirectTo: window.location.origin + '/#/login?recovery=true',
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