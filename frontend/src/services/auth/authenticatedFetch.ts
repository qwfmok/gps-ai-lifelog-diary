import { AuthServiceError, supabaseAuthService } from './SupabaseAuthService';

export type AuthenticatedRequestErrorKind = 'CONFIGURATION' | 'SESSION';

export class AuthenticatedRequestError extends Error {
  constructor(public readonly kind: AuthenticatedRequestErrorKind, message: string) {
    super(message);
    this.name = 'AuthenticatedRequestError';
  }
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let accessToken: string;
  try {
    accessToken = await supabaseAuthService.getAccessToken();
  } catch (error) {
    if (error instanceof AuthServiceError) {
      const kind = error.kind === 'CONFIGURATION' ? 'CONFIGURATION' : 'SESSION';
      throw new AuthenticatedRequestError(kind, error.message);
    }
    throw error;
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(input, { ...init, headers });
}
