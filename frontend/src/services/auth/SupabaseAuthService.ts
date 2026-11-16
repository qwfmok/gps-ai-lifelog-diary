import { createClient, type AuthChangeEvent, type Session, type User } from '@supabase/supabase-js';

export type AuthServiceErrorKind = 'CONFIGURATION' | 'SESSION' | 'SIGN_IN' | 'SIGN_OUT';

export class AuthServiceError extends Error {
  constructor(public readonly kind: AuthServiceErrorKind, message: string) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabasePublicKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? '').trim();

function createSupabaseClient() {
  if (!supabaseUrl || !supabasePublicKey) return null;

  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

const supabaseClient = createSupabaseClient();

export class SupabaseAuthService {
  get isConfigured(): boolean {
    return supabaseClient !== null;
  }

  async getSession(): Promise<Session | null> {
    const client = this.requireClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw new AuthServiceError('SESSION', '현재 로그인 세션을 확인하지 못했습니다.');
    return data.session;
  }

  async getAccessToken(): Promise<string> {
    const session = await this.getSession();
    if (!session?.access_token) {
      throw new AuthServiceError('SESSION', '로그인이 필요합니다.');
    }
    return session.access_token;
  }

  async signInWithPassword(email: string, password: string): Promise<{ session: Session; user: User }> {
    const client = this.requireClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new AuthServiceError('SIGN_IN', '이메일 또는 비밀번호를 확인해 주세요.');
    }
    return { session: data.session, user: data.user };
  }

  async signOut(): Promise<void> {
    const client = this.requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw new AuthServiceError('SIGN_OUT', '로그아웃하지 못했습니다. 다시 시도해 주세요.');
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
    if (!supabaseClient) return () => undefined;
    const { data } = supabaseClient.auth.onAuthStateChange(callback);
    return () => data.subscription.unsubscribe();
  }

  private requireClient() {
    if (!supabaseClient) {
      throw new AuthServiceError('CONFIGURATION', 'Supabase URL과 공개 Auth Key 설정이 필요합니다.');
    }
    return supabaseClient;
  }
}

export const supabaseAuthService = new SupabaseAuthService();
