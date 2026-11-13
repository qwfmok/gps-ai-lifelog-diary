import { Geolocation, type Position, type PermissionStatus } from '@capacitor/geolocation';
import type { LocationPermissionStatus, LocationPoint } from '../../types';
import type { TimelineService } from '../timeline/TimelineService';
import { LocationServiceError, type LocationServiceErrorCode } from './LocationServiceError';
import type { LocationErrorListener, LocationService, LocationUpdateListener } from './LocationService';

const currentPositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 5_000,
};

const trackingOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 5_000,
  interval: 20_000,
  minimumUpdateInterval: 5_000,
};

export class CapacitorLocationService implements LocationService {
  private permissionStatus: LocationPermissionStatus = 'UNKNOWN';
  private watchId: string | null = null;
  private locationHistory: LocationPoint[] = [];

  constructor(private readonly timelineService: TimelineService) {}

  async requestPermission(): Promise<LocationPermissionStatus> {
    try {
      const status = await Geolocation.requestPermissions({ permissions: ['location'] });
      this.permissionStatus = this.toPermissionStatus(status);
      return this.permissionStatus;
    } catch (error) {
      const normalized = normalizeCapacitorError(error);
      if (normalized.code === 'LOCATION_SERVICES_DISABLED') {
        this.permissionStatus = 'UNAVAILABLE';
        return this.permissionStatus;
      }
      throw normalized;
    }
  }

  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    try {
      this.permissionStatus = this.toPermissionStatus(await Geolocation.checkPermissions());
    } catch (error) {
      const normalized = normalizeCapacitorError(error);
      if (normalized.code === 'LOCATION_SERVICES_DISABLED') {
        this.permissionStatus = 'UNAVAILABLE';
        return this.permissionStatus;
      }
      throw normalized;
    }
    return this.permissionStatus;
  }

  async getTrackingStatus(): Promise<boolean> {
    return this.watchId !== null;
  }

  async getCurrentPosition(): Promise<LocationPoint> {
    await this.assertPermissionGranted();
    try {
      return toLocationPoint(await Geolocation.getCurrentPosition(currentPositionOptions));
    } catch (error) {
      throw normalizeCapacitorError(error);
    }
  }

  async startTracking(onUpdate: LocationUpdateListener, onError: LocationErrorListener): Promise<void> {
    if (this.watchId !== null) return;
    await this.assertPermissionGranted();

    let callbackError: LocationServiceError | null = null;
    try {
      const watchId = await Geolocation.watchPosition(trackingOptions, (position, error) => {
        if (error) {
          const normalized = normalizeCapacitorError(error);
          callbackError = normalized;
          onError(normalized);
          void this.stopTracking().catch(() => undefined);
          return;
        }
        if (!position) return;

        try {
          const point = toLocationPoint(position);
          this.locationHistory.push(point);
          onUpdate(point);
        } catch (conversionError) {
          onError(normalizeCapacitorError(conversionError));
        }
      });
      this.watchId = watchId;
      if (callbackError) await this.stopTracking();
    } catch (error) {
      throw normalizeCapacitorError(error);
    }
  }

  async stopTracking(): Promise<void> {
    if (this.watchId === null) return;
    const watchId = this.watchId;
    await Geolocation.clearWatch({ id: watchId });
    this.watchId = null;
  }

  async getLocationHistory(): Promise<LocationPoint[]> {
    return structuredClone(this.locationHistory);
  }

  async deleteLocationHistory(): Promise<void> {
    await this.stopTracking();
    this.locationHistory = [];
    await this.timelineService.deleteAllEvents();
  }

  private async assertPermissionGranted(): Promise<void> {
    const status = await this.getPermissionStatus();
    if (status === 'UNAVAILABLE') throw new LocationServiceError('LOCATION_SERVICES_DISABLED');
    if (status !== 'GRANTED') throw new LocationServiceError('PERMISSION_DENIED');
  }

  private toPermissionStatus(status: PermissionStatus): LocationPermissionStatus {
    if (status.location === 'granted' || status.coarseLocation === 'granted') return 'GRANTED';
    if (status.location === 'denied' && status.coarseLocation === 'denied') return 'DENIED';
    return 'UNKNOWN';
  }
}

function toLocationPoint(position: Position): LocationPoint {
  const { latitude, longitude, accuracy } = position.coords;
  const recordedAt = new Date(position.timestamp);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || !Number.isFinite(recordedAt.getTime())) {
    throw new LocationServiceError('POSITION_UNAVAILABLE');
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined,
    recordedAt: recordedAt.toISOString(),
  };
}

function normalizeCapacitorError(error: unknown): LocationServiceError {
  if (error instanceof LocationServiceError) return error;

  const details = typeof error === 'object' && error !== null
    ? error as { code?: unknown; message?: unknown }
    : {};
  const code = typeof details.code === 'string' ? details.code : '';
  const message = typeof details.message === 'string' ? details.message.toLowerCase() : '';
  const normalizedCode: LocationServiceErrorCode = code.endsWith('0003')
    ? 'PERMISSION_DENIED'
    : code.endsWith('0007') || code.endsWith('0009') || code.endsWith('0016')
      ? 'LOCATION_SERVICES_DISABLED'
      : code.endsWith('0010')
        ? 'TIMEOUT'
        : code.endsWith('0002') || message.includes('location')
          ? 'POSITION_UNAVAILABLE'
          : 'UNKNOWN';

  return new LocationServiceError(normalizedCode);
}
