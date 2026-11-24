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

export type LocationApiErrorKind =
  | 'CONFIGURATION'
  | 'INSECURE_TRANSPORT'
  | 'NETWORK'
  | 'VALIDATION'
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
