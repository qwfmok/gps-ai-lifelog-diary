import { Capacitor } from '@capacitor/core';
import type { LocationPoint } from '../../types';

export interface LocationCreateRequest {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
}

export interface LocationApiResponse extends LocationCreateRequest {
  id: string;
  address: string | null;
}

export interface ImportedStayResponse {
  latitude: number;
  longitude: number;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  address: string | null;
  place_name: string | null;
  place_category: string | null;
  place_distance_meters: number | null;
  activity_candidates: Array<{ name: string; confidence: number; source: string }>;
}

export interface LocationImportResponse {
  imported_count: number;
  visit_count: number;
  stays: ImportedStayResponse[];
}

export type LocationApiErrorKind =
  | 'CONFIGURATION'
  | 'INSECURE_TRANSPORT'
  | 'NETWORK'
  | 'VALIDATION'
  | 'AUTH'
  | 'SERVER'
  | 'PROTOCOL';

export class LocationApiError extends Error {
  constructor(public readonly kind: LocationApiErrorKind, message: string) {
    super(message);
    this.name = 'LocationApiError';
  }
}

export function toLocationCreateRequest(point: LocationPoint): LocationCreateRequest {
  const timestamp = Date.parse(point.recordedAt);
  if (!Number.isFinite(timestamp)) {
    throw new LocationApiError('VALIDATION', 'Invalid recordedAt timestamp.');
  }

  return {
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: Number.isFinite(point.accuracy) && (point.accuracy ?? -1) >= 0 ? point.accuracy ?? null : null,
    recorded_at: new Date(timestamp).toISOString(),
  };
}

export class LocationApiService {
  private readonly baseUrl: string;

  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL ?? '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async saveLocation(point: LocationPoint): Promise<LocationApiResponse> {
    this.validateApiBaseUrl();
    const request = toLocationCreateRequest(point);
    if (!Number.isFinite(request.latitude) || request.latitude < -90 || request.latitude > 90
      || !Number.isFinite(request.longitude) || request.longitude < -180 || request.longitude > 180) {
      throw new LocationApiError('VALIDATION', 'Invalid location coordinates.');
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
    } catch {
      throw new LocationApiError('NETWORK', 'Could not reach the location API.');
    }

