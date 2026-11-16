import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AuthServiceError, supabaseAuthService } from '../services/auth/SupabaseAuthService';

export type AuthStatus = 'LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'UNCONFIGURED' | 'ERROR';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  error: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function statusFor(session: Session | null): AuthStatus {
  return session ? 'AUTHENTICATED' : 'UNAUTHENTICATED';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabaseAuthService.isConfigured ? 'LOADING' : 'UNCONFIGURED');
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setStatus(statusFor(nextSession));
    setError(null);
  }, []);

  useEffect(() => {
    if (!supabaseAuthService.isConfigured) return;

    const unsubscribe = supabaseAuthService.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });
    void supabaseAuthService.getSession()
      .then(applySession)
      .catch(() => {
        setSession(null);
        setStatus('ERROR');
        setError('로그인 상태를 확인하지 못했습니다.');
      });

    return unsubscribe;
  }, [applySession]);

  const refreshSession = useCallback(async () => {
    if (!supabaseAuthService.isConfigured) {
      setStatus('UNCONFIGURED');
      return;
    }
    try {
      applySession(await supabaseAuthService.getSession());
    } catch {
      setStatus('ERROR');
      setError('로그인 상태를 확인하지 못했습니다.');
    }
  }, [applySession]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await supabaseAuthService.signInWithPassword(email, password);
      applySession(result.session);
    } catch (signInError) {
      setError(signInError instanceof AuthServiceError
        ? signInError.message
        : '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      throw signInError;
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await supabaseAuthService.signOut();
      applySession(null);
    } catch (signOutError) {
      setError(signOutError instanceof AuthServiceError
        ? signOutError.message
        : '로그아웃하지 못했습니다. 다시 시도해 주세요.');
      throw signOutError;
    }
  }, [applySession]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    user: session?.user ?? null,
    error,
    signInWithPassword,
    signOut,
    refreshSession,
  }), [error, refreshSession, session, signInWithPassword, signOut, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
