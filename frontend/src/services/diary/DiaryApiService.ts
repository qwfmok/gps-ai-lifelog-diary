import { Capacitor } from '@capacitor/core';
import type { Diary } from '../../types';
import { AuthenticatedRequestError, authenticatedFetch } from '../auth/authenticatedFetch';
import type { DiaryService } from './DiaryService';

interface DiaryApiRecord {
  id: string;
  diary_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface DiaryCreateRequest {
  diary_date: string;
  content: string;
}

interface DiaryUpdateRequest {
  content: string;
}

export type DiaryServiceErrorKind =
  | 'AUTH_REQUIRED'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_CONFIGURATION'
  | 'BACKEND_CONFIGURATION'
  | 'INSECURE_TRANSPORT'
  | 'NETWORK'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'SERVER'
  | 'PROTOCOL';

export class DiaryServiceError extends Error {
  constructor(public readonly kind: DiaryServiceErrorKind, message: string) {
    super(message);
    this.name = 'DiaryServiceError';
  }
}

export class DiaryApiService implements DiaryService {
  private readonly baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

  async getDiaries(): Promise<Diary[]> {
    const diaries: Diary[] = [];
    const limit = 100;
    let offset = 0;

    while (true) {
      const url = this.buildUrl('/api/diaries');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      const response = await this.request(url.toString());
      const records = this.parseList(await this.readJson(response));
      diaries.push(...records.map(mapDiaryApiRecord));
      if (records.length < limit) return diaries;
      offset += records.length;
    }
  }

  async getDiary(id: string): Promise<Diary | null> {
    const response = await this.request(this.buildUrl(`/api/diaries/${encodeURIComponent(id)}`).toString(), undefined, true);
    if (response.status === 404) return null;
    return mapDiaryApiRecord(this.parseRecord(await this.readJson(response)));
  }

  async createDiary(diary: Pick<Diary, 'date' | 'content'>): Promise<Diary> {
    validateDiaryDate(diary.date);
    const payload: DiaryCreateRequest = { diary_date: diary.date, content: diary.content.trim() };
    validateDiaryContent(payload.content);
    const response = await this.request(this.buildUrl('/api/diaries').toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return mapDiaryApiRecord(this.parseRecord(await this.readJson(response)));
  }

  async updateDiary(id: string, content: string): Promise<Diary> {
    const payload: DiaryUpdateRequest = { content: content.trim() };
    validateDiaryContent(payload.content);
    const response = await this.request(this.buildUrl(`/api/diaries/${encodeURIComponent(id)}`).toString(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return mapDiaryApiRecord(this.parseRecord(await this.readJson(response)));
  }

  async deleteDiary(id: string): Promise<void> {
    await this.request(this.buildUrl(`/api/diaries/${encodeURIComponent(id)}`).toString(), { method: 'DELETE' });
  }

  async deleteAllDiaries(): Promise<void> {
    const diaries = await this.getDiaries();
    await Promise.all(diaries.map((diary) => this.deleteDiary(diary.id)));
  }

  private buildUrl(path: string): URL {
    if (!this.baseUrl) {
      throw new DiaryServiceError('BACKEND_CONFIGURATION', '일기 기능을 사용하려면 Backend 주소 설정이 필요합니다.');
    }

    let url: URL;
    try {
      url = new URL(this.baseUrl);
    } catch {
      throw new DiaryServiceError('BACKEND_CONFIGURATION', 'Backend 주소 설정을 확인해 주세요.');
    }

    if (Capacitor.getPlatform() === 'android') {
      if (isLoopbackHost(url.hostname)) {
        throw new DiaryServiceError('BACKEND_CONFIGURATION', 'Android 기기에서 접근 가능한 Backend 주소가 필요합니다.');
      }
      if (url.protocol !== 'https:') {
        throw new DiaryServiceError('INSECURE_TRANSPORT', 'Android 일기 연결에는 HTTPS Backend 주소가 필요합니다.');
      }
    }

    url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`;
    return url;
  }

  private async request(url: string, init?: RequestInit, allowNotFound = false): Promise<Response> {
    let response: Response;
    try {
      response = await authenticatedFetch(url, init);
    } catch (error) {
      if (error instanceof DiaryServiceError) throw error;
      if (error instanceof AuthenticatedRequestError) {
        if (error.kind === 'CONFIGURATION') {
          throw new DiaryServiceError('AUTH_CONFIGURATION', 'Supabase Auth URL과 공개 key 설정이 필요합니다.');
        }
        throw new DiaryServiceError('AUTH_REQUIRED', '로그인 후 일기를 확인할 수 있습니다.');
      }
      throw new DiaryServiceError('NETWORK', 'Backend에 연결할 수 없습니다. 네트워크와 서버 주소를 확인해 주세요.');
    }

    if (response.status === 401) {
      throw new DiaryServiceError('AUTH_REQUIRED', '로그인 세션이 없거나 만료되었습니다. 다시 로그인해 주세요.');
    }
    if (response.status === 403) {
      throw new DiaryServiceError('AUTH_FORBIDDEN', '이 일기에 접근할 권한이 없습니다.');
    }
    if (response.status === 404 && allowNotFound) return response;
    if (response.status === 404) {
      throw new DiaryServiceError('NOT_FOUND', '일기를 찾을 수 없습니다.');
    }
    if (response.status === 422 || response.status === 400) {
      throw new DiaryServiceError('VALIDATION', await this.readDetail(response) ?? '일기 내용을 확인해 주세요.');
    }
    if (!response.ok) {
      throw new DiaryServiceError('SERVER', `Diary API 요청에 실패했습니다. (${response.status})`);
    }
    return response;
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new DiaryServiceError('PROTOCOL', 'Backend가 올바른 JSON 응답을 반환하지 않았습니다.');
    }
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

  private parseList(value: unknown): DiaryApiRecord[] {
    if (!Array.isArray(value) || !value.every(isDiaryApiRecord)) {
      throw new DiaryServiceError('PROTOCOL', 'Backend Diary 목록 응답 형식이 예상과 다릅니다.');
    }
    return value;
  }

  private parseRecord(value: unknown): DiaryApiRecord {
    if (!isDiaryApiRecord(value)) {
      throw new DiaryServiceError('PROTOCOL', 'Backend Diary 응답 형식이 예상과 다릅니다.');
    }
    return value;
  }
}

function mapDiaryApiRecord(record: DiaryApiRecord): Diary {
  return {
    id: record.id,
    date: record.diary_date,
    content: record.content,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function validateDiaryContent(content: string): void {
  if (!content || content.length > 20000) {
    throw new DiaryServiceError('VALIDATION', '일기 내용은 1자 이상 20000자 이하여야 합니다.');
  }
}

function validateDiaryDate(date: string): void {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new DiaryServiceError('VALIDATION', '날짜는 YYYY-MM-DD 형식이어야 합니다.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDiaryApiRecord(value: unknown): value is DiaryApiRecord {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.diary_date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.diary_date)
    && typeof value.content === 'string'
    && typeof value.created_at === 'string'
    && Number.isFinite(Date.parse(value.created_at))
    && typeof value.updated_at === 'string'
    && Number.isFinite(Date.parse(value.updated_at));
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}