    if (response.status === 422) throw new LocationApiError('VALIDATION', 'The location API rejected the request.');
    if (!response.ok) throw new LocationApiError('SERVER', `Location API returned ${response.status}.`);

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new LocationApiError('PROTOCOL', 'Location API returned an invalid response.');
    }
    if (typeof result !== 'object' || result === null || !('id' in result)
      || !('latitude' in result) || !('longitude' in result) || !('recorded_at' in result)) {
      throw new LocationApiError('PROTOCOL', 'Location API response is missing required fields.');
    }
    return parseLocationResponse(result);
  }

  async getLocationsByDate(date: string): Promise<LocationApiResponse[]> {
    this.validateApiBaseUrl();
    if (!isCalendarDate(date)) throw new LocationApiError('VALIDATION', 'Date must use YYYY-MM-DD format.');

    const query = new URLSearchParams({ date });
    const response = await this.request(`${this.baseUrl}/api/locations?${query.toString()}`);
    if (!response.ok) this.throwResponseError(response);

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new LocationApiError('PROTOCOL', 'Location API returned an invalid response.');
    }
    if (!Array.isArray(result)) throw new LocationApiError('PROTOCOL', 'Location API response must be a list.');
    return result.map(parseLocationResponse);
  }

  async importLocationFile(file: File, accessToken: string): Promise<LocationImportResponse> {
    this.validateApiBaseUrl();
    if (!/\.(csv|json)$/i.test(file.name)) {
      throw new LocationApiError('VALIDATION', 'CSV 또는 JSON 파일을 선택해 주세요.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new LocationApiError('VALIDATION', '파일은 10 MiB 이하여야 합니다.');
    }
    if (!accessToken.trim()) {
      throw new LocationApiError('AUTH', 'Supabase 로그인 토큰을 입력해 주세요.');
    }

    const formData = new FormData();
    formData.append('file', file);
    const response = await this.request(`${this.baseUrl}/api/locations/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
      body: formData,
    });
    if (response.status === 401) throw new LocationApiError('AUTH', '로그인 토큰이 만료되었거나 유효하지 않습니다.');
    if (response.status === 413 || response.status === 415 || response.status === 422) {
      throw new LocationApiError('VALIDATION', await readApiDetail(response));
    }
    if (!response.ok) this.throwResponseError(response);

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new LocationApiError('PROTOCOL', '가져오기 결과를 읽지 못했습니다.');
    }
    return parseImportResponse(result);
  }

  private validateApiBaseUrl(): void {
    const isAndroid = Capacitor.getPlatform() === 'android';
    if (!this.baseUrl) {
      if (isAndroid) throw new LocationApiError('CONFIGURATION', 'An Android device-reachable API URL is required.');
      return;
    }
    if (!isAndroid) return;

    let url: URL;
    try {
      url = new URL(this.baseUrl);
    } catch {
      throw new LocationApiError('CONFIGURATION', 'An Android device-reachable API URL is required.');
    }

    if (isLoopbackHost(url.hostname)) {
      throw new LocationApiError('CONFIGURATION', 'An Android device-reachable API URL is required.');
    }
    if (url.protocol !== 'https:') {
      throw new LocationApiError('INSECURE_TRANSPORT', 'Android location API requests require HTTPS.');
    }
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch {
      throw new LocationApiError('NETWORK', 'Could not reach the location API.');
    }
  }

  private throwResponseError(response: Response): never {
    if (response.status === 422) throw new LocationApiError('VALIDATION', 'The location API rejected the request.');
    throw new LocationApiError('SERVER', `Location API returned ${response.status}.`);
  }
}

async function readApiDetail(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload
      && typeof payload.detail === 'string') return payload.detail;
  } catch {
    // Use the local validation message when the backend has no readable detail.
  }
  return '파일 형식이나 위치 기록을 확인해 주세요.';
}

function parseImportResponse(value: unknown): LocationImportResponse {
  if (typeof value !== 'object' || value === null) {
    throw new LocationApiError('PROTOCOL', '가져오기 응답 형식이 올바르지 않습니다.');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.imported_count !== 'number' || typeof record.visit_count !== 'number'
    || !Array.isArray(record.stays)) {
    throw new LocationApiError('PROTOCOL', '가져오기 응답에 필수 정보가 없습니다.');
  }
  return {
    imported_count: record.imported_count,
    visit_count: record.visit_count,
    stays: record.stays.map((value) => {
      if (typeof value !== 'object' || value === null) {
        throw new LocationApiError('PROTOCOL', '장소 추론 결과 형식이 올바르지 않습니다.');
      }
      const stay = value as Record<string, unknown>;
      if (typeof stay.latitude !== 'number' || typeof stay.longitude !== 'number'
        || typeof stay.started_at !== 'string' || typeof stay.ended_at !== 'string'
        || typeof stay.duration_minutes !== 'number' || !Array.isArray(stay.activity_candidates)) {
        throw new LocationApiError('PROTOCOL', '장소 추론 결과에 필수 정보가 없습니다.');
      }
      return {
        latitude: stay.latitude,
        longitude: stay.longitude,
        started_at: stay.started_at,
        ended_at: stay.ended_at,
        duration_minutes: stay.duration_minutes,
        address: typeof stay.address === 'string' ? stay.address : null,
        place_name: typeof stay.place_name === 'string' ? stay.place_name : null,
        place_category: typeof stay.place_category === 'string' ? stay.place_category : null,
        place_distance_meters: typeof stay.place_distance_meters === 'number'
          ? stay.place_distance_meters : null,
        activity_candidates: stay.activity_candidates.filter(isActivityCandidate),
      };
    }),
  };
}

function isActivityCandidate(value: unknown): value is { name: string; confidence: number; source: string } {
  return typeof value === 'object' && value !== null
    && 'name' in value && typeof value.name === 'string'
    && 'confidence' in value && typeof value.confidence === 'number'
    && 'source' in value && typeof value.source === 'string';
}

function parseLocationResponse(value: unknown): LocationApiResponse {
  if (typeof value !== 'object' || value === null) {
    throw new LocationApiError('PROTOCOL', 'Location API response must be an object.');
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string'
    || typeof record.latitude !== 'number' || !Number.isFinite(record.latitude)
    || typeof record.longitude !== 'number' || !Number.isFinite(record.longitude)
    || typeof record.recorded_at !== 'string' || !Number.isFinite(Date.parse(record.recorded_at))
    || (record.accuracy !== undefined && record.accuracy !== null && typeof record.accuracy !== 'number')
    || (record.address !== undefined && record.address !== null && typeof record.address !== 'string')) {
    throw new LocationApiError('PROTOCOL', 'Location API response is missing required fields.');
  }

  return {
    id: record.id,
    latitude: record.latitude,
    longitude: record.longitude,
    accuracy: typeof record.accuracy === 'number' ? record.accuracy : null,
    recorded_at: record.recorded_at,
    address: typeof record.address === 'string' ? record.address : null,
  };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost'
    || host.endsWith('.localhost')
    || host === '::1'
    || /^127(?:\.\d{1,3}){3}$/.test(host);
}
