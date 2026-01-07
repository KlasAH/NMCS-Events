import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  
  // Ref to track if a check is currently in progress
  const checkingRef = useRef(false);
  // Ref to track if component is mounted to prevent state updates on unmount
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
        isMounted.current = false;
        checkingRef.current = false; // Reset lock on unmount
    };
  }, []);

  const performAdminCheck = async (session: Session): Promise<boolean> => {
      try {
        // 1. Try RPC (preferred)
        const { data: rpcData, error: rpcError } = await supabase.rpc('is_admin');
        if (!rpcError && typeof rpcData === 'boolean') {
            return rpcData;
        }

        // 2. Fallback: Direct Query (Profiles)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();
            
        if (!profileError && profile) {
            return profile.role === 'admin' || profile.role === 'board';
        }
        
        return false;
      } catch (err) {
          console.error("Exception during admin check:", err);
          return false;
      }
  };

  const checkAdmin = async (currentSession: Session | null) => {
    if (!isMounted.current) return;

    if (!currentSession) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
        console.log("Starting admin check...");
        
        // Non-throwing timeout: Resolves false after 2500ms
        const timeoutPromise = new Promise<boolean>((resolve) => 
            setTimeout(() => {
                console.warn("AuthContext: Admin check timed out, defaulting to false");
                resolve(false); 
            }, 2500)
        );

        const isAdminResult = await Promise.race([
            performAdminCheck(currentSession),
            timeoutPromise
        ]);
        
        console.log("Admin check result:", isAdminResult);
        if (isMounted.current) setIsAdmin(isAdminResult);
    } catch (e) {
        console.warn('Admin check failed:', e);
        if (isMounted.current) setIsAdmin(false);
    } finally {
        if (isMounted.current) {
            checkingRef.current = false;
            setLoading(false);
        }
    }
  };

  useEffect(() => {
    // GLOBAL SAFETY VALVE: Force loading to stop after 5 seconds no matter what
    const safetyTimeout = setTimeout(() => {
        if (isMounted.current && loading) {
            console.warn("AuthContext: Global safety timeout triggered. Forcing loading false.");
            setLoading(false);
        }
    }, 5000);

    if (isDemoMode) {
      if (isMounted.current) setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (isMounted.current) {
          setSession(session);
          if (session) {
             await checkAdmin(session);
          } else {
             setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        if (isMounted.current) setLoading(false);
      }
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted.current) {
        setSession(session);
        if (session) {
            // Only check if we aren't already checking
            if (!checkingRef.current) {
                checkAdmin(session);
            }
        } else {
            setIsAdmin(false);
            setLoading(false);
        }
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (isDemoMode) {
        if (isMounted.current) {
            setSession(null);
            setIsAdmin(false);
        }
        return;
    }
    await supabase.auth.signOut();
    if (isMounted.current) {
        setSession(null);
        setIsAdmin(false);
    }
    window.location.reload();
  };

  const signIn = async (email: string) => {
      if (isDemoMode) {
          if (isMounted.current) {
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