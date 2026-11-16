import { Capacitor } from '@capacitor/core';
import type { TimelineEvent } from '../../types';
import { AuthenticatedRequestError, authenticatedFetch } from '../auth/authenticatedFetch';
import type { TimelineDataService } from './TimelineDataService';
import type { TimelineApiItem, TimelineApiNote } from './TimelineApiTypes';
import { mapTimelineApiItem } from './TimelineMapper';

export type TimelineApiErrorKind =
  | 'AUTH_REQUIRED'
  | 'AUTH_CONFIGURATION'
  | 'BACKEND_CONFIGURATION'
  | 'INSECURE_TRANSPORT'
  | 'NETWORK'
  | 'VALIDATION'
  | 'SERVER'
  | 'PROTOCOL';

export class TimelineApiError extends Error {
  constructor(public readonly kind: TimelineApiErrorKind, message: string) {
    super(message);
    this.name = 'TimelineApiError';
  }
}

export class TimelineApiService implements TimelineDataService {
  private readonly baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  private readonly eventsByDate = new Map<string, TimelineEvent[]>();

  async getTimelineByDate(date: string): Promise<TimelineEvent[]> {
    this.validateDate(date);
    const timelineUrl = this.buildApiUrl('/api/timeline', date);
    const notesUrl = this.buildApiUrl('/api/timeline/notes', date);
    const [timelineResponse, notesResponse] = await Promise.all([
      this.request(timelineUrl),
      this.request(notesUrl),
    ]);

    const items = this.parseList<TimelineApiItem>(await this.readJson(timelineResponse), isTimelineApiItem);
    const notes = this.parseList<TimelineApiNote>(await this.readJson(notesResponse), isTimelineApiNote);
    const events = items.map((item) => mapTimelineApiItem(item, date, notes));
    this.eventsByDate.set(date, events);
    return structuredClone(events);
  }

  async addNote(date: string, eventId: string, note: string): Promise<TimelineEvent> {
    this.validateDate(date);
    const normalizedNote = note.trim();
    if (!normalizedNote || normalizedNote.length > 2000) {
      throw new TimelineApiError('VALIDATION', '메모는 1자 이상 2000자 이하여야 합니다.');
    }

    let events = this.eventsByDate.get(date);
    if (!events) {
      await this.getTimelineByDate(date);
      events = this.eventsByDate.get(date);
    }
    const event = events?.find((candidate) => candidate.id === eventId);
    if (!event) throw new TimelineApiError('VALIDATION', '선택한 체류 기록을 찾을 수 없습니다.');

    const response = await this.request(this.buildApiUrl('/api/timeline/notes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, anchor_location_id: eventId, note: normalizedNote }),
    });
    const createdNote = this.parseObject<TimelineApiNote>(await this.readJson(response), isTimelineApiNote);
    if (createdNote.anchor_location_id !== eventId) {
      throw new TimelineApiError('PROTOCOL', 'Backend 메모 응답의 체류 기록 ID가 일치하지 않습니다.');
    }

    const updatedEvent = {
      ...event,
      note: event.note ? `${event.note}\n\n${createdNote.note}` : createdNote.note,
    };
    this.eventsByDate.set(date, events!.map((candidate) => candidate.id === eventId ? updatedEvent : candidate));
    return structuredClone(updatedEvent);
  }

  private validateDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new TimelineApiError('VALIDATION', '날짜는 YYYY-MM-DD 형식이어야 합니다.');
    }
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new TimelineApiError('VALIDATION', '날짜는 YYYY-MM-DD 형식이어야 합니다.');
    }
  }

  private buildApiUrl(path: string, date?: string): string {
    if (!this.baseUrl) {
      throw new TimelineApiError('BACKEND_CONFIGURATION', 'Timeline을 불러오려면 Backend 주소 설정이 필요합니다.');
    }

    let url: URL;
    try {
      url = new URL(this.baseUrl);
    } catch {
      throw new TimelineApiError('BACKEND_CONFIGURATION', 'Backend 주소 설정을 확인해 주세요.');
    }

    if (Capacitor.getPlatform() === 'android') {
      if (isLoopbackHost(url.hostname)) {
        throw new TimelineApiError('BACKEND_CONFIGURATION', 'Android 기기에서 접근 가능한 Backend 주소가 필요합니다.');
      }
      if (url.protocol !== 'https:') {
        throw new TimelineApiError('INSECURE_TRANSPORT', 'Android Timeline 연결에는 HTTPS Backend 주소가 필요합니다.');
      }
    }

    url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`;
    if (date) url.searchParams.set('date', date);
    return url.toString();
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await authenticatedFetch(url, init);
    } catch (error) {
      if (error instanceof AuthenticatedRequestError) {
        if (error.kind === 'CONFIGURATION') {
          throw new TimelineApiError('AUTH_CONFIGURATION', 'Supabase Auth URL과 공개 key 설정이 필요합니다.');
        }
        throw new TimelineApiError('AUTH_REQUIRED', '로그인 후 Timeline을 확인할 수 있습니다.');
      }
      throw new TimelineApiError('NETWORK', 'Backend에 연결할 수 없습니다. 네트워크와 서버 주소를 확인해 주세요.');
    }

    if (response.status === 401 || response.status === 403) {
      throw new TimelineApiError('AUTH_REQUIRED', '로그인 세션이 없거나 만료되었습니다. 다시 로그인해 주세요.');
    }
    if (response.status === 422) {
      throw new TimelineApiError('VALIDATION', 'Backend가 날짜나 Timeline 요청을 확인해 달라고 응답했습니다.');
    }
    if (!response.ok) {
      throw new TimelineApiError('SERVER', `Timeline API 요청에 실패했습니다. (${response.status})`);
    }
    return response;
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new TimelineApiError('PROTOCOL', 'Backend가 올바른 JSON 응답을 반환하지 않았습니다.');
    }
  }

  private parseList<T>(value: unknown, isItem: (candidate: unknown) => candidate is T): T[] {
    if (!Array.isArray(value) || !value.every(isItem)) {
      throw new TimelineApiError('PROTOCOL', 'Backend Timeline 응답 형식이 예상과 다릅니다.');
    }
    return value;
  }

  private parseObject<T>(value: unknown, isItem: (candidate: unknown) => candidate is T): T {
    if (!isItem(value)) throw new TimelineApiError('PROTOCOL', 'Backend Timeline 메모 응답 형식이 예상과 다릅니다.');
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTimelineApiItem(value: unknown): value is TimelineApiItem {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.latitude === 'number' && Number.isFinite(value.latitude) && value.latitude >= -90 && value.latitude <= 90
    && typeof value.longitude === 'number' && Number.isFinite(value.longitude) && value.longitude >= -180 && value.longitude <= 180
    && isTimestamp(value.started_at)
    && isTimestamp(value.ended_at)
    && typeof value.duration_minutes === 'number' && Number.isFinite(value.duration_minutes) && value.duration_minutes >= 0
    && Number.isInteger(value.point_count) && Number(value.point_count) >= 0
    && (value.address === null || typeof value.address === 'string');
}

function isTimelineApiNote(value: unknown): value is TimelineApiNote {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.anchor_location_id === 'string'
    && isTimestamp(value.stay_started_at)
    && isTimestamp(value.stay_ended_at)
    && typeof value.note === 'string'
    && typeof value.created_at === 'string'
    && isTimestamp(value.created_at);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost'
    || host.endsWith('.localhost')
    || host === '::1'
    || /^127(?:\.\d{1,3}){3}$/.test(host);
}
