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

    // GLOBAL SAFETY VALVE: Force loading to stop after 7 seconds no matter what
    const safetyTimeout = setTimeout(() => {
        if (mounted) {
            setLoading((prev) => {
                if (prev) {
                    console.warn("AuthContext: Global safety timeout triggered. Forcing loading false.");
                    return false;
                }
                return prev;
            });
        }
    }, 7000);

    if (isDemoMode) {
      setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    const initSession = async () => {
      try {
        // Wrap getSession in a timeout too, just in case Supabase client hangs
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{data: {session: Session | null}}>((_, reject) => 
            setTimeout(() => reject(new Error('getSession timeout')), 4000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (mounted) {
          setSession(session);
          if (session) {
             await checkAdmin(session);
          } else {
             setLoading(false);
          }
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
        // Only trigger checkAdmin if we have a session. 
        // If signing out (session null), isAdmin should be false.
        if (session) {
            checkAdmin(session);
        } else {
            setIsAdmin(false);
            setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const checkAdmin = async (currentSession: Session | null) => {
    if (!currentSession) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // We don't want to set loading=true here if it's already false, 
    // to avoid flickering UI on re-checks, unless it's the initial load.
    // However, for safety in this specific debugging scenario, we handle state carefully below.

    try {
        const isAdminResult = await Promise.race([
            performAdminCheck(currentSession),
            new Promise<boolean>((_, reject) => 
                setTimeout(() => reject(new Error('Admin check execution timed out')), 5000)
            )
        ]);
        
        setIsAdmin(isAdminResult);
    } catch (e) {
        console.warn('Admin check failed or timed out:', e);
        // On error, assume false to allow restricted access screen to show (instead of infinite spinner)
        setIsAdmin(false);
    } finally {
        setLoading(false);
    }
  };

  const performAdminCheck = async (session: Session): Promise<boolean> => {
      try {
        // 1. Try RPC (preferred)
        // We use maybeSingle or catch error to be safe
        const { data: rpcData, error: rpcError } = await supabase.rpc('is_admin');
        if (!rpcError && typeof rpcData === 'boolean') {
            return rpcData;
        }

        console.log("RPC check failed, trying fallback tables...");

        // 2. Fallback: Direct Query (Profiles)
        // Be careful of RLS recursion here. If 'profiles' has a policy that calls 'is_admin', 
        // and 'is_admin' queries 'profiles', we get a loop.
        // We attempt to read 'role' directly.
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();
            
        if (!profileError && profile) {
            return profile.role === 'admin' || profile.role === 'board';
        }
        
        // 3. Legacy Fallback (User Roles)
        const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (!roleError && roleData) {
            return roleData.role === 'admin' || roleData.role === 'board';
        }

        return false;
        
      } catch (err) {
          console.error("Exception during admin check:", err);
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
    // Force reload to clear any weird cached states
    window.location.reload();
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