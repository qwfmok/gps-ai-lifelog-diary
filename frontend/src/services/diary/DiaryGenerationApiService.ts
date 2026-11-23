import { Capacitor } from '@capacitor/core';
import { AuthenticatedRequestError, authenticatedFetch } from '../auth/authenticatedFetch';
import type { DiaryGenerationInput, DiaryGenerationResult, DiaryGenerationService } from './DiaryGenerationService';

interface DiaryGenerateRequest {
  diary_date: string;
  memo?: string;
  transcript?: string;
}

interface DiaryGenerateResponse {
  generated_diary: string;
  used_facts: string[];
  uncertain_points: string[];
}

export type DiaryGenerationErrorKind =
  | 'AUTH_REQUIRED' | 'AUTH_CONFIGURATION' | 'BACKEND_CONFIGURATION'
  | 'INSECURE_TRANSPORT' | 'NETWORK' | 'VALIDATION' | 'GENERATION'
  | 'SERVER' | 'PROTOCOL';

export class DiaryGenerationError extends Error {
  constructor(public readonly kind: DiaryGenerationErrorKind, message: string) {
    super(message);
    this.name = 'DiaryGenerationError';
  }
}

export class DiaryGenerationApiService implements DiaryGenerationService {
  private readonly baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

  async generateDiaryDraft(input: DiaryGenerationInput): Promise<DiaryGenerationResult> {
    const url = this.buildUrl();
    const body: DiaryGenerateRequest = { diary_date: input.date };
    if (input.memo?.trim()) body.memo = input.memo.trim();
    if (input.transcript?.trim()) body.transcript = input.transcript.trim();
    if (body.memo && body.memo.length > 4000) {
      throw new DiaryGenerationError('VALIDATION', '메모는 4000자 이하여야 합니다.');
    }
    if (body.transcript && body.transcript.length > 12000) {
      throw new DiaryGenerationError('VALIDATION', '음성 전사 내용은 12000자 이하여야 합니다.');
    }

    let response: Response;
    try {
      response = await authenticatedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof AuthenticatedRequestError) {
        if (error.kind === 'CONFIGURATION') {
          throw new DiaryGenerationError('AUTH_CONFIGURATION', 'Supabase Auth URL과 공개 key 설정이 필요합니다.');
        }
        throw new DiaryGenerationError('AUTH_REQUIRED', '로그인 후 일기를 생성할 수 있습니다.');
      }
      throw new DiaryGenerationError('NETWORK', 'Backend에 연결할 수 없습니다. 네트워크와 서버 주소를 확인해 주세요.');
    }

    if (response.status === 401 || response.status === 403) {
      throw new DiaryGenerationError('AUTH_REQUIRED', '로그인 세션이 없거나 만료되었습니다. 다시 로그인해 주세요.');
    }
    if (response.status === 422) {
      throw new DiaryGenerationError('VALIDATION', await this.readDetail(response) ?? '일기에 사용할 기록이 없거나 입력을 확인해 주세요.');
    }
    if (response.status === 502 || response.status === 503) {
      throw new DiaryGenerationError('GENERATION', await this.readDetail(response) ?? 'Backend 일기 생성 설정을 확인해 주세요.');
    }
    if (!response.ok) {
      throw new DiaryGenerationError('SERVER', `일기 생성 요청에 실패했습니다. (${response.status})`);
    }

    const result = await this.readResponse(response);
    const now = new Date().toISOString();
    return {
      diary: {
        id: `api-draft-${input.date}-${Date.now()}`,
        date: input.date,
        content: result.generated_diary,
        createdAt: now,
        updatedAt: now,
      },
      usedFacts: result.used_facts,
      uncertainPoints: result.uncertain_points,
    };
  }

  private buildUrl(): string {
    if (!this.baseUrl) {
      throw new DiaryGenerationError('BACKEND_CONFIGURATION', '일기를 생성하려면 Backend 주소 설정이 필요합니다.');
    }
    let url: URL;
    try {
      url = new URL(this.baseUrl);
    } catch {
      throw new DiaryGenerationError('BACKEND_CONFIGURATION', 'Backend 주소 설정을 확인해 주세요.');
    }
    if (Capacitor.getPlatform() === 'android' && (isLoopbackHost(url.hostname) || url.protocol !== 'https:')) {
      throw new DiaryGenerationError(
        url.protocol !== 'https:' ? 'INSECURE_TRANSPORT' : 'BACKEND_CONFIGURATION',
        'Android 앱에서는 기기에서 접근 가능한 HTTPS Backend 주소가 필요합니다.',
      );
    }
    url.pathname = `${url.pathname.replace(/\/$/, '')}/api/diaries/generate`;
    return url.toString();
  }

  private async readResponse(response: Response): Promise<DiaryGenerateResponse> {
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new DiaryGenerationError('PROTOCOL', 'Backend가 올바른 JSON 응답을 반환하지 않았습니다.');
    }
    if (!isResponse(value)) {
      throw new DiaryGenerationError('PROTOCOL', 'Backend Diary 응답 형식이 예상과 다릅니다.');
    }
    return value;
  }

  private async readDetail(response: Response): Promise<string | null> {
    try {
      const value: unknown = await response.json();
      if (isRecord(value) && typeof value.detail === 'string') return value.detail;
    } catch {
      return null;
    }
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isResponse(value: unknown): value is DiaryGenerateResponse {
  return isRecord(value)
    && typeof value.generated_diary === 'string'
    && Array.isArray(value.used_facts) && value.used_facts.every((item) => typeof item === 'string')
    && Array.isArray(value.uncertain_points) && value.uncertain_points.every((item) => typeof item === 'string');
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}
