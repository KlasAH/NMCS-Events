import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string) => Promise<void>; // Simplified for demo
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
      // Calls a Postgres RPC function named 'is_admin'
      const { data, error } = await supabase.rpc('is_admin');
      if (error || !data) {
        // Fallback for demo/development if RPC doesn't exist yet
        console.warn('Admin check failed or returned false. Assuming false.');
        setIsAdmin(false);
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
      // In a real app this would trigger magic link or password flow
      // For the mock structure, we don't implement the full UI here, just the context method
  }

  // Mock admin toggle for demo purposes (if no backend connected)
  const toggleMockAdmin = () => {
    setIsAdmin(!isAdmin);
    setSession(isAdmin ? null : { user: { email: 'admin@nmcs.com' } } as any);
  }

  const value = isDemoMode ? {
    session,
    isAdmin,
    loading,
    signIn: async () => {},
    signOut: async () => { toggleMockAdmin() }, // Hack to toggle in demo
  } : {
    session,
    isAdmin,
    loading,
    signIn,
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