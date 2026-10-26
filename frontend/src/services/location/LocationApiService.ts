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

export type LocationApiErrorKind = 'NETWORK' | 'VALIDATION' | 'SERVER' | 'PROTOCOL';

export class LocationApiError extends Error {
  constructor(public readonly kind: LocationApiErrorKind, message: string) {
    super(message);
    this.name = 'LocationApiError';
  }
}

export function toLocationCreateRequest(point: LocationPoint): LocationCreateRequest {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: point.accuracy ?? null,
    recorded_at: new Date(point.recordedAt).toISOString(),
  };
}

export class LocationApiService {
  private readonly baseUrl: string;

  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL ?? '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async saveLocation(point: LocationPoint): Promise<LocationApiResponse> {
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
    return result as LocationApiResponse;
  }
}
