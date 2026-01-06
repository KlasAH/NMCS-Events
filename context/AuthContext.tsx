
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkAdmin(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      checkAdmin(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async (session: Session | null) => {
    if (!session) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (error || !data) {
        const { data: profileData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
            
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();
            
        const role = profileData?.role || roleData?.role;
        setIsAdmin(role === 'admin' || role === 'board');
      } else {
        setIsAdmin(true);
      }
    } catch (e) {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (isDemoMode) {
        setSession(null);
        setIsAdmin(false);
        return;
    }
    await supabase.auth.signOut();
    setIsAdmin(false);
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
      // For real mode, signIn is handled via supabase.auth directly in components usually, 
      // or we could wrap it here.
  };

  const signUp = async (email: string, password: string, fullName: string, username: string) => {
    if (isDemoMode) {
        // Mock successful signup
        return { error: null, data: { session: null } }; // Return null session to simulate email verification required
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
        